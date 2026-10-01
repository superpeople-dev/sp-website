import { after, type NextRequest } from "next/server";
import { launcherActions, logLauncher, type LauncherAction, type LauncherDetails } from "@/lib/discord";
import { countThisHour, limitsReady } from "@/lib/downloads";
import { readSession, sameOrigin } from "@/lib/session";

// What a signed-in player did with the game in the launcher (download, verify, uninstall), for
// #launcher-logs. Only known actions and plain numbers are taken; the one text (why a download
// failed) is shown as is. At most 30 a player per hour: a launcher cannot flood the channel.
const PER_HOUR = 30;

const count = (value: unknown, max: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(Math.round(value), max) : undefined;

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = body.action as LauncherAction;
  if (!launcherActions.includes(action as (typeof launcherActions)[number])) return Response.json({ error: "invalid" }, { status: 400 });
  if (limitsReady && (await countThisHour(`launcher-log:${user.id}`).catch(() => 0)) > PER_HOUR) {
    return Response.json({ error: "limit" }, { status: 429 });
  }
  const details: LauncherDetails = {
    files: count(body.files, 100_000),
    bytes: count(body.bytes, 1e12),
    seconds: count(body.seconds, 1e7),
    version: typeof body.version === "string" && /^\d{1,3}\.\d{1,3}\.\d{1,4}$/.test(body.version) ? body.version : undefined,
    reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 300) : undefined,
    source: body.source === "backup" ? "backup" : body.source === "storage" ? "storage" : undefined,
  };
  after(() => logLauncher(action, user, details));
  return new Response(null, { status: 204 });
}
