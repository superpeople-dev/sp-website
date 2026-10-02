import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/clientip";
import { choiceOf } from "@/lib/consentstore";
import { countThisHour, limitsReady } from "@/lib/downloads";
import { rememberIpv4 } from "@/lib/ipv4";
import { readSession, sameOrigin } from "@/lib/session";

// The launcher checks in here over IPv4 just before it reports a game start, so #launcher-logs can
// show the player's IPv4 address next to the IPv6 one the report came from (lib/ipv4.ts). Only the
// address this request came from is kept, for a few minutes; nothing in the body is read. Players
// who declined in the data pop-up are not recorded. At most 30 a player per hour.
const PER_HOUR = 30;

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  if (limitsReady && (await countThisHour(`launcher-ipv4:${user.id}`).catch(() => 0)) > PER_HOUR) {
    return Response.json({ error: "limit" }, { status: 429 });
  }
  if ((await choiceOf(user.id)) !== "declined") await rememberIpv4(user.id, clientIp(request)).catch(() => false);
  return new Response(null, { status: 204 });
}
