import type { NextRequest } from "next/server";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import { can } from "@/lib/board";
import { devError, devJson, devUser, plainText, platformOf, taskView, typeSlugs } from "@/lib/devapi";
import { failure, getTags, listByStatus, listPending } from "@/lib/reflet";
import { checkNewTask, createTask, statuses } from "@/lib/tasks";

const defaultStatuses: FeedbackStatus[] = ["open", "planned", "in_progress"];
const defaultLimit = 50;
const maxLimit = 500;

// GET: items by status, newest change first, filtered by type, platform and search words.
export async function GET(request: NextRequest) {
  const { user, error } = await devUser(request);
  if (error) return error;
  const params = request.nextUrl.searchParams;
  const asked = params.get("status");
  const wanted = asked === "all" ? statuses : asked ? (asked.split(",").map((s) => s.trim()) as FeedbackStatus[]) : defaultStatuses;
  if (!wanted.length || wanted.some((status) => !statuses.includes(status))) {
    return devError("invalid", 400, `status is "all" or a comma list of: ${statuses.join(", ")}`);
  }
  const type = params.get("type");
  if (type && !typeSlugs.includes(type as (typeof typeSlugs)[number])) return devError("invalid", 400, `type is one of: ${typeSlugs.join(", ")}`);
  const limit = Math.min(maxLimit, Math.max(1, Number(params.get("limit")) || defaultLimit));
  const words = plainText(params.get("q") ?? "").split(/\s+/).filter(Boolean);
  try {
    const tags = await getTags();
    const platformParam = params.get("platform");
    const platform = platformParam ? platformOf(platformParam, tags.categories) : undefined;
    if (platformParam && platform === undefined) return devError("invalid", 400, "platform is a platform id or name from GET /api/dev/meta, or other");
    // Ideas waiting for review only for admins who review them, as on the site.
    const lists = await Promise.all(
      wanted.map((status): Promise<FeedbackItem[]> =>
        status === "under_review" ? (can(user, "review") ? listPending() : Promise.resolve([])) : listByStatus(status),
      ),
    );
    const views = lists
      .flat()
      .map((item) => taskView(item, tags))
      .filter((item) => !type || item.type === type)
      .filter((item) => platform === undefined || item.platform === (platform?.name ?? null))
      .filter((item) => {
        const text = plainText(`${item.title} ${item.description}`);
        return words.every((word) => text.includes(word));
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return devJson({ total: views.length, items: views.slice(0, limit) });
  } catch (err) {
    return failure("dev list", err);
  }
}

// POST: a new item, as the key's admin ("manage").
export async function POST(request: NextRequest) {
  const { user, error } = await devUser(request, "manage");
  if (error) return error;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return devError("invalid", 400, "The body is JSON.");
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const task = { title: text(body.title), description: text(body.description), status: text(body.status) as FeedbackStatus };
  const problem = checkNewTask(task);
  if (problem === "title") return devError("invalid", 400, "title is 3 to 100 characters");
  if (problem === "description") return devError("invalid", 400, "description is at most 2000 characters");
  if (problem === "status") return devError("invalid", 400, "status is open, planned, in_progress or completed");
  if (!typeSlugs.includes(body.type as (typeof typeSlugs)[number])) return devError("invalid", 400, `type is one of: ${typeSlugs.join(", ")}`);
  try {
    const tags = await getTags();
    const platform = platformOf(body.platform, tags.categories);
    if (platform === undefined) return devError("invalid", 400, "platform is a platform id or name from GET /api/dev/meta, or other");
    const item = await createTask(user, { ...task, type: body.type as string, platform: platform?.id });
    return devJson({ item: taskView(item, tags) }, 201);
  } catch (err) {
    return failure("dev create", err);
  }
}
