import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import { can } from "@/lib/board";
import { assigneeFrom, assignments, devError, devJson, devUser, platformOf, taskView, typeSlugs } from "@/lib/devapi";
import { logEvent } from "@/lib/events";
import { failure, getIdea, getTags, refletTag, RefletRequestError } from "@/lib/reflet";
import type { StaffMember } from "@/lib/staff";
import { assignTask, editTask, moveTask, statuses } from "@/lib/tasks";

type Context = RouteContext<"/api/dev/items/[id]">;

async function itemOr404(id: string): Promise<FeedbackItem | Response> {
  try {
    return await getIdea(id);
  } catch (err) {
    if (err instanceof RefletRequestError && err.status === 404) return devError("not_found", 404, "No item with this id.");
    throw err;
  }
}

export async function GET(request: NextRequest, { params }: Context) {
  const { error } = await devUser(request);
  if (error) return error;
  const { id } = await params;
  try {
    const item = await itemOr404(id);
    if (item instanceof Response) return item;
    const [tags, people] = await Promise.all([getTags(), assignments()]);
    return devJson({ item: taskView(item, tags, people.of(id)) });
  } catch (err) {
    return failure("dev item", err);
  }
}

// Moves, edits and/or assigns: only the fields sent change. Approving an idea under review (to open)
// needs "review", anything else "manage", as on the site. An item moved to In progress that nobody
// has yet becomes the key's admin's, unless assignee says otherwise.
export async function PATCH(request: NextRequest, { params }: Context) {
  const { user, error } = await devUser(request);
  if (error) return error;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return devError("invalid", 400, "The body is JSON.");
  const to = body.status as FeedbackStatus | undefined;
  if (to !== undefined && !statuses.includes(to)) return devError("invalid", 400, `status is one of: ${statuses.join(", ")}`);
  const editing = ["title", "description", "type", "platform"].some((key) => body[key] !== undefined);
  const assigning = body.assignee !== undefined;
  if (to === undefined && !editing && !assigning) return devError("invalid", 400, "Send status, assignee and/or title, description, type, platform.");
  if (body.type !== undefined && !typeSlugs.includes(body.type as (typeof typeSlugs)[number])) {
    return devError("invalid", 400, `type is one of: ${typeSlugs.join(", ")}`);
  }
  try {
    const found = await itemOr404(id);
    if (found instanceof Response) return found;
    let item = found;
    const approving = item.status === "under_review" && to === "open";
    if ((editing || assigning || (to !== undefined && !approving)) && !can(user, "manage")) {
      return devError("forbidden", 403, 'This needs the "manage" permission.');
    }
    if (approving && !can(user, "review") && !can(user, "manage")) return devError("forbidden", 403, 'This needs the "review" permission.');
    const [tags, people] = await Promise.all([getTags(), assignments()]);

    // undefined: the assignee stays as it is.
    const current = people.of(id);
    let assignee: StaffMember | null | undefined;
    if (assigning) {
      const named = assigneeFrom(body.assignee, user, people.staff);
      if ("error" in named) return devError("invalid", 400, named.error);
      assignee = named.member;
    } else if (to === "in_progress" && item.status !== "in_progress" && !current) {
      assignee = people.staff.find((member) => member.id === user.id);
    }

    if (editing) {
      const platform = body.platform === undefined ? undefined : platformOf(body.platform, tags.categories);
      if (body.platform !== undefined && platform === undefined) {
        return devError("invalid", 400, "platform is a platform id or name from GET /api/dev/meta, or other");
      }
      const text = (value: unknown, current: string) => (typeof value === "string" ? value.trim() : current);
      // What is not sent stays: the current type and platform tags go back in.
      const currentType = tags.types.find((type) => item.tags.some((tag) => tag.id === type.id));
      const currentPlatform = tags.categories.find((category) => item.tags.some((tag) => tag.id === category.id));
      const title = text(body.title, item.title);
      const edited = await editTask(id, {
        title,
        description: text(body.description, item.description ?? ""),
        typeId: body.type !== undefined ? tags.types.find((type) => type.slug === body.type)?.id : currentType?.id,
        categoryId: platform !== undefined ? platform?.id : currentPlatform?.id,
      });
      if (!edited) return devError("invalid", 400, "title is 3 to 100 characters, description at most 2000");
      await logEvent(user, { type: "item.edited", item: { id, title, status: item.status }, via: user.via });
    }
    if (to !== undefined && to !== item.status) {
      await moveTask(user, item, to);
    }
    revalidateTag(refletTag, { expire: 0 });
    item = await getIdea(id);
    if (to !== undefined) item = { ...item, status: to };
    const changing = assignee !== undefined && (assignee?.id ?? null) !== (current?.id ?? null);
    if (changing) await assignTask(user, item, assignee ?? null);
    const now = assignee === undefined ? current : assignee && { id: assignee.id, name: assignee.name };
    return devJson({ item: taskView(item, tags, now) });
  } catch (err) {
    return failure("dev update", err);
  }
}
