import { boardOf, itemPath, type ActivityEvent } from "./board";
import { capital, kinds } from "./kinds";
import { siteUrl } from "./seo";

// Discord posts for what happens on the site, in the style of the Reflet webhook's "New idea".
// Community events (votes, comments) go to DISCORD_WEBHOOK_URL, the channel with the new ideas.
// Moderation (bans, deletions with the deleted text, edits, admin changes, ideas to review) goes to
// DISCORD_MOD_WEBHOOK_URL, meant for a private staff channel; without it those are not posted.
// Approvals and moves are already posted by the Reflet webhook (app/api/webhooks/reflet). A deleted
// idea or task is posted to both: the community sees it went, the staff channel keeps the record.
// Two log channels for the staff: DISCORD_AUTH_LOG_WEBHOOK_URL (#discord-auth-logs) hears every
// Discord sign-in and sign-out, on the website and in the launcher; DISCORD_LAUNCHER_LOG_WEBHOOK_URL
// (#launcher-logs) what players do with the game in the launcher (download, verify, uninstall) and
// the download limits. Without them those are not posted. Never an IP.

type Channel = "community" | "moderation" | "auth" | "launcher";
type Embed = {
  label: string;
  color: number;
  title?: string;
  url?: string;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  // Discord ids to ping (a comment's @mentions); nobody else is ever pinged.
  ping?: string[];
  // A picture at the top right (the player's Discord avatar in the logs).
  thumbnail?: string;
};

const hooks: Record<Channel, string | undefined> = {
  community: process.env.DISCORD_WEBHOOK_URL,
  moderation: process.env.DISCORD_MOD_WEBHOOK_URL,
  auth: process.env.DISCORD_AUTH_LOG_WEBHOOK_URL,
  launcher: process.env.DISCORD_LAUNCHER_LOG_WEBHOOK_URL,
};

// Name and picture of every post, whichever webhook it goes through. Without avatar_url Discord shows
// the webhook's own picture, which is only set on some of them.
export const identity = { username: "SUPER PEOPLE Revival", avatar_url: `${siteUrl}/icon-512.png` };

const colors = { blue: 0x8fb0ff, red: 0xef4438, green: 0x3ddc84, gold: 0xf0b719, grey: 0xbdb7b2 };
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
// A mention shows the Discord name and never pings (allowed_mentions below).
const person = (who: { id?: string; name: string } | undefined) => (who?.id && /^\d+$/.test(who.id) ? `<@${who.id}>` : who?.name || "?");

