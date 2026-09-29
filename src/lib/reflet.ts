import type {
  ChangelogEntry,
  Comment,
  CreateFeedbackResponse,
  FeedbackItem,
  FeedbackListResponse,
  FeedbackStatus,
  VoteResponse,
} from "reflet-sdk";
import { signUser } from "reflet-sdk/server";
import type { IdeaType } from "@/i18n/types";
import type { Category, TypeTag } from "./board";
import { ideaTypes } from "./site";
import type { SessionUser } from "./session";

const apiUrl = process.env.REFLET_API_URL ?? "https://harmless-clam-802.convex.site";
const publicKey = process.env.NEXT_PUBLIC_REFLET_PUBLIC_KEY ?? "";
const secretKey = process.env.REFLET_SECRET_KEY ?? "";

export const refletReady = publicKey.length > 0;
export const refletTag = "reflet";

type OrgStatus = { id: string; name: string };

export class RefletRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type CallOptions = { method?: "GET" | "POST"; body?: unknown; token?: string; admin?: boolean; cache?: number };

async function call<T>(path: string, { method = "GET", body, token, admin, cache }: CallOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${admin ? secretKey : publicKey}`,
    "Content-Type": "application/json",
  };
  if (token) headers["X-User-Token"] = token;
  const cached = method === "GET" && !token && cache !== undefined;
  const send = () =>
    fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(cached ? { cache: "force-cache", next: { revalidate: cache, tags: [refletTag] } } : { cache: "no-store" }),
    });
  let response = await send();
  // Many reads at once (a build renders every page together) can make Reflet answer 500 while it
  // updates the key's usage; reads are safe to repeat, so try those twice more.
  for (let retry = 1; method === "GET" && response.status >= 500 && retry <= 2; retry++) {
    await new Promise((resolve) => setTimeout(resolve, 400 * retry));
    response = await send();
  }
  const text = await response.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new RefletRequestError("Invalid response from Reflet", 502);
  }
  if (!response.ok) {
    const error = (data as { error?: unknown }).error;
    throw new RefletRequestError(typeof error === "string" ? error : `Reflet returned ${response.status}`, response.status);
  }
  return data as T;
}

export const getChangelog = () => call<ChangelogEntry[]>("/api/v1/feedback/changelog?limit=30", { cache: 60 });

export const listIdeas = (token?: string) =>
  call<FeedbackListResponse>("/api/v1/feedback/list?sortBy=votes&limit=100", { token, cache: token ? undefined : 60 });

export async function listByStatus(status: FeedbackStatus, pages = 10, token?: string) {
  const items: FeedbackItem[] = [];
  for (let page = 0; page < pages; page++) {
    const result = await call<FeedbackListResponse>(
      `/api/v1/feedback/list?status=${status}&sortBy=newest&limit=100&offset=${page * 100}`,
      { token, cache: token ? undefined : 60 },
    );
    items.push(...result.items);
    if (!result.hasMore) break;
  }
  return items;
}

export const voteIdea = (feedbackId: string, token: string) =>
  call<VoteResponse>("/api/v1/feedback/vote", { method: "POST", body: { feedbackId, voteType: "upvote" }, token });

export const createIdea = (title: string, description: string, token: string, tagId?: string) =>
  call<CreateFeedbackResponse>("/api/v1/feedback/create", {
    method: "POST",
    body: { title, description, ...(tagId && { tagId }) },
    token,
  });

type RefletTag = Category & { slug?: string };

const typeSlugs: readonly string[] = ideaTypes.map((type) => type.slug);

export async function getTags(): Promise<{ categories: Category[]; types: TypeTag[] }> {
  const tags = await call<RefletTag[]>("/api/v1/admin/tags", { admin: true, cache: 300 });
  return {
    categories: tags.filter((tag) => !typeSlugs.includes(tag.slug ?? "")).map(({ id, name, color }) => ({ id, name, color })),
    types: tags.filter((tag) => typeSlugs.includes(tag.slug ?? "")).map((tag) => ({ id: tag.id, slug: tag.slug as IdeaType })),
  };
}


const statusKey = (name: string) => name.toLowerCase().replace(/[\s_-]/g, "");
const statusAliases: Record<string, FeedbackStatus> = {
  open: "open",
  underreview: "under_review",
  planned: "planned",
  inprogress: "in_progress",
  completed: "completed",
  done: "completed",
  closed: "closed",
};

export async function setStatus(feedbackId: string, status: FeedbackStatus) {
  const statuses = await call<OrgStatus[]>("/api/v1/admin/statuses", { admin: true, cache: 300 }).catch(() => []);
  const match = statuses.find((s) => statusAliases[statusKey(s.name)] === status);
  return call("/api/v1/admin/feedback/set-status", {
    method: "POST",
    admin: true,
    body: { feedbackId, status, ...(match && { statusId: match.id }) },
  });
}

export const deleteIdea = (feedbackId: string) =>
  call("/api/v1/admin/feedback/delete", { method: "POST", admin: true, body: { feedbackId } });

export const listPending = async () => {
  const { items } = await call<FeedbackListResponse>("/api/v1/feedback/list?status=under_review&sortBy=newest&limit=100");
  return items;
};

export type RefletMedia = { _id: string; url: string | null; mimeType: string; filename: string; createdAt: number };

export const listMedia = (feedbackId: string) =>
  call<RefletMedia[]>(`/api/v1/admin/screenshots?feedbackId=${encodeURIComponent(feedbackId)}`, { admin: true });

export const mediaUploadUrl = async () =>
  (await call<{ uploadUrl: string }>("/api/v1/feedback/screenshot/upload-url", { method: "POST", admin: true, body: {} }))
    .uploadUrl;

export const saveMedia = (feedbackId: string, storageId: string, mimeType: string, size: number, filename: string) =>
  call("/api/v1/feedback/screenshot/save", {
    method: "POST",
    admin: true,
    body: { feedbackId, storageId, mimeType, size, filename, captureSource: "widget" },
  });

export const deleteMedia = (screenshotId: string) =>
  call("/api/v1/admin/screenshot/delete", { method: "POST", admin: true, body: { screenshotId } });

export const getIdea = (feedbackId: string) =>
  call<FeedbackItem>(`/api/v1/feedback/item?id=${encodeURIComponent(feedbackId)}`);

export const updateTags = (feedbackId: string, addTagIds: string[], removeTagIds: string[]) =>
  call("/api/v1/admin/feedback/update-tags", { method: "POST", admin: true, body: { feedbackId, addTagIds, removeTagIds } });

export const updateIdea = (feedbackId: string, title: string, description: string) =>
  call("/api/v1/admin/feedback/update", { method: "POST", admin: true, body: { feedbackId, title, description } });

export const listComments = (feedbackId: string) =>
  call<Comment[]>(`/api/v1/feedback/comments?feedbackId=${encodeURIComponent(feedbackId)}&sortBy=oldest`);

export async function addComment(feedbackId: string, body: string, token: string) {
  const result = await call<{ id?: string; commentId?: string }>("/api/v1/feedback/comment", {
    method: "POST",
    body: { feedbackId, body },
    token,
  });
  const id = result.id ?? result.commentId;
  if (!id) throw new RefletRequestError("Reflet did not return a comment id", 502);
  return id;
}

export const deleteComment = (commentId: string) =>
  call("/api/v1/admin/comment/delete", { method: "POST", admin: true, body: { commentId } });

export async function userToken(user: SessionUser) {
  const { token } = await signUser({ id: `discord:${user.id}`, name: user.name, avatar: user.avatar }, secretKey, 3600);
  return token;
}

export function failure(action: string, error: unknown) {
  const status = error instanceof RefletRequestError ? error.status : 0;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[reflet] ${action} failed${status ? ` (${status})` : ""}: ${message}`);
  if (status === 401 && message.includes("User identification")) {
    console.error(
      "[reflet] Reflet rejected the signed player token. REFLET_SECRET_KEY must be the current secret of the same Reflet API key as NEXT_PUBLIC_REFLET_PUBLIC_KEY.",
    );
  }
  return Response.json({ error: "reflet" }, { status: status >= 400 && status !== 401 && status !== 403 ? status : 502 });
}

export async function safely<T>(load: () => Promise<T>): Promise<T | null> {
  if (!refletReady) return null;
  try {
    return await load();
  } catch (error) {
    const status = error instanceof RefletRequestError ? ` (${error.status})` : "";
    console.error(`[reflet] request failed${status}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
