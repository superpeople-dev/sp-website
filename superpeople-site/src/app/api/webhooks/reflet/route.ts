import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import { refletTag } from "@/lib/reflet";
import { siteUrl } from "@/lib/seo";

type Payload = { event?: string; data?: { feedback?: Partial<FeedbackItem> } };
type Announcement = { label: string; color: number; path: string };

const statusAnnouncements: Partial<Record<FeedbackStatus, Announcement>> = {
  open: { label: "New idea", color: 0x8fb0ff, path: "/ideas" },
  planned: { label: "Added to the roadmap", color: 0xf0b719, path: "/roadmap" },
  in_progress: { label: "Now in progress", color: 0xef4438, path: "/roadmap" },
  completed: { label: "Completed", color: 0x3ddc84, path: "/completed" },
};

function verified(body: string, signature: string | null) {
  const secret = process.env.REFLET_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function announcementFor(event: string | undefined, status: FeedbackStatus | undefined) {
  return event === "feedback.status_changed" && status ? (statusAnnouncements[status] ?? null) : null;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

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
  const announcement = announcementFor(payload.event, feedback?.status);
  if (!discord || !feedback?.title || !announcement) return Response.json({ ok: true });

  const categories = (feedback.tags ?? []).map((tag) => tag.name).join(", ");
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
          url: `${siteUrl}${announcement.path}`,
          description: feedback.description ? clip(feedback.description, 400) : undefined,
          color: announcement.color,
          fields: categories ? [{ name: "Category", value: clip(categories, 1024), inline: true }] : undefined,
          footer: { text: "superpeople.dev" },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  return response.ok ? Response.json({ ok: true }) : Response.json({ error: "discord" }, { status: 502 });
}
