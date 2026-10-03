import type { NextRequest } from "next/server";
import { objectsReady } from "@/lib/objects";
import { sweepReplays } from "@/lib/replays";

// Once a day (vercel.json crons): replays older than 30 days, and uploads never confirmed, are deleted
// from object storage (lib/replays.ts). Their pages already say "gone" from day 30 on. With CRON_SECRET
// set, Vercel sends it and only that call runs; without it anyone may start a cleanup, which deletes
// nothing that is still kept.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) return new Response(null, { status: 401 });
  if (!objectsReady) return Response.json({ error: "unavailable" }, { status: 503 });
  const out = await sweepReplays();
  console.log(`[replays] cleanup: ${out.files} file(s), ${out.deleted} deleted`);
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
