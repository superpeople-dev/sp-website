import { admins, owners } from "./admins";
import { allPermissions, type Permission } from "./board";
import { staffEntries, staffEntry, profilesOf, allAuthors, type StaffEntry } from "./store";

// Who is an admin and what they may do. Owners have everything. Anyone else is an admin when an
// owner added them, or when they are on the list in lib/admins.ts, in ADMIN_DISCORD_IDS or have the
// Discord admin role, and an owner hasn't removed them; they have the permissions an owner gave them,
// or all of them until an owner changes that. Checked on every request, so a change applies at once.

export type Access = { owner: boolean; permissions: Permission[] };

const envAdmins = (process.env.ADMIN_DISCORD_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

export const isOwner = (id: string) => owners.includes(id);

// Whether these Discord roles include one that makes someone an admin (DISCORD_ADMIN_ROLE_IDS),
// for the Discord bot's commands (app/api/bot): the bot sends the roles it saw on the member.
const adminRoleIds = (process.env.DISCORD_ADMIN_ROLE_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
export const hasAdminRole = (roles: string[]) => roles.some((role) => adminRoleIds.includes(role));

// The Discord roles below the admins that may still ban for a while from the bot (/tempban) and lift
// such a ban (/unban), but not ban until lifted: DISCORD_MODERATOR_ROLE_IDS, unset or empty the
// server's Moderator and Developer roles ("none" for nobody). Only the bot's routes (app/api/bot) read it.
const moderatorRoleIds = (process.env.DISCORD_MODERATOR_ROLE_IDS || "1476337721374150668,1545601887292891136")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
export const hasModeratorRole = (roles: string[]) => roles.some((role) => moderatorRoleIds.includes(role));

// Admins saved before the activity and api permissions existed had both (the activity log was every
// admin's); they keep them until an owner saves their permissions again.
const since2: Permission[] = ["activity", "api"];

// On the list in the code or the environment (the admins from before the panel managed them).
export const isListedAdmin = (id: string) => envAdmins.includes(id) || admins.some((admin) => admin.discordId === id);

const accessFrom = (id: string, entry: StaffEntry | null, roleAdmin: boolean): Access | null => {
  if (isOwner(id)) return { owner: true, permissions: allPermissions };
  if (entry) return entry.removed ? null : { owner: false, permissions: entry.v === 2 ? entry.permissions : [...entry.permissions, ...since2] };
  return roleAdmin || isListedAdmin(id) ? { owner: false, permissions: allPermissions } : null;
};

// roleAdmin: the Discord admin role, as it was when they signed in.
export async function accessOf(id: string, roleAdmin = false): Promise<Access | null> {
  return accessFrom(id, isOwner(id) ? null : await staffEntry(id), roleAdmin);
}

// Tells who is an admin now, for many people at once (comment badges): one read of the store.
export async function adminCheck() {
  const entries = await staffEntries();
  return (id: string, roleAdmin = false) => accessFrom(id, entries[id] ?? null, roleAdmin) !== null;
}

export type StaffMember = { id: string; name: string; username?: string; avatar?: string; owner: boolean; permissions: Permission[] };

// The admins tab: owners first, then everyone else by name, with their Discord picture when we have
// one (from their last sign-in, or else from an idea or comment they posted).
export async function listStaff(): Promise<StaffMember[]> {
  const entries = await staffEntries();
  const names = new Map<string, string>([
    ...admins.map((admin) => [admin.discordId, admin.name] as const),
    ...envAdmins.map((id) => [id, id] as const),
    ...Object.values(entries).map((entry) => [entry.id, entry.name] as const),
  ]);
  for (const id of owners) if (!names.has(id)) names.set(id, id);
  const members = [...names]
    .map(([id, name]) => {
      const access = accessFrom(id, entries[id] ?? null, false);
      return access && { id, name, owner: access.owner, permissions: access.permissions };
    })
    .filter((member): member is Omit<StaffMember, "avatar" | "username"> => member !== null);

  const profiles = await profilesOf(members.map((member) => member.id));
  const missing = members.filter((member) => !profiles[member.id]);
  if (missing.length) {
    for (const profile of await allAuthors()) if (!profiles[profile.id]) profiles[profile.id] = profile;
  }
  return members
    .map((member) => ({
      ...member,
      name: profiles[member.id]?.name || member.name,
      username: profiles[member.id]?.username || undefined,
      avatar: profiles[member.id]?.avatar,
    }))
    .sort((a, b) => Number(b.owner) - Number(a.owner) || a.name.localeCompare(b.name));
}
