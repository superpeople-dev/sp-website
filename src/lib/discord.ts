import { boardOf, itemPath, type ActivityEvent } from "./board";
import { siteUrl } from "./seo";

// Discord posts for what happens on the site, in the style of the Reflet webhook's "New idea".
// Community events (votes, comments) go to DISCORD_WEBHOOK_URL, the channel with the new ideas.
// Moderation (bans, deletions with the deleted text, edits, admin changes, ideas to review) goes to
// DISCORD_MOD_WEBHOOK_URL, meant for a private staff channel; without it those are not posted.
// Approvals and moves are already posted by the Reflet webhook (app/api/webhooks/reflet). A deleted
// idea or task is posted to both: the community sees it went, the staff channel keeps the record.

type Channel = "community" | "moderation";
type Embed = {
  label: string;
  color: number;
  title?: string;
  url?: string;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  // Discord ids to ping (a comment's @mentions); nobody else is ever pinged.
  ping?: string[];
};

const hooks: Record<Channel, string | undefined> = {
  community: process.env.DISCORD_WEBHOOK_URL,
  moderation: process.env.DISCORD_MOD_WEBHOOK_URL,
};

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
      username: "SUPER PEOPLE Revival",
      ...(embed.ping?.length ? { content: embed.ping.map((id) => `<@${id}>`).join(" ") } : {}),
      allowed_mentions: { parse: [], users: embed.ping ?? [] },
      embeds: [
        {
          author: { name: embed.label },
          title: embed.title ? clip(embed.title, 256) : undefined,
          url: embed.url,
          description: embed.description ? clip(embed.description, 1000) : undefined,
          color: embed.color,
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
    "idea.posted": ["moderation", { label: "New idea to review", color: colors.gold, ...onItem, fields: [by] }],
    "idea.rejected": ["moderation", { label: "Idea rejected", color: colors.red, title: event.item?.title, fields: [by] }],
    "item.edited": ["moderation", { label: "Item edited", color: colors.grey, ...onItem, fields: [by] }],
    "item.assigned": [
      "moderation",
      { label: "Task assigned", color: colors.gold, ...onItem, fields: [by, { name: "Assigned to", value: person(event.user), inline: true }] },
    ],
    "item.unassigned": ["moderation", { label: "Task given back to the whole team", color: colors.grey, ...onItem, fields: [by] }],
    "item.deleted": ["moderation", { label: "Item deleted", color: colors.red, title: event.item?.title, fields: [by] }],
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
    await post("community", {
      label: event.item.status === "open" ? "Idea deleted" : "Task deleted",
      color: colors.red,
      title: event.item.title,
      fields: [by],
    });
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
