import { notFound, redirect } from "next/navigation";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import { localeHref, type Locale } from "@/i18n/config";
import { itemPath, slugOf } from "./board";
import { getIdea, safely } from "./reflet";
import type { SharedItem } from "./seo";
import { downvoteCounts } from "./store";

// Item pages: /ideas/<id>/<slug>, /roadmap/<id>/<slug>, /completed/<id>/<slug> show that board with
// the item's dialog open, and have the item's own title, description and preview image.

export type BoardPage = "/ideas" | "/roadmap" | "/completed";

const idPattern = /^[A-Za-z0-9_-]{6,64}$/;

export const pageOf = (status: FeedbackStatus): BoardPage =>
  status === "completed" ? "/completed" : status === "planned" || status === "in_progress" ? "/roadmap" : "/ideas";

const isPublic = (item: FeedbackItem) => item.status !== "under_review" && item.status !== "closed";

// The item behind an item page or a preview image. Null if it can't be read.
export const sharedItem = (id: string | null | undefined) =>
  id && idPattern.test(id) ? safely(() => getIdea(id, 60)) : Promise.resolve(null);

// The text under an item's link preview: its description on one line, without the bot's
// "Reported on Discord by …" footer, cut to a preview's length.
export function itemPreview(item: FeedbackItem, length = 180) {
  const text = item.description
    .replace(/\s*Reported on Discord by [\s\S]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text;
}

// What pageMetadata() needs for an item page; nothing for items that aren't public.
export async function sharedPreview(item: FeedbackItem | null): Promise<SharedItem | null> {
  if (!item || !isPublic(item)) return null;
  const down = (await downvoteCounts([item.id]))[item.id] ?? 0;
  return { id: item.id, title: item.title, slug: slugOf(item.title), preview: itemPreview(item), up: item.voteCount, down };
}

// An item page's id and slug from the route ([[...item]]): none, or <id> and an optional slug.
export function itemSegments(segments: string[] | undefined) {
  if (!segments?.length) return null;
  if (segments.length > 2 || !idPattern.test(segments[0])) notFound();
  return { id: segments[0], slug: segments[1] ?? "" };
}

// Before showing an item page: an item on another board (an idea that moved to the roadmap, say) or
// with an outdated slug goes to its right address, and one that doesn't exist (or isn't public and
// not on this board) is a 404. Old ?item=<id> links go to the item's page too.
export async function settleItem(
  lang: Locale,
  page: BoardPage,
  wanted: { id: string; slug: string } | null,
  onBoard: (id: string) => FeedbackItem | undefined,
) {
  if (!wanted) return;
  const here = onBoard(wanted.id);
  const item = here ?? (await sharedItem(wanted.id));
  if (!item) notFound();
  const target = here ? page : pageOf(item.status);
  if (!here && (target === page || !isPublic(item))) notFound();
  if (target !== page || wanted.slug !== slugOf(item.title)) redirect(itemPath(localeHref(lang, target), item));
}
