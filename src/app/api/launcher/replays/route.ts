import type { NextRequest } from "next/server";
import { countThisHour, limitsReady } from "@/lib/downloads";
import { objectsReady } from "@/lib/objects";
import { MAX_BYTES, startReplay } from "@/lib/replays";
import { readSession, sameOrigin } from "@/lib/session";

// The replay of a reported match (lib/replays.ts): the signed-in launcher (sp-launcher replays.rs) says
// how big its zip is and gets an upload link for it, valid 15 minutes, and the replay's page. The zip
// goes straight to object storage, not through here (a function takes 4.5 MB at most). The report then
// carries the page (app/api/launcher/report), which checks the file arrived.
// { name, bytes } -> { id, upload_url, url, max_bytes }
const PER_HOUR = 10;

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  if (!objectsReady || !limitsReady) return Response.json({ error: "unavailable" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { name?: unknown; bytes?: unknown } | null;
  const bytes = typeof body?.bytes === "number" && Number.isFinite(body.bytes) ? body.bytes : 0;
  if (bytes < 22) return Response.json({ error: "invalid" }, { status: 400 });
  if (bytes > MAX_BYTES) return Response.json({ error: "too_big", max_bytes: MAX_BYTES }, { status: 413 });
  if ((await countThisHour(`replay-upload:${user.id}`).catch(() => PER_HOUR + 1)) > PER_HOUR) {
    return Response.json({ error: "limit" }, { status: 429 });
  }
  const replay = await startReplay(user.id, body?.name);
  return Response.json(
    { id: replay.id, upload_url: replay.uploadUrl, url: replay.url, max_bytes: MAX_BYTES },
    { headers: { "Cache-Control": "no-store" } },
  );
}
