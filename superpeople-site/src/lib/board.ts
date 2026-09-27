import type { FeedbackItem } from "reflet-sdk";
import type { IdeaType } from "@/i18n/types";

export type Category = { id: string; name: string; color: string };
export type TypeTag = { id: string; slug: IdeaType };
export type Viewer = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  admin: boolean;
  banned: boolean;
  canBan: boolean;
};

export type Author = { id?: string; name: string; username?: string; avatar?: string; admin?: boolean };

export type MediaView = { id: string; url: string; type: string; name: string };

export type CommentView = {
  id: string;
  body: string;
  createdAt: number;
  author: Author | null;
  replies: CommentView[];
};

export function categoryOf(item: FeedbackItem, categories: Category[]): Category | null {
  const tag = item.tags.find((t) => categories.some((c) => c.id === t.id));
  return tag ? { id: tag.id, name: tag.name, color: tag.color } : null;
}

export function typeOf(item: FeedbackItem, types: TypeTag[]): IdeaType {
  return types.find((type) => item.tags.some((tag) => tag.id === type.id))?.slug ?? "other";
}

export const doneAt = (item: FeedbackItem) => item.completedAt ?? item.updatedAt;
