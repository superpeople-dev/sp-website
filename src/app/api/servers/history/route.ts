import type { NextRequest } from "next/server";
import { getHistory, isHistoryRange } from "@/lib/servers";

// The Servers page's charts. getHistory() caches the backend answer for a minute.
export async function GET(request: NextRequest) {
  const range = request.nextUrl.searchParams.get("range") ?? "24h";
  if (!isHistoryRange(range)) return Response.json({ error: "range" }, { status: 400 });
  const history = await getHistory(range);
  if (!history) return Response.json({ error: "unavailable" }, { status: 503 });
  return Response.json(history, { headers: { "Cache-Control": "public, max-age=60" } });
}
