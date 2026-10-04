import { after, type NextRequest } from "next/server";
import { banUser } from "@/lib/bans";
import { logTamper } from "@/lib/discord";
import { countThisHour, limitsReady } from "@/lib/downloads";
import { readSession, sameOrigin } from "@/lib/session";

// The game client's anti-tamper (sp-native anti_tamper.cpp) saw a debugger attached, a known cheat
// module, or an unrecognized DLL in the game. The client writes it into SP_REPORT_DIR and the launcher
// sends it here as the signed-in Discord account (sp-launcher reports.rs), so a report only ever
// concerns the player who sent it -- it can never be used to ban someone else. A high-confidence signal
// (debugger, known cheat) auto temp-bans for 24 h and alerts #anti-cheat (lib/discord.ts logTamper); an unrecognized DLL is only
// an alert for a human to review, because legitimate overlays (Discord, Steam, OBS, Afterburner, GPU
// drivers) inject DLLs too. Staff are never flagged -- they may debug and run their own tools.
const DAY = 24 * 60 * 60 * 1000;
const PER_HOUR = 20;

// What the client may report, the staff-readable wording, and whether it auto-bans.
const SIGNALS: Record<string, { label: string; ban: boolean }> = {
  debugger: { label: "A debugger is attached to the game", ban: true },
  cheat: { label: "A known cheat module is loaded", ban: true },
  module: { label: "An unrecognized DLL is loaded in the game", ban: false },
};

const line = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) || undefined : undefined;

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  // Staff (admins, moderators, developers) may attach a debugger and load their own tools. Never flag
  // or ban them -- banUser would refuse an admin anyway, this also silences the review alert.
  if (user.admin || user.staff.length) return new Response(null, { status: 204 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const signal = SIGNALS[typeof body?.signal === "string" ? body.signal : ""];
  if (!signal) return Response.json({ error: "invalid" }, { status: 400 });
  const detail = line(body?.detail, 120);

  if (limitsReady) {
    // At most PER_HOUR tamper posts a player per hour, and the same signal from the same player once.
    if ((await countThisHour(`tamper:${user.id}`).catch(() => 0)) > PER_HOUR) return new Response(null, { status: 429 });
    if ((await countThisHour(`tamper-sent:${user.id}:${(body?.signal as string) ?? ""}`).catch(() => 1)) > 1) {
      return new Response(null, { status: 204 });
    }
  }

  after(async () => {
    let banned: { until: number } | undefined;
    if (signal.ban) {
      const until = Date.now() + DAY;
      const reason = `Anti-cheat: ${signal.label}${detail ? ` (${detail})` : ""}`;
      const result = await banUser(
        { id: "anti-tamper", name: "Anti-cheat", avatar: "" },
        { id: user.id, name: user.name, username: user.username, avatar: user.avatar },
        reason,
        until,
      ).catch(() => "protected" as const);
      if (result === "ok") banned = { until };
    }
    await logTamper({ id: user.id, name: user.name, avatar: user.avatar }, { signal: signal.label, detail, banned });
  });
  return new Response(null, { status: 204 });
}
