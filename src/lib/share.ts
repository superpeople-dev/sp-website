import { redirect } from "next/navigation";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import { localeHref, type Locale } from "@/i18n/config";
import { getIdea, safely } from "./reflet";
import type { SharedItem } from "./seo";

// Shared item links: /ideas?item=<id>, /roadmap?item=<id>, /completed?item=<id> open that item's dialog.

export type BoardPage = "/ideas" | "/roadmap" | "/completed";

export const itemParam = (value: string | string[] | undefined) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(value) ? value : null;

const pageOf = (status: FeedbackStatus): BoardPage =>
  status === "completed" ? "/completed" : status === "planned" || status === "in_progress" ? "/roadmap" : "/ideas";

// The item behind a shared link, for its link preview and to find its board. Null if it can't be read.
export const sharedItem = (id: string | null) => (id ? safely(() => getIdea(id, 60)) : Promise.resolve(null));

// A shared item that isn't on this board any more (an idea that moved to the roadmap, say): go to its board.
export async function followItem(lang: Locale, page: BoardPage, id: string | null, onBoard: (id: string) => boolean) {
  if (!id || onBoard(id)) return;
  const item = await sharedItem(id);
  if (!item) return;
  const target = pageOf(item.status);
  if (target !== page) redirect(`${localeHref(lang, target)}?item=${encodeURIComponent(id)}`);
}

// The text under a shared item's link preview: its description on one line, without the bot's
// "Reported on Discord by …" footer, cut to a preview's length.
export function itemPreview(item: FeedbackItem) {
  const text = item.description
    .replace(/\s*Reported on Discord by [\s\S]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 180 ? `${text.slice(0, 177).trimEnd()}…` : text;
}

// What pageMetadata() previews for a shared item; nothing for items that aren't public.
export const sharedPreview = (item: FeedbackItem | null): SharedItem | null =>
  item && item.status !== "under_review" && item.status !== "closed"
    ? { id: item.id, title: item.title, preview: itemPreview(item) }
    : null;
