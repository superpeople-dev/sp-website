import type { NextRequest } from "next/server";
import { eventRanges, findEvents, type EventRange } from "@/lib/events";
import { readSession } from "@/lib/session";

// The activity log for the admin panel: ?range=24h|7d|30d|all&q=words.
export async function GET(request: NextRequest) {
  const user = await readSession(request);
  if (!user?.admin) return Response.json({ error: "forbidden" }, { status: user ? 403 : 401 });
  const params = request.nextUrl.searchParams;
  const asked = params.get("range") ?? "7d";
  const range: EventRange = (eventRanges as readonly string[]).includes(asked) ? (asked as EventRange) : "7d";
  const search = (params.get("q") ?? "").slice(0, 100);
  return Response.json(await findEvents(range, search), { headers: { "Cache-Control": "no-store" } });
}
