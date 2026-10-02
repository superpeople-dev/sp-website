import { createHash } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { logGameReport, type GameReport } from "@/lib/discord";
import { countThisHour, limitsReady } from "@/lib/downloads";
import { discordOfAccount } from "@/lib/launcher";
import { readSession, sameOrigin } from "@/lib/session";

// A report made with the game's own Report button (death cam, spectating), for #in-game-report.
// The client fixes DLL writes it on the player's PC (sp-native player_reports.cpp) and the launcher
// sends it here as the signed-in account (sp-launcher reports.rs): who reported is that account,
// never a name in the report. Only known fields, plain numbers and short lines of text are taken,
// at most 10 reports a player per hour, and the same report sent twice is posted once. The post
// names the reported player's Discord account when the game backend knows it.
const PER_HOUR = 10;

const count = (value: unknown, max: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(Math.round(value), max) : undefined;
const decimal = (value: unknown, max: number) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.min(Math.round(value * 10) / 10, max) : undefined;
// One line of text from the game, plain and short.
const line = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) || undefined : undefined;
const fieldsOf = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

function playerOf(value: unknown) {
  const player = fieldsOf(value);
  return {
    id: line(player.id, 64),
    name: line(player.name, 64),
    weapon: line(player.weapon, 80),
    weaponId: count(player.weapon_id, 2 ** 31),
  };
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  const body = fieldsOf(await request.json().catch(() => null));
  const reporter = fieldsOf(body.reporter);
  const suspect = fieldsOf(body.suspect);
  const report: GameReport = {
    type: count(body.type, 99),
    reason: count(body.reason, 99),
    programs: Array.isArray(body.programs)
      ? [...new Set(body.programs.map((program) => count(program, 99)).filter((program): program is number => program !== undefined))].slice(0, 8)
      : [],
    replay: line(body.replay, 120),
    version: typeof body.version === "string" && /^\d{1,3}\.\d{1,3}\.\d{1,4}$/.test(body.version) ? body.version : undefined,
    reporter: {
      ...playerOf(reporter),
      hitBone: line(reporter.hit_bone, 40),
      damage: decimal(reporter.damage, 100_000),
      damageType: line(reporter.damage_type, 60),
    },
    suspect: {
      ...playerOf(suspect),
      distance: count(suspect.distance, 10_000_000),
      hits: count(suspect.hits, 100_000),
      headshots: count(suspect.headshots, 100_000),
    },
  };
  // Nobody to report: nothing the staff could act on.
  if (!report.suspect.id && !report.suspect.name) return Response.json({ error: "invalid" }, { status: 400 });
  if (limitsReady) {
    // The launcher keeps a report refused here and sends it again later.
    if ((await countThisHour(`game-report:${user.id}`).catch(() => 0)) > PER_HOUR) {
      return Response.json({ error: "limit" }, { status: 429 });
    }
    // A launcher that sent a report but missed the answer sends it again: post it once.
    const same = createHash("sha256").update(`${user.id}\n${JSON.stringify({ ...report, version: undefined })}`).digest("hex");
    if ((await countThisHour(`game-report-sent:${same}`).catch(() => 1)) > 1) return new Response(null, { status: 204 });
  }
  after(async () => logGameReport(user, report, await discordOfAccount(report.suspect.id)));
  return new Response(null, { status: 204 });
}
