import { getServers } from "@/lib/servers";

// What the Servers page polls. getServers() caches the backend answer for 15 s.
export async function GET() {
  const list = await getServers();
  if (!list) return Response.json({ error: "unavailable" }, { status: 503 });
  return Response.json(list, { headers: { "Cache-Control": "public, max-age=15" } });
}
