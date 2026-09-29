import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { FeedbackItem } from "reflet-sdk";
import { localeHref, type Locale } from "@/i18n/config";
import { boardOf, itemPath, shownName, slugOf, type BoardPath } from "./board";
import { getIdea, safely } from "./reflet";
import type { SharedItem } from "./seo";
import { authorsOf, downvoteCounts } from "./store";

// Item pages: /bugs-and-ideas/<id>/<slug>, /roadmap/<id>/<slug>, /completed/<id>/<slug> show that board with
// the item's dialog open, and have the item's own title, description and preview image.

export type BoardPage = BoardPath;

const idPattern = /^[A-Za-z0-9_-]{6,64}$/;

export const pageOf = boardOf;

const isPublic = (item: FeedbackItem) => item.status !== "under_review" && item.status !== "closed";

// The item behind an item page or a preview image. Null if it can't be read.
export const sharedItem = (id: string | null | undefined) =>
  id && idPattern.test(id) ? safely(() => getIdea(id, 60)) : Promise.resolve(null);

// Emoji and what glues them together (skin tones, variation selectors, joiners, keycaps, flags).
const emoji = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200D\uFE0F\u20E3]/gu;

// The text under an item's link preview (and in its image): its description on one line, without the
// bot's "Reported on Discord by …" footer or emoji, with a capital first letter, cut to a preview's length.
export function itemPreview(item: FeedbackItem, length = 180) {
  const text = item.description
    .replace(/\s*Reported on Discord by [\s\S]+$/, "")
    .replace(emoji, "")
    .replace(/\s+/g, " ")
    .trim();
  const capital = text.charAt(0).toUpperCase() + text.slice(1);
  if (capital.length <= length) return capital;
  // Cut after a whole word ("doesn't seem to be…", not "workin…"); text without spaces (CJK) anywhere.
  const cut = capital.slice(0, length - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > length * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:-]+$/, "")}…`;
}

const reporter = /\s*Reported on Discord by (.+?)\.?\s*$/;

// What pageMetadata() and pageStructuredData() need for an item page; nothing for items that aren't
// public. The author is who posted it on the site, or who reported it on Discord (the bot's footer).
export async function sharedPreview(item: FeedbackItem | null): Promise<SharedItem | null> {
  if (!item || !isPublic(item)) return null;
  const [down, authors] = await Promise.all([downvoteCounts([item.id]), authorsOf([item.id])]);
  const profile = authors[item.id];
  return {
    id: item.id,
    title: item.title,
    slug: slugOf(item.title),
    preview: itemPreview(item),
    text: item.description.replace(reporter, "").replace(emoji, "").trim(),
    score: item.voteCount - (down[item.id] ?? 0),
    comments: item.commentCount,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    author: profile ? shownName(profile.name, profile.username) : (item.description.match(reporter)?.[1] ?? null),
  };
}

// An item page's item, read once per request for both its metadata and the page.
export const sharedPage = cache(async (id: string | undefined) => sharedPreview(await sharedItem(id)));

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
