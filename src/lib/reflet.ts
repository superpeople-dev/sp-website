import { randomBytes, randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";
import type { ChangelogEntry, Comment, CreateFeedbackResponse, FeedbackItem, FeedbackStatus, VoteResponse } from "reflet-sdk";
import type { IdeaType } from "@/i18n/types";
import { announceStatus } from "./announce";
import type { Category, TypeTag } from "./board";
import { dbReady, query } from "./db";
import { deleteObject, objectSize, objectsReady, viewLink, uploadLink } from "./objects";
import type { SessionUser } from "./session";
import { ideaTypes } from "./site";

// Bugs & Ideas, the roadmap and Completed: ideas, bug reports and tasks, their votes, comments, tags and
// images, in our own Postgres tables (db/migrations/002_board.sql) and object storage (lib/objects.ts).
// Reflet kept them until 02.10.2026; the functions and the shapes they answer are still Reflet's
// (reflet-sdk's FeedbackItem, Comment), so the pages, the launcher's routes and the developer API read
// them as before. Items that came from Reflet kept their ids.

export const refletReady = dbReady;
// The cache tag of the boards' reads (revalidateTag after a change).
export const refletTag = "reflet";

export class RefletRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const notFound = () => new RefletRequestError("Not found", 404);

// Public reads are cached as Reflet's answers were (tag "reflet", the same seconds). Outside Next (a
// script, a test) there is no cache to use: they run directly.
function cached<A extends unknown[], T>(name: string, seconds: number, load: (...args: A) => Promise<T>) {
  const wrapped = unstable_cache(load, [`board:${name}`], { revalidate: seconds, tags: [refletTag] });
  return (...args: A): Promise<T> => (process.env.NEXT_RUNTIME ? wrapped(...args) : load(...args));
}

// New ids look like the ones that came from Reflet: 32 lowercase letters and digits.
const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const newId = () => [...randomBytes(32)].map((byte) => alphabet[byte % 36]).join("");

// Who is asking, for "voted" and as the author of what they post: from their session, on the server
// only (the pages and routes make it with userToken and never send it out).
type Viewer = { id: string; name: string; avatar: string };
export async function userToken(user: SessionUser) {
  return Buffer.from(JSON.stringify({ id: user.id, name: user.name, avatar: user.avatar } satisfies Viewer)).toString("base64url");
}
function viewerOf(token?: string): Viewer | null {
  if (!token) return null;
  try {
    const viewer = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as Viewer;
    return typeof viewer?.id === "string" ? viewer : null;
  } catch {
    return null;
  }
}

// publication: "pending" while a new idea waits for review (only admins see it), else "approved".
export type Publication = "internal" | "pending" | "approved" | "rejected";
type Item = FeedbackItem & { publication: Publication };

type Row = {
  id: string;
  title: string;
  description: string;
  status: FeedbackStatus;
  publication: Publication;
  author_name: string | null;
  author_avatar: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  vote_count: number;
  comment_count: number;
  has_voted: boolean;
  tags: { id: string; name: string; color: string; slug: string | null }[];
};

// The columns of an item as FeedbackItem needs them; `viewer` is the parameter with the user id for
// hasVoted (or none).
const columns = (viewer: string | null) => `
  i.id, i.title, i.description, i.status, i.publication, i.author_name, i.author_avatar,
  i.created_at, i.updated_at, i.completed_at,
  i.imported_votes + (select count(*) from votes v where v.item_id = i.id)::int as vote_count,
  (select count(*) from comments c where c.item_id = i.id)::int as comment_count,
  ${viewer ? `exists (select 1 from votes v where v.item_id = i.id and v.user_id = ${viewer})` : "false"} as has_voted,
  coalesce((select json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color, 'slug', t.slug) order by t.position, t.name)
            from item_tags it join tags t on t.id = it.tag_id where it.item_id = i.id), '[]'::json) as tags`;

const toItem = (row: Row): Item => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  publication: row.publication,
  voteCount: row.vote_count,
  commentCount: row.comment_count,
  hasVoted: row.has_voted,
  isPinned: false,
  organizationStatus: null,
  tags: row.tags.map(({ slug, ...tag }) => (slug ? { ...tag, slug } : tag)),
  author: row.author_name ? { name: row.author_name, avatar: row.author_avatar ?? undefined, isExternal: true } : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at ?? undefined,
});

