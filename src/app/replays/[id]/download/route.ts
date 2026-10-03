import type { NextRequest } from "next/server";
import { downloadLink, replayOf } from "@/lib/replays";

// The replay's zip (lib/replays.ts): a 10-minute link to the file in object storage, saved as
// "<recording>.zip". The launcher's Open in the launcher comes here too (sp-launcher replays.rs).
type Context = RouteContext<"/replays/[id]/download">;

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const replay = await replayOf(id).catch(() => null);
  if (!replay?.uploaded) return new Response("This replay is gone: replays are kept 30 days.", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(null, {
    status: 302,
    headers: { Location: downloadLink(replay), "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" },
  });
}
