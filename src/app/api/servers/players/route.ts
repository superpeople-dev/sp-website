import type { NextRequest } from "next/server";
import { getPlayerHistory, isPlayerRange } from "@/lib/servers";

// The Servers page's player chart. getPlayerHistory() caches the backend answer for a minute.
export async function GET(request: NextRequest) {
  const range = request.nextUrl.searchParams.get("range") ?? "24h";
  if (!isPlayerRange(range)) return Response.json({ error: "range" }, { status: 400 });
  const history = await getPlayerHistory(range);
  if (!history) return Response.json({ error: "unavailable" }, { status: 503 });
  return Response.json(history, { headers: { "Cache-Control": "public, max-age=60" } });
}