// Release notes: Reflet's changelog was never used (no entries), so there are none.
export const getChangelog = async (): Promise<ChangelogEntry[]> => [];

// Items in one column, newest first, as everyone sees them (not what waits for review); with a
// token, whether that user voted for each. pages: hundreds of items at most, as Reflet paged them.
async function readList(status: FeedbackStatus, limit: number, viewerId: string | null) {
  const rows = await query<Row>(
    `select ${columns(viewerId ? "$3" : null)} from items i
     where i.status = $1 and i.publication <> 'pending' order by i.created_at desc limit $2`,
    viewerId ? [status, limit, viewerId] : [status, limit],
  );
  return rows.map(toItem);
}
const cachedList = cached("list", 60, (status: FeedbackStatus, limit: number) => readList(status, limit, null));

export async function listByStatus(status: FeedbackStatus, pages = 10, token?: string): Promise<FeedbackItem[]> {
  const viewer = viewerOf(token);
  return viewer ? readList(status, pages * 100, viewer.id) : cachedList(status, pages * 100);
}

async function readItem(feedbackId: string, viewerId: string | null, anyPublication: boolean) {
  const [row] = await query<Row>(
    `select ${columns(viewerId ? "$2" : null)} from items i where i.id = $1 ${anyPublication ? "" : "and i.publication <> 'pending'"}`,
    viewerId ? [feedbackId, viewerId] : [feedbackId],
  );
  if (!row) throw notFound();
  return toItem(row);
}
const cachedItem = cached("item", 60, (feedbackId: string) => readItem(feedbackId, null, false));

// An item as everyone sees it (cache: kept that many seconds, as share.ts asks for 60).
export const getIdea = (feedbackId: string, cache?: number): Promise<FeedbackItem> =>
  cache ? cachedItem(feedbackId) : readItem(feedbackId, null, false);

// The item as one user sees it (hasVoted is theirs).
export const getIdeaFor = (feedbackId: string, token: string): Promise<FeedbackItem> =>
  readItem(feedbackId, viewerOf(token)?.id ?? null, false);

// The item even while it waits for review. For admins' actions and checks on the server only, never
// for what a page shows everyone.
export const getAnyIdea = (feedbackId: string): Promise<Item> => readItem(feedbackId, null, true);

// Ideas waiting for an admin's review.
export async function listPending(): Promise<FeedbackItem[]> {
  const rows = await query<Row>(`select ${columns(null)} from items i where i.status = 'under_review' order by i.created_at desc limit 100`);
  return rows.map(toItem);
}

// A user's upvote: given, or taken back if they had given it. Answers where they stand and the count.
export async function voteIdea(feedbackId: string, token: string): Promise<VoteResponse> {
  const viewer = viewerOf(token);
  if (!viewer) throw new RefletRequestError("Not signed in", 401);
  const [{ found }] = await query<{ found: boolean }>("select exists (select 1 from items where id = $1) as found", [feedbackId]);
  if (!found) throw notFound();
  const removed = await query("delete from votes where item_id = $1 and user_id = $2 returning 1", [feedbackId, viewer.id]);
  if (!removed.length) {
    await query("insert into votes (item_id, user_id, at) values ($1, $2, $3) on conflict do nothing", [feedbackId, viewer.id, Date.now()]);
  }
  const [{ count }] = await query<{ count: number }>(
    "select i.imported_votes + (select count(*) from votes v where v.item_id = i.id)::int as count from items i where i.id = $1",
    [feedbackId],
  );
  return { voted: removed.length === 0, voteCount: count };
}

