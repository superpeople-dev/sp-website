import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import { itemPath } from "@/lib/board";
import { capital, typeAndPlatforms, type Kind } from "@/lib/kinds";
import { getIdea, refletTag } from "@/lib/reflet";
import { reporterIds } from "@/lib/reporters";
import { siteUrl } from "@/lib/seo";
import { authorsOf, changedBy, justCreated } from "@/lib/store";

type Payload = { event?: string; data?: { feedback?: Partial<FeedbackItem> } };
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

function verified(body: string, signature: string | null) {
  const secret = process.env.REFLET_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// A task an admin creates straight in a roadmap column arrives as a status change too: it is new there.
const createdAnnouncements: Partial<Record<FeedbackStatus, (kind: Kind) => Omit<Announcement, "path">>> = {
  planned: (kind) => ({ label: `New ${kind.task} on the roadmap, in To do`, color: statusColors.planned }),
  in_progress: (kind) => ({ label: `New ${kind.task} on the roadmap, already in progress`, color: statusColors.in_progress }),
  completed: (kind) => ({ label: `New ${kind.task} on the roadmap, already completed`, color: statusColors.completed }),
};

function announcementFor(event: string | undefined, status: FeedbackStatus | undefined, created: boolean, kind: Kind): Announcement | null {
  if (event !== "feedback.status_changed" || !status || !paths[status]) return null;
  const make = (created ? createdAnnouncements[status] : undefined) ?? statusAnnouncements[status];
  return make ? { ...make(kind), path: paths[status] } : null;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const reportedLine = /\s*Reported on Discord by (.+?)\.?\s*$/;

async function reporterOf(feedback: Partial<FeedbackItem>) {
  const author = feedback.id ? (await authorsOf([feedback.id]))[feedback.id] : undefined;
  if (author) return `<@${author.id}>`;
  const name = feedback.description?.match(reportedLine)?.[1];
  if (!name) return null;
  return reporterIds[name] ? `<@${reporterIds[name]}>` : name;
}

async function votesOf(feedback: Partial<FeedbackItem>) {
  if (typeof feedback.voteCount === "number") return feedback.voteCount;
  if (!feedback.id) return null;
  return (await getIdea(feedback.id).catch(() => null))?.voteCount ?? null;
}

export async function POST(request: Request) {
  const body = await request.text();
  if (!verified(body, request.headers.get("x-reflet-signature"))) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: Payload;
  try {
    payload = JSON.parse(body) as Payload;
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  revalidateTag(refletTag, { expire: 0 });

  const discord = process.env.DISCORD_WEBHOOK_URL;
  const feedback = payload.data?.feedback;
  const created = payload.event === "feedback.status_changed" && feedback?.id ? await justCreated(feedback.id) : false;
  const { kind, platforms } = typeAndPlatforms(feedback?.tags ?? []);
  const announcement = announcementFor(payload.event, feedback?.status, created, kind);
  if (!discord || !feedback?.title || !announcement) return Response.json({ ok: true });

  const [reporter, votes, change] = await Promise.all([reporterOf(feedback), votesOf(feedback), feedback.id ? changedBy(feedback.id) : null]);
  // The admin who approved it (now open) or moved it on the roadmap, when that was done on the site.
  const mover = !created && change && change.to === feedback.status ? change : null;
  const moverName = mover ? (/^\d+$/.test(mover.id) ? `<@${mover.id}>` : mover.name) : null;
  const description = feedback.description?.replace(reportedLine, "");
  const place = feedback.status ? places[feedback.status] : undefined;
  const fields = [
    { name: "Type", value: kind.type, inline: true },
    { name: "Platform", value: clip(platforms.join(", ") || "Other", 1024), inline: true },
    place && { name: "Status", value: place, inline: true },
    votes !== null && { name: "Upvotes", value: String(votes), inline: true },
    reporter && { name: created ? "Added by" : kind.by, value: clip(reporter, 1024), inline: true },
    moverName && { name: feedback.status === "open" ? "Approved by" : "Moved by", value: clip(moverName, 1024), inline: true },
  ].filter(Boolean);
  const response = await fetch(discord, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "SUPER PEOPLE Revival",
      allowed_mentions: { parse: [] },
      embeds: [
        {
          author: { name: announcement.label },
          title: clip(feedback.title, 256),
          url: `${siteUrl}${feedback.id ? itemPath(announcement.path, { id: feedback.id, title: feedback.title }) : announcement.path}`,
          description: description ? clip(description, 700) : undefined,
          color: announcement.color,
          fields: fields.length ? fields : undefined,
          footer: { text: "superpeople.dev" },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  return response.ok ? Response.json({ ok: true }) : Response.json({ error: "discord" }, { status: 502 });
}
