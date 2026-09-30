import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import type { IdeaType } from "@/i18n/types";

export type Category = { id: string; name: string; color: string };
export type TypeTag = { id: string; slug: IdeaType };

// What an admin may do. Owners (lib/admins.ts) have everything and are the only ones who manage the
// other admins; each other admin has the permissions an owner gave them (lib/staff.ts).
export type Permission = "review" | "manage" | "comments" | "bans";
export const allPermissions: Permission[] = ["review", "manage", "comments", "bans"];

export type Viewer = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  admin: boolean;
  owner: boolean;
  permissions: Permission[];
  banned: boolean;
  canBan: boolean;
  // Their Discord name has words that aren't allowed (lib/moderation.ts): they can't post or comment.
  nameBlocked: boolean;
};

export const can = (viewer: Pick<Viewer, "permissions"> | null | undefined, permission: Permission) =>
  viewer?.permissions.includes(permission) === true;

export type Author = { id?: string; name: string; username?: string; avatar?: string; admin?: boolean; banned?: boolean };

export type MediaView = { id: string; url: string; type: string; name: string };

export type CommentView = {
  id: string;
  body: string;
  createdAt: number;
  author: Author | null;
  // Written by the viewer, who may delete it.
  mine?: boolean;
  replies: CommentView[];
};

// A notification (the bell in the account bar): an admin assigned you a task, or someone mentioned
// you in a comment (text: the comment).
export type Notice = {
  id: string;
  type: "assigned" | "mention";
  at: number;
  actor: { name: string; avatar?: string };
  item: { id: string; title: string; status?: FeedbackStatus };
  text?: string;
};

// Someone a comment can @mention on an item (lib/mentions.ts).
export type Mention = { username: string; name: string; avatar?: string; admin: boolean };

// The board an item is on, by status.
export type BoardPath = "/bugs-and-ideas" | "/roadmap" | "/completed";
export const boardOf = (status: FeedbackStatus): BoardPath =>
  status === "completed" ? "/completed" : status === "planned" || status === "in_progress" ? "/roadmap" : "/bugs-and-ideas";

// One line of the admins' activity log (lib/events.ts): what happened in the community, who did it
// and to what.
export type EventType =
  | "idea.posted"
  | "idea.approved"
  | "idea.rejected"
  | "item.created"
  | "item.moved"
  | "item.edited"
  | "item.deleted"
  | "item.assigned"
  | "item.unassigned"
  | "comment.posted"
  | "comment.deleted"
  | "comments.off"
  | "comments.on"
  | "media.deleted"
  | "user.banned"
  | "user.unbanned"
  | "staff.added"
  | "staff.changed"
  | "staff.removed";

// The activity log's periods.
export const eventRanges = ["24h", "7d", "30d", "all"] as const;
export type EventRange = (typeof eventRanges)[number];

export type ActivityEvent = {
  id: string;
  at: number;
  type: EventType;
  actor: { id: string; name: string; avatar?: string };
  item?: { id: string; title: string; status?: FeedbackStatus };
  // The other person: the banned user, the admin who was changed, a deleted comment's author, the
  // admin an item was assigned to.
  user?: { id: string; name: string };
  // A comment's text (also kept once it is deleted), a new idea's description.
  text?: string;
  // What an idea is (its type tag) and the platform it is about, named in its Discord posts.
  kind?: IdeaType;
  platform?: string;
  // Where an item was moved.
  to?: FeedbackStatus;
  // The people a comment mentions (lib/mentions.ts): its Discord post pings them.
  mentions?: { id: string; name: string }[];
  permissions?: Permission[];
};

export function categoryOf(item: FeedbackItem, categories: Category[]): Category | null {
  const tag = item.tags.find((t) => categories.some((c) => c.id === t.id));
  return tag ? { id: tag.id, name: tag.name, color: tag.color } : null;
}

export function typeOf(item: FeedbackItem, types: TypeTag[]): IdeaType {
  return types.find((type) => item.tags.some((tag) => tag.id === type.id))?.slug ?? "other";
}

export const doneAt = (item: FeedbackItem) => item.completedAt ?? item.updatedAt;

// Characters that draw nothing: spaces, controls, format and unassigned code points, and the blank
// "letters" (Hangul fillers, blank braille, Khmer inherent vowels) people use for an invisible Discord name.
const invisible = /[\s\p{Cc}\p{Cf}\p{Cn}\p{Co}\u115F\u1160\u17B4\u17B5\u2800\u3164\uFFA0]/gu;

// The name to show: the display name, or when it is invisible the username with a capital first letter
// ("Gigeop", then "@gigeop" next to it).
export const shownName = (name: string, username?: string) => {
  if (name.replace(invisible, "") || !username) return name;
  return username.charAt(0).toUpperCase() + username.slice(1);
};

// Items as the boards show them: voteCount is upvotes (Reflet) minus downvotes (lib/store.ts), and
// hasDownvoted says whether the viewer downvoted (hasVoted stays "upvoted").
export type BoardItem = FeedbackItem & { hasDownvoted?: boolean; authorBanned?: boolean };
export type VoteDirection = "up" | "down";
export const downvoted = (item: FeedbackItem) => (item as BoardItem).hasDownvoted === true;

// Item pages are /bugs-and-ideas/<id>/<slug> (or /roadmap/…, /completed/…), like Reddit: the id finds the
// item, the slug is the title for people and search engines (plain a-z and digits, may be empty).
export const slugOf = (title: string) =>
  title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");

export const itemPath = (base: string, item: { id: string; title: string }) => {
  const slug = slugOf(item.title);
  return `${base}/${item.id}${slug ? `/${slug}` : ""}`;
};