// A new item, by the token's user, waiting for review (publication "pending") until an admin's action
// or the caller publishes it (setPublication), in the column the caller then sets (setStatus).
export async function createIdea(title: string, description: string, token: string, tagId?: string): Promise<CreateFeedbackResponse> {
  const viewer = viewerOf(token);
  const id = newId();
  const now = Date.now();
  await query(
    `insert into items (id, title, description, status, publication, author_id, author_name, author_avatar, created_at, updated_at)
     values ($1, $2, $3, 'under_review', 'pending', $4, $5, $6, $7, $7)`,
    [id, title, description, viewer?.id ?? null, viewer?.name ?? null, viewer?.avatar || null, now],
  );
  if (tagId) await query("insert into item_tags (item_id, tag_id) select $1, id from tags where id = $2 on conflict do nothing", [id, tagId]);
  return { feedbackId: id, isApproved: false };
}

const typeSlugs: readonly string[] = ideaTypes.map((type) => type.slug);

export const getTags = cached("tags", 300, async (): Promise<{ categories: Category[]; types: TypeTag[] }> => {
  const tags = await query<{ id: string; name: string; slug: string | null; color: string }>("select id, name, slug, color from tags order by position, name");
  return {
    categories: tags.filter((tag) => !typeSlugs.includes(tag.slug ?? "")).map(({ id, name, color }) => ({ id, name, color })),
    types: tags.filter((tag) => typeSlugs.includes(tag.slug ?? "")).map((tag) => ({ id: tag.id, slug: tag.slug as IdeaType })),
  };
});

// Moves an item to another column. A real change is posted on Discord (lib/announce.ts), as Reflet's
// webhook did. completedAt: when it was last moved to Completed.
export async function setStatus(feedbackId: string, status: FeedbackStatus) {
  const now = Date.now();
  const [row] = await query<{ before: FeedbackStatus }>(
    `with old as (select status from items where id = $1 for update)
     update items i set status = $2, updated_at = $3,
       completed_at = case when $2 = 'completed' then (case when old.status = 'completed' then i.completed_at else $3 end) else null end
     from old where i.id = $1 returning old.status as before`,
    [feedbackId, status, now],
  );
  if (!row) throw notFound();
  if (row.before !== status) {
    await getAnyIdea(feedbackId)
      .then(announceStatus)
      .catch((error) => console.error(`[board] announcing ${feedbackId} failed: ${error instanceof Error ? error.message : String(error)}`));
  }
}

export async function setPublication(feedbackId: string, state: Publication) {
  const updated = await query("update items set publication = $2 where id = $1 returning 1", [feedbackId, state]);
  if (!updated.length) throw notFound();
}

// Deletes an item for good, with its votes, comments and files.
export async function deleteIdea(feedbackId: string) {
  const files = await query<{ key: string }>("select key from media where item_id = $1", [feedbackId]);
  const deleted = await query("delete from items where id = $1 returning 1", [feedbackId]);
  if (!deleted.length) throw notFound();
  await Promise.all(files.map((file) => deleteObject(file.key).catch(() => null)));
}

export async function updateTags(feedbackId: string, addTagIds: string[], removeTagIds: string[]) {
  if (removeTagIds.length) await query("delete from item_tags where item_id = $1 and tag_id = any($2)", [feedbackId, removeTagIds]);
  if (addTagIds.length) {
    await query("insert into item_tags (item_id, tag_id) select $1, id from tags where id = any($2) on conflict do nothing", [feedbackId, addTagIds]);
  }
  await query("update items set updated_at = $2 where id = $1", [feedbackId, Date.now()]);
}

export async function updateIdea(feedbackId: string, title: string, description: string) {
  const updated = await query("update items set title = $2, description = $3, updated_at = $4 where id = $1 returning 1", [
    feedbackId,
    title,
    description,
    Date.now(),
  ]);
  if (!updated.length) throw notFound();
}

// Images and videos on a post (lib/objects.ts), oldest first, each with a link that works for an hour.
export type RefletMedia = { _id: string; url: string | null; mimeType: string; filename: string; createdAt: number };

