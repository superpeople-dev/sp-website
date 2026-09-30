import type { NextRequest } from "next/server";
import { devJson, devUser, typeSlugs } from "@/lib/devapi";
import { kinds } from "@/lib/kinds";
import { failure, getTags } from "@/lib/reflet";
import { createStatuses, statuses } from "@/lib/tasks";

// The values the other calls take: statuses, types and platforms.
export async function GET(request: NextRequest) {
  const { error } = await devUser(request);
  if (error) return error;
  try {
    const { categories } = await getTags();
    return devJson({
      statuses: {
        all: statuses,
        create: createStatuses,
        board: { open: "Bugs & Ideas", under_review: "Waiting for review", planned: "Roadmap: To do", in_progress: "Roadmap: In progress", completed: "Completed" },
      },
      types: typeSlugs.map((slug) => ({ slug, name: kinds[slug].type })),
      platforms: [...categories.map(({ id, name }) => ({ id, name })), { id: "other", name: "Other" }],
    });
  } catch (err) {
    return failure("dev meta", err);
  }
}
