import type { NextRequest } from "next/server";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import type { IdeaType } from "@/i18n/types";
import { apiUser } from "./apikeys";
import { boardOf, itemPath, type Category, type Permission, type TypeTag } from "./board";
import { siteUrl } from "./seo";
import { ideaTypes } from "./site";

// The developer API (app/api/dev): what agents use to keep the roadmap up to date (create tasks and
// ideas, move them, comment). Every call needs an admin's API key (lib/apikeys.ts); the answers are
// JSON and never cached. Documented in sp-docs/docs/ROADMAP-API.md and by GET /api/dev.

export const devJson = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const devError = (error: string, status: number, detail?: string) => devJson({ error, ...(detail && { detail }) }, status);

// The admin behind the key, or the answer to send: 401 without a working key, 403 without the permission.
export async function devUser(request: NextRequest, permission?: Permission) {
  const user = await apiUser(request);
  if (!user) {
    return { error: devError("auth", 401, "Send an admin's API key: Authorization: Bearer spk_... (admin panel, API tab). A revoked key, or one whose admin lost the API permission, stops working.") };
  }
  if (permission && !user.permissions.includes(permission)) {
    return { error: devError("forbidden", 403, `This needs the "${permission}" permission.`) };
  }
  return { user };
}

export const typeSlugs = ideaTypes.map((type) => type.slug) as IdeaType[];

// A platform by its id or its name ("game", "Launcher"); "other" or "none" is no platform (null).
// undefined when nothing matches.
export function platformOf(value: unknown, categories: Category[]): Category | null | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const wanted = value.trim().toLowerCase();
  if (wanted === "other" || wanted === "none") return null;
  return categories.find((category) => category.id === value.trim() || category.name.trim().toLowerCase() === wanted);
}

export type TaskView = {
  id: string;
  title: string;
  description: string;
  status: FeedbackStatus;
  type: IdeaType;
  platform: string | null;
  votes: number;
  comments: number;
  url: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export function taskView(item: FeedbackItem, tags: { categories: Category[]; types: TypeTag[] }): TaskView {
  const type = tags.types.find((entry) => item.tags.some((tag) => tag.id === entry.id))?.slug ?? "other";
  const platform = item.tags.find((tag) => tags.categories.some((category) => category.id === tag.id))?.name ?? null;
  const when = (ms: number | undefined) => (ms ? new Date(ms).toISOString() : null);
  return {
    id: item.id,
    title: item.title,
    description: item.description ?? "",
    status: item.status,
    type,
    platform,
    votes: item.voteCount ?? 0,
    comments: item.commentCount ?? 0,
    url: `${siteUrl}${itemPath(boardOf(item.status), item)}`,
    createdAt: when(item.createdAt) ?? "",
    updatedAt: when(item.updatedAt) ?? "",
    completedAt: when(item.completedAt),
  };
}

// Search words match with or without accents and case ("écran" finds "Ecran").
export const plainText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
