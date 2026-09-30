import type { NextRequest } from "next/server";
import type { FeedbackItem } from "reflet-sdk";
import { launcherItem } from "@/lib/launcher";
import { failure, getTags, listByStatus, listIdeas, userToken } from "@/lib/reflet";
import { readSession } from "@/lib/session";
import { authorsOf } from "@/lib/store";
import { forBoard } from "@/lib/votes";

const boards = ["ideas", "roadmap", "completed"] as const;
type Board = (typeof boards)[number];

// The launcher's Ideas, Roadmap and Completed pages: the same items as the site's pages
// (app/[lang]/bugs-and-ideas, roadmap, completed), with the signed-in player's own votes. The
// platforms are the ids a new idea is filed under (POST /api/roadmap/ideas).
export async function GET(request: NextRequest) {
  const board = request.nextUrl.searchParams.get("board") as Board;
  if (!boards.includes(board)) return Response.json({ error: "invalid" }, { status: 400 });
  const user = await readSession(request);
  try {
    const token = user ? await userToken(user) : undefined;
    const load: Record<Board, () => Promise<FeedbackItem[]>> = {
      ideas: async () => (await listIdeas(token)).items.filter((item) => item.status === "open"),
      roadmap: async () => (await Promise.all([listByStatus("planned", 10, token), listByStatus("in_progress", 10, token)])).flat(),
      completed: () => listByStatus("completed", 10, token),
    };
    const [items, tags] = await Promise.all([load[board](), getTags().catch(() => ({ categories: [] }))]);
    const [shown, authors] = await Promise.all([forBoard(items, user?.id), authorsOf(items.map((item) => item.id))]);
    return Response.json(
      {
        items: shown.map((item) => launcherItem(item, authors)),
        platforms: tags.categories.map(({ id, name }) => ({ id, name })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure("launcher items", error);
  }
}
