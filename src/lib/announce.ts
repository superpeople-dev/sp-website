import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import { itemPath } from "./board";
import { identity } from "./discord";
import { capital, typeAndPlatforms, type Kind } from "./kinds";
import { reporterIds } from "./reporters";
import { siteUrl } from "./seo";
import { authorsOf, changedBy, justCreated } from "./store";

// The community channel's post (DISCORD_WEBHOOK_URL) when an item changes status: a new idea on Bugs &
// Ideas, an item added to the roadmap, work started, done. Reflet's webhook posted it until 02.10.2026;
// lib/reflet.ts setStatus now does, right after the change. Who did it comes from the marks the
// admin actions leave first (lib/store.ts markCreated, markChangedBy).

type Announcement = { label: string; color: number; path: string };

// Where the item is now, in the Status field.
const places: Partial<Record<FeedbackStatus, string>> = {
  open: "Open for votes on Bugs & Ideas",
  planned: "Roadmap - To do",
  in_progress: "Roadmap - In progress",
  completed: "Completed",
};
const statusColors = { planned: 0xf0b719, in_progress: 0xef4438, completed: 0x3ddc84 };
const paths: Partial<Record<FeedbackStatus, string>> = {
  open: "/bugs-and-ideas",
  planned: "/roadmap",
  in_progress: "/roadmap",
  completed: "/completed",
};

// A new idea is shown in its type's colour; a move on the roadmap in the colour of the column.
const statusAnnouncements: Partial<Record<FeedbackStatus, (kind: Kind) => Omit<Announcement, "path">>> = {
  open: (kind) => ({ label: `New ${kind.name}`, color: kind.color }),
  planned: (kind) => ({ label: `${capital(kind.name)} added to the roadmap`, color: statusColors.planned }),
  in_progress: (kind) => ({ label: `Work started on this ${kind.name}`, color: statusColors.in_progress }),
  completed: (kind) => ({ label: kind.done, color: statusColors.completed }),
};

// A task an admin creates straight in a roadmap column: it is new there.
const createdAnnouncements: Partial<Record<FeedbackStatus, (kind: Kind) => Omit<Announcement, "path">>> = {
  planned: (kind) => ({ label: `New ${kind.task} on the roadmap, in To do`, color: statusColors.planned }),
  in_progress: (kind) => ({ label: `New ${kind.task} on the roadmap, already in progress`, color: statusColors.in_progress }),
  completed: (kind) => ({ label: `New ${kind.task} on the roadmap, already completed`, color: statusColors.completed }),
};

function announcementFor(status: FeedbackStatus, created: boolean, kind: Kind): Announcement | null {
  if (!paths[status]) return null;
  const make = (created ? createdAnnouncements[status] : undefined) ?? statusAnnouncements[status];
  return make ? { ...make(kind), path: paths[status] } : null;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const reportedLine = /\s*Reported on Discord by (.+?)\.?\s*$/;

async function reporterOf(item: FeedbackItem) {
  const author = (await authorsOf([item.id]))[item.id];
  if (author) return `<@${author.id}>`;
  const name = item.description.match(reportedLine)?.[1];
  if (!name) return null;
  return reporterIds[name] ? `<@${reporterIds[name]}>` : name;
}

export async function announceStatus(item: FeedbackItem) {
  const discord = process.env.DISCORD_WEBHOOK_URL;
  if (!discord) return;
  const [created, change] = await Promise.all([justCreated(item.id), changedBy(item.id)]);
  const { kind, platforms } = typeAndPlatforms(item.tags);
  const announcement = announcementFor(item.status, created, kind);
  if (!announcement) return;

  const reporter = await reporterOf(item);
  // The admin who approved it (now open) or moved it on the roadmap.
  const mover = !created && change && change.to === item.status ? change : null;
  const moverName = mover ? (/^\d+$/.test(mover.id) ? `<@${mover.id}>` : mover.name) : null;
  const description = item.description.replace(reportedLine, "");
  const place = places[item.status];
  const fields = [
    { name: "Type", value: kind.type, inline: true },
    { name: "Platform", value: clip(platforms.join(", ") || "Other", 1024), inline: true },
    place && { name: "Status", value: place, inline: true },
    { name: "Upvotes", value: String(item.voteCount), inline: true },
    reporter && { name: created ? "Added by" : kind.by, value: clip(reporter, 1024), inline: true },
    moverName && { name: item.status === "open" ? "Approved by" : "Moved by", value: clip(moverName, 1024), inline: true },
  ].filter(Boolean);
  const response = await fetch(discord, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...identity,
      allowed_mentions: { parse: [] },
      embeds: [
        {
          author: { name: announcement.label },
          title: clip(item.title, 256),
          url: `${siteUrl}${itemPath(announcement.path, { id: item.id, title: item.title })}`,
          description: description ? clip(description, 700) : undefined,
          color: announcement.color,
          fields: fields.length ? fields : undefined,
          footer: { text: "superpeople.dev" },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
  if (!response.ok) console.error(`[announce] Discord answered ${response.status} for ${item.id}`);
}