async function post(channel: Channel, embed: Embed) {
  const hook = hooks[channel];
  if (!hook) return;
  await fetch(hook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...identity,
      ...(embed.ping?.length ? { content: embed.ping.map((id) => `<@${id}>`).join(" ") } : {}),
      allowed_mentions: { parse: [], users: embed.ping ?? [] },
      embeds: [
        {
          author: { name: embed.label },
          title: embed.title ? clip(embed.title, 256) : undefined,
          url: embed.url,
          description: embed.description ? clip(embed.description, 1000) : undefined,
          color: embed.color,
          thumbnail: embed.thumbnail ? { url: embed.thumbnail } : undefined,
          fields: embed.fields?.map((field) => ({ ...field, value: clip(field.value, 1024) })),
          footer: { text: "superpeople.dev" },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  }).catch((error) => console.error(`[discord] post failed: ${error instanceof Error ? error.message : String(error)}`));
}

const itemUrl = (item: { id: string; title: string; status?: ActivityEvent["to"] }) =>
  `${siteUrl}${itemPath(boardOf(item.status ?? "open"), item)}`;

// What a line of the activity log becomes on Discord (nothing for the events the Reflet webhook posts).
export async function announce(event: ActivityEvent) {
  const by = { name: "By", value: person(event.actor), inline: true };
  const onItem = event.item ? { title: event.item.title, url: itemUrl(event.item) } : {};
  const who = event.user ? { name: "User", value: person(event.user), inline: true } : null;
  // What the idea is ("New bug report to review") and its Type and Platform fields, when the event
  // says (older lines of the log don't: they stay an "idea").
  const kind = kinds[event.kind ?? "other"];
  const about = event.kind
    ? [
        { name: "Type", value: kind.type, inline: true },
        { name: "Platform", value: event.platform || "Other", inline: true },
      ]
    : [];
  const gone = `${event.item?.status === "planned" || event.item?.status === "in_progress" || event.item?.status === "completed" ? "Task" : capital(kind.name)} deleted`;
  const embeds: Partial<Record<ActivityEvent["type"], [Channel, Embed]>> = {
    "comment.posted": [
      "community",
      {
        label: "New comment",
        color: colors.grey,
        ...onItem,
        description: event.text,
        fields: [by, ...(event.mentions?.length ? [{ name: "Mentions", value: event.mentions.map(person).join(" "), inline: true }] : [])],
        ping: event.mentions?.map((mention) => mention.id).filter((id) => /^\d+$/.test(id)),
      },
    ],
    "idea.posted": [
      "moderation",
      {
        label: `New ${kind.name} to review`,
        color: kind.color,
        ...onItem,
        description: event.text ? clip(event.text, 700) : undefined,
        fields: [...about, { ...by, name: kind.by }],
      },
    ],
    "idea.rejected": ["moderation", { label: `${capital(kind.name)} rejected`, color: colors.red, title: event.item?.title, fields: [...about, by] }],
    "item.edited": ["moderation", { label: "Item edited", color: colors.grey, ...onItem, fields: [by] }],
    "item.assigned": [
      "moderation",
      { label: "Task assigned", color: colors.gold, ...onItem, fields: [by, { name: "Assigned to", value: person(event.user), inline: true }] },
    ],
    "item.unassigned": ["moderation", { label: "Task given back to the whole team", color: colors.grey, ...onItem, fields: [by] }],
    "item.deleted": ["moderation", { label: gone, color: colors.red, title: event.item?.title, fields: [...about, by] }],
    "comment.deleted": [
      "moderation",
      { label: "Comment deleted", color: colors.red, ...onItem, description: event.text, fields: [by, ...(who ? [{ ...who, name: "Written by" }] : [])] },
    ],
    "media.deleted": ["moderation", { label: "File removed", color: colors.red, ...onItem, fields: [by] }],
    "comments.off": ["moderation", { label: "Comments turned off", color: colors.grey, ...onItem, fields: [by] }],
    "comments.on": ["moderation", { label: "Comments turned back on", color: colors.green, ...onItem, fields: [by] }],
    "user.banned": [
      "moderation",
      { label: "User banned", color: colors.red, description: person(event.user), fields: [by, { name: "Reason", value: event.text || "?", inline: false }] },
    ],
    "user.unbanned": ["moderation", { label: "User unbanned", color: colors.green, description: person(event.user), fields: [by] }],
    "staff.added": ["moderation", { label: "Admin added", color: colors.gold, description: person(event.user), fields: [by, permissionsField(event)] }],
    "staff.changed": ["moderation", { label: "Admin permissions changed", color: colors.gold, description: person(event.user), fields: [by, permissionsField(event)] }],
    "staff.removed": ["moderation", { label: "Admin removed", color: colors.red, description: person(event.user), fields: [by] }],
  };
  const found = embeds[event.type];
  if (found) await post(...found);
  if (event.type === "item.deleted" && event.item) {
    await post("community", { label: gone, color: colors.red, title: event.item.title, fields: [...about, by] });
  }
}

function permissionsField(event: ActivityEvent) {
  return { name: "Permissions", value: event.permissions?.length ? event.permissions.join(", ") : "none", inline: true };
}

// A vote (up or down) given on an item; taking a vote back is not posted.
export async function announceVote(
  voter: { id: string; name: string },
  item: { id: string; title: string; status: ActivityEvent["to"] },
  direction: "up" | "down",
  score: number,
) {
  await post("community", {
    label: direction === "up" ? "Upvoted" : "Downvoted",
    color: direction === "up" ? colors.blue : colors.red,
    title: item.title,
    url: itemUrl(item),
    fields: [
      { name: "By", value: person(voter), inline: true },
      { name: "Score", value: String(score), inline: true },
    ],
  });
}

// ------------------------------------------------------------------- logs ---

export type Player = { id: string; name: string; username?: string; avatar?: string };

const playerFields = (who: Player) => [
  { name: "Player", value: `${person(who)}\n${who.name}${who.username ? ` (@${who.username})` : ""}`, inline: true },
  { name: "Discord ID", value: who.id, inline: true },
];
// Discord shows these in each reader's own time zone.
const stamp = (ms: number, style: "F" | "R" = "F") => `<t:${Math.floor(ms / 1000)}:${style}>`;
const now = () => `${stamp(Date.now())} (${stamp(Date.now(), "R")})`;
const gigabytes = (bytes: number) => `${(bytes / 1e9).toFixed(bytes >= 1e10 ? 0 : 1)} GB`;
function duration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h} h ${m} min` : m ? `${m} min` : `${Math.round(seconds)} s`;
}
// Text a launcher sent: shown as is, never formatted (no links, no mentions).
const verbatim = (text: string) => `\`\`\`\n${clip(text.replaceAll("`", "'"), 900)}\n\`\`\``;

export type AuthEvent = "signed_in" | "signed_out" | "refused";

