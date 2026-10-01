import type { NextRequest } from "next/server";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import type { IdeaType } from "@/i18n/types";
import { apiUser } from "./apikeys";
import { boardOf, itemPath, type Category, type Permission, type TypeTag } from "./board";
import { siteUrl } from "./seo";
import { ideaTypes } from "./site";
import { listStaff, type StaffMember } from "./staff";
import { allAssignees } from "./store";

// The developer API (app/api/dev): what agents use to keep the roadmap up to date (create tasks and
// ideas, move them, assign them, comment). Every call needs an admin's API key (lib/apikeys.ts); the answers are
// JSON and never cached. Documented in sp-docs/docs/ROADMAP-API.md and by GET /api/dev.

export const devJson = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const devError = (error: string, status: number, detail?: string) => devJson({ error, ...(detail && { detail }) }, status);

// The admin behind the key, or the answer to send: 401 without a working key, 403 without the permission.
export async function devUser(request: NextRequest, permission?: Permission) {
  const user = await apiUser(request);
  if (!user) {
    return { error: devError("auth", 401, "Send an admin's API key: Authorization: Bearer spk_... (admin panel, API tab). A revoked key, or one whose admin lost the API permission, stops working.") };
  }
  if (permission && !user.permissions.includes(permission)) {
    return { error: devError("forbidden", 403, `This needs the "${permission}" permission.`) };
  }
  return { user };
}

export const typeSlugs = ideaTypes.map((type) => type.slug) as IdeaType[];

// A platform by its id or its name ("game", "Launcher"); "other" or "none" is no platform (null).
// undefined when nothing matches.
export function platformOf(value: unknown, categories: Category[]): Category | null | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const wanted = value.trim().toLowerCase();
  if (wanted === "other" || wanted === "none") return null;
  return categories.find((category) => category.id === value.trim() || category.name.trim().toLowerCase() === wanted);
}

export type TaskView = {
  id: string;
  title: string;
  description: string;
  status: FeedbackStatus;
  type: IdeaType;
  platform: string | null;
  votes: number;
  comments: number;
  url: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  // The admin working on it, or null: the whole team's.
  assignee: Assigned;
};

// Who an item is assigned to in the answers: an admin, or null for the whole team. An admin removed
// since then leaves it to the team again, as on the site.
export type Assigned = { id: string; name: string } | null;
const assigned = (member: StaffMember | undefined): Assigned => (member ? { id: member.id, name: member.name } : null);

// The admins items can be assigned to, and who each item is assigned to now (one read of each).
export async function assignments() {
  const [staff, all] = await Promise.all([listStaff(), allAssignees()]);
  return { staff, of: (itemId: string) => assigned(staff.find((member) => member.id === all[itemId])) };
}

// The admin an "assignee" names: "me" (the key's admin), "team" or null (the whole team), or an
// admin's Discord id, username or name (any case). error: it names nobody, or more than one admin.
export function assigneeFrom(value: unknown, user: { id: string }, staff: StaffMember[]): { member: StaffMember | null } | { error: string } {
  if (value === null) return { member: null };
  if (typeof value !== "string" || !value.trim()) {
    return { error: `assignee is "me", "team", or an admin's id, username or name (GET /api/dev/meta lists them)` };
  }
  const wanted = value.trim().replace(/^@/, "").toLowerCase();
  if (wanted === "team" || wanted === "none") return { member: null };
  const byId = staff.find((member) => member.id === (wanted === "me" ? user.id : value.trim()));
  if (byId) return { member: byId };
  if (wanted === "me") return { error: "You are not on the admins list, so nothing can be assigned to you." };
  const byUsername = staff.filter((member) => member.username?.toLowerCase() === wanted);
  const found = byUsername.length ? byUsername : staff.filter((member) => member.name.trim().toLowerCase() === wanted);
  if (found.length === 1) return { member: found[0] };
  return {
    error: found.length
      ? `More than one admin is called "${value.trim()}": use their id (GET /api/dev/meta).`
      : `No admin called "${value.trim()}" (GET /api/dev/meta lists them).`,
  };
}

export function taskView(item: FeedbackItem, tags: { categories: Category[]; types: TypeTag[] }, assignee: Assigned = null): TaskView {
  const type = tags.types.find((entry) => item.tags.some((tag) => tag.id === entry.id))?.slug ?? "other";
  const platform = item.tags.find((tag) => tags.categories.some((category) => category.id === tag.id))?.name ?? null;
  const when = (ms: number | undefined) => (ms ? new Date(ms).toISOString() : null);
  return {
    id: item.id,
    title: item.title,
    description: item.description ?? "",
    status: item.status,
    type,
    platform,
    votes: item.voteCount ?? 0,
    comments: item.commentCount ?? 0,
    url: `${siteUrl}${itemPath(boardOf(item.status), item)}`,
    createdAt: when(item.createdAt) ?? "",
    updatedAt: when(item.updatedAt) ?? "",
    completedAt: when(item.completedAt),
    assignee,
  };
}

// Search words match with or without accents and case ("écran" finds "Ecran").
export const plainText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
