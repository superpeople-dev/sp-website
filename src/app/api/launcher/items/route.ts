import type { NextRequest } from "next/server";
import type { FeedbackItem } from "reflet-sdk";
import { can } from "@/lib/board";
import { launcherItem, typeName } from "@/lib/launcher";
import { failure, getTags, listByStatus, listIdeas, listPending, userToken } from "@/lib/reflet";
import { readSession } from "@/lib/session";
import { authorsOf } from "@/lib/store";
import { forBoard } from "@/lib/votes";

const boards = ["ideas", "roadmap", "completed"] as const;
type Board = (typeof boards)[number];

// The launcher's Ideas, Roadmap and Completed pages: the same items as the site's pages
// (app/[lang]/bugs-and-ideas, roadmap, completed), with the signed-in player's own votes. An admin
// who reviews new ideas also gets the ones waiting for review, as on the site. The platforms and
// types are the ids a new idea is filed under (POST /api/roadmap/ideas) and an admin's edit sets.
export async function GET(request: NextRequest) {
  const board = request.nextUrl.searchParams.get("board") as Board;
  if (!boards.includes(board)) return Response.json({ error: "invalid" }, { status: 400 });
  const user = await readSession(request);
  try {
    const token = user ? await userToken(user) : undefined;
    const load: Record<Board, () => Promise<FeedbackItem[]>> = {
      ideas: async () => {
        const [ideas, pending] = await Promise.all([
          listIdeas(token),
          user && can(user, "review") ? listPending().catch(() => []) : [],
        ]);
        return [...ideas.items.filter((item) => item.status === "open"), ...pending];
      },
      roadmap: async () => (await Promise.all([listByStatus("planned", 10, token), listByStatus("in_progress", 10, token)])).flat(),
      completed: () => listByStatus("completed", 10, token),
    };
    const [items, tags] = await Promise.all([load[board](), getTags().catch(() => ({ categories: [], types: [] }))]);
    const [shown, authors] = await Promise.all([forBoard(items, user?.id), authorsOf(items.map((item) => item.id))]);
    return Response.json(
      {
        items: shown.map((item) => launcherItem(item, authors)),
        platforms: tags.categories.map(({ id, name }) => ({ id, name })),
        types: tags.types.map(({ id, slug }) => ({ id, name: typeName(slug) })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure("launcher items", error);
  }
}