// #discord-auth-logs: a Discord account signed in or out of the website or the launcher, or was
// refused (banned).
export async function logAuth(event: AuthEvent, who: Player, where: "website" | "launcher", reason?: string) {
  const launcher = where === "launcher";
  const label = {
    signed_in: launcher ? "Connected to the launcher" : "Signed in on the website",
    signed_out: launcher ? "Disconnected from the launcher" : "Signed out of the website",
    refused: launcher ? "Launcher sign-in refused" : "Website sign-in refused",
  }[event];
  await post("auth", {
    label,
    color: { signed_in: colors.green, signed_out: colors.grey, refused: colors.red }[event],
    thumbnail: who.avatar,
    fields: [
      ...playerFields(who),
      { name: "Where", value: launcher ? "Launcher" : "Website", inline: true },
      { name: "When", value: now(), inline: false },
      ...(reason ? [{ name: "Reason", value: reason, inline: false }] : []),
    ],
  });
}

export const launcherActions = [
  "download.started",
  "download.finished",
  "download.failed",
  "verify.ok",
  "verify.repaired",
  "uninstalled",
  "game.launched",
] as const;
export type LauncherAction = (typeof launcherActions)[number] | "limit";
export type LauncherDetails = {
  files?: number;
  bytes?: number;
  seconds?: number;
  version?: string;
  reason?: string;
  // Where the files came from: the team's storage, or the backup copy.
  source?: "storage" | "backup";
  // A download limit's end (Unix ms).
  until?: number;
  // The player's PC, when the game starts (sp-launcher hardware.rs).
  hardware?: Hardware;
  // Where the player is, as Vercel places their connection: ISO country, and its region's code.
  location?: { country: string; region?: string };
};

// "🇧🇷 Brazil (SP)": the flag, the country's English name, the region's code when there is one.
function place({ country, region }: { country: string; region?: string }) {
  const flag = String.fromCodePoint(...[...country].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
  const name = new Intl.DisplayNames(["en"], { type: "region" }).of(country) ?? country;
  return `${flag} ${name}${region ? ` (${region})` : ""}`;
}

export type Hardware = {
  cpu?: string;
  threads?: number;
  ramGb?: number;
  gpus?: { name: string; vramGb?: number }[];
  os?: string;
  screen?: string;
  screens?: number;
};

function hardwareText(pc: Hardware) {
  const gpus = (pc.gpus ?? []).map((gpu) => (gpu.vramGb ? `${gpu.name} (${gpu.vramGb} GB)` : gpu.name)).join(", ");
  return [
    pc.cpu && `CPU:    ${pc.cpu}${pc.threads ? ` (${pc.threads} threads)` : ""}`,
    gpus && `GPU:    ${gpus}`,
    pc.ramGb && `RAM:    ${pc.ramGb} GB`,
    pc.os && `OS:     ${pc.os}`,
    pc.screen && `Screen: ${pc.screen}${pc.screens && pc.screens > 1 ? ` (${pc.screens} screens)` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// #launcher-logs: what a player did with the game in the launcher, and the download limits.
export async function logLauncher(action: LauncherAction, who: Player, details: LauncherDetails) {
  const fields: { name: string; value: string; inline?: boolean }[] = [...playerFields(who)];
  const add = (name: string, value: string | undefined, inline = true) => value && fields.push({ name, value, inline });
  const files = details.files !== undefined ? `${details.files} file${details.files === 1 ? "" : "s"}` : undefined;
  const size = details.bytes !== undefined ? gigabytes(details.bytes) : undefined;
  const [label, color] = (
    {
      "download.started": ["Download started", colors.blue],
      "download.finished": ["Game installed", colors.green],
      "download.failed": ["Download failed", colors.red],
      "verify.ok": ["Files verified: all fine", colors.green],
      "verify.repaired": ["Files repaired", colors.gold],
      uninstalled: ["Game uninstalled", colors.grey],
      "game.launched": ["Game launched", colors.blue],
      limit: ["Download limit reached", colors.red],
    } as const
  )[action];
  if (action === "download.started") add("To download", [size, files].filter(Boolean).join(", "));
  if (action === "download.finished") {
    add("Downloaded", [size, files].filter(Boolean).join(", "));
    add("Took", details.seconds !== undefined ? duration(details.seconds) : undefined);
  }
  if (action === "verify.ok") add("Checked", files);
  if (action === "verify.repaired") add("Downloaded again", [files, size].filter(Boolean).join(", "));
  if (action === "uninstalled") add("Space freed", size);
  if (action === "limit") {
    add("Last hour", size);
    add("Blocked until", details.until ? stamp(details.until) : undefined);
  }
  if (details.source && action !== "limit" && action !== "uninstalled") add("From", details.source === "backup" ? "Backup (archive.org)" : "Storage (Storj)");
  add("Launcher", details.version ? `v${details.version}` : undefined);
  add("Location", details.location ? place(details.location) : undefined);
  add("When", now(), false);
  if (details.hardware) add("Hardware", verbatim(hardwareText(details.hardware) || "unknown"), false);
  if (details.reason) add("Reason", verbatim(details.reason), false);
  await post("launcher", { label, color, thumbnail: who.avatar, fields });
}
