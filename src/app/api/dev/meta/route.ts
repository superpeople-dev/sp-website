import type { NextRequest } from "next/server";
import { devJson, devUser, typeSlugs } from "@/lib/devapi";
import { kinds } from "@/lib/kinds";
import { failure, getTags } from "@/lib/reflet";
import { listStaff } from "@/lib/staff";
import { createStatuses, statuses } from "@/lib/tasks";

// The values the other calls take: statuses, types, platforms and the admins items can be assigned to.
export async function GET(request: NextRequest) {
  const { error } = await devUser(request);
  if (error) return error;
  try {
    const [{ categories }, staff] = await Promise.all([getTags(), listStaff()]);
    return devJson({
      statuses: {
        all: statuses,
        create: createStatuses,
        board: { open: "Bugs & Ideas", under_review: "Waiting for review", planned: "Roadmap: To do", in_progress: "Roadmap: In progress", completed: "Completed" },
      },
      types: typeSlugs.map((slug) => ({ slug, name: kinds[slug].type })),
      platforms: [...categories.map(({ id, name }) => ({ id, name })), { id: "other", name: "Other" }],
      // assignee takes one of these (id, username or name), "me" or "team".
      admins: staff.map(({ id, name, username }) => ({ id, name, username: username ?? null })),
    });
  } catch (err) {
    return failure("dev meta", err);
  }
}
