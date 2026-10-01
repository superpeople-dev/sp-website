import { after, type NextRequest } from "next/server";
import { launcherActions, logLauncher, type Hardware, type LauncherAction, type LauncherDetails } from "@/lib/discord";
import { choiceOf } from "@/lib/consentstore";
import { clientIp, countThisHour, limitsReady } from "@/lib/downloads";
import { readSession, sameOrigin } from "@/lib/session";

// What a signed-in player did with the game in the launcher (download, verify, uninstall, starting
// the game and the PC it runs on), for #launcher-logs. Only known actions, plain numbers and short
// lines of text are taken, and the text is shown as is. At most 30 a player per hour: a launcher
// cannot flood the channel.
const PER_HOUR = 30;

const count = (value: unknown, max: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(Math.round(value), max) : undefined;
// One line of text from the player's PC (a processor or graphics card name), plain and short.
const line = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) || undefined : undefined;

// Where the player is: the country and region Vercel finds for their connection (its own headers,
// which a client cannot set). Never the city.
function locationOf(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country")?.toUpperCase();
  if (!country || !/^[A-Z]{2}$/.test(country)) return undefined;
  const region = request.headers.get("x-vercel-ip-country-region")?.toUpperCase();
  return { country, region: region && /^[A-Z0-9]{1,3}$/.test(region) ? region : undefined };
}

// The PC the game started on (sp-launcher hardware.rs): only these fields, each checked.
function hardwareOf(value: unknown): Hardware | undefined {
  if (!value || typeof value !== "object") return undefined;
  const pc = value as Record<string, unknown>;
  const gpus = Array.isArray(pc.gpus)
    ? pc.gpus
        .slice(0, 4)
        .map((gpu) => ({ name: line((gpu as Record<string, unknown>)?.name, 100), vramGb: count((gpu as Record<string, unknown>)?.vram_gb, 1024) }))
        .filter((gpu): gpu is { name: string; vramGb: number | undefined } => Boolean(gpu.name))
    : [];
  const screen = line(pc.screen, 20);
  return {
    cpu: line(pc.cpu, 100),
    threads: count(pc.threads, 1024),
    ramGb: count(pc.ram_gb, 65536),
    gpus,
    os: line(pc.os, 80),
    screen: screen && /^\d{2,5}x\d{2,5}$/.test(screen) ? screen : undefined,
    screens: count(pc.screens, 32),
  };
}

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
  // Declined in the data pop-up (lib/consent.ts): no hardware, location or IP for this account.
  const extras = action === "game.launched" && (await choiceOf(user.id)) !== "declined";
  const details: LauncherDetails = {
    files: count(body.files, 100_000),
    bytes: count(body.bytes, 1e12),
    seconds: count(body.seconds, 1e7),
    version: typeof body.version === "string" && /^\d{1,3}\.\d{1,3}\.\d{1,4}$/.test(body.version) ? body.version : undefined,
    reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 300) : undefined,
    source: body.source === "backup" ? "backup" : body.source === "storage" ? "storage" : undefined,
    hardware: extras ? hardwareOf(body.hardware) : undefined,
    location: extras ? locationOf(request) : undefined,
    // As Vercel saw the connection (lib/downloads.ts clientIp); only an address's own characters.
    ip: extras ? [clientIp(request)].find((ip) => /^[0-9a-fA-F:.]{3,45}$/.test(ip)) : undefined,
  };
  after(() => logLauncher(action, user, details));
  return new Response(null, { status: 204 });
}