export async function listMedia(feedbackId: string): Promise<RefletMedia[]> {
  const rows = await query<{ id: string; key: string; mime_type: string; filename: string; created_at: number }>(
    "select id, key, mime_type, filename, created_at from media where item_id = $1 order by created_at",
    [feedbackId],
  );
  return rows.map((row) => ({
    _id: row.id,
    url: objectsReady ? viewLink(row.key) : null,
    mimeType: row.mime_type,
    filename: row.filename,
    createdAt: row.created_at,
  }));
}

// Where the browser uploads one file for this item (a PUT with its Content-Type), and the key to
// give saveMedia afterwards.
export async function mediaUploadUrl(feedbackId: string) {
  const storageId = `items/${feedbackId}/${randomUUID()}`;
  return { uploadUrl: uploadLink(storageId), storageId };
}

export const isMediaKey = (feedbackId: string, storageId: string) =>
  storageId.startsWith(`items/${feedbackId}/`) && /^[0-9a-f-]{36}$/.test(storageId.slice(`items/${feedbackId}/`.length));

// Records a file the browser uploaded (it must be there, under a key mediaUploadUrl gave for this item).
export async function saveMedia(feedbackId: string, storageId: string, mimeType: string, size: number, filename: string) {
  if (!isMediaKey(feedbackId, storageId)) throw new RefletRequestError("Not an upload of this item", 400);
  const stored = await objectSize(storageId);
  if (stored === null) throw new RefletRequestError("The file was not uploaded", 400);
  await query(
    "insert into media (id, item_id, key, mime_type, filename, size, created_at) values ($1, $2, $3, $4, $5, $6, $7)",
    [newId(), feedbackId, storageId, mimeType, filename, stored || size, Date.now()],
  );
}

export async function deleteMedia(mediaId: string) {
  const [row] = await query<{ key: string }>("delete from media where id = $1 returning key", [mediaId]);
  if (!row) throw notFound();
  await deleteObject(row.key).catch((error) => console.error(`[board] media ${mediaId}: ${error instanceof Error ? error.message : String(error)}`));
}

// Comments, oldest first (no replies: none were ever made).
export async function listComments(feedbackId: string): Promise<Comment[]> {
  const rows = await query<{ id: string; body: string; author_name: string | null; author_avatar: string | null; is_official: boolean; created_at: number; updated_at: number }>(
    "select id, body, author_name, author_avatar, is_official, created_at, updated_at from comments where item_id = $1 order by created_at, id",
    [feedbackId],
  );
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    author: row.author_name ? { name: row.author_name, avatar: row.author_avatar ?? undefined, isExternal: true } : null,
    isOfficial: row.is_official,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    replies: [],
  }));
}

export async function addComment(feedbackId: string, body: string, token: string) {
  const viewer = viewerOf(token);
  const id = newId();
  const now = Date.now();
  const added = await query(
    `insert into comments (id, item_id, author_id, author_name, author_avatar, body, created_at, updated_at)
     select $1, i.id, $3, $4, $5, $6, $7, $7 from items i where i.id = $2 returning 1`,
    [id, feedbackId, viewer?.id ?? null, viewer?.name ?? null, viewer?.avatar || null, body, now],
  );
  if (!added.length) throw notFound();
  return id;
}

export async function deleteComment(commentId: string) {
  await query("delete from comments where id = $1", [commentId]);
}

// A failed board action, answered to the browser or the launcher. The error code stays "reflet": the
// launcher's messages know it.
export function failure(action: string, error: unknown) {
  const status = error instanceof RefletRequestError ? error.status : 0;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[board] ${action} failed${status ? ` (${status})` : ""}: ${message}`);
  return Response.json({ error: "reflet" }, { status: status >= 400 && status !== 401 && status !== 403 ? status : 502 });
}

export async function safely<T>(load: () => Promise<T>): Promise<T | null> {
  if (!refletReady) return null;
  try {
    return await load();
  } catch (error) {
    const status = error instanceof RefletRequestError ? ` (${error.status})` : "";
    console.error(`[board] request failed${status}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
