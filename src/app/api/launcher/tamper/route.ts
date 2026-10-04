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

// DLLs the game ships with (Engine\Binaries\ThirdParty, its Wwise, DLSS and ZipUtility plugins) and
// legitimate overlays and driver modules, which older ClientFixes reported as unrecognized: v40/v41
// trusted only the exe's own folder, and before v43 only overlay names, not signatures (NVIDIA's
// NvTelemetryBridge64.dll). v42 trusts the whole install folder; v43 also every DLL signed by a known
// publisher (NVIDIA, AMD, Microsoft, Valve, Discord, ...) and reports "<name> (signed: ...)" or
// "<name> (unsigned)". Until every player has it, these names are not posted. Only file names reach
// here from older clients, not folders.
const KNOWN_DLLS = new Set([
  "dbghelp.dll", "steam_api64.dll", "xaudio2_9redist.dll", "libvorbisfile_64.dll", "7z.dll",
  "physx3_x64.dll", "physx3common_x64.dll", "physx3cooking_x64.dll", "pxfoundation_x64.dll", "nvcloth_x64.dll",
  "apex_legacy_x64.dll", "apex_destructible_x64.dll", "apex_clothing_x64.dll", "apexframework_x64.dll", "pxpvdsdk_x64.dll",
  "coherentgtcore.dll", "coherentgtjs.dll", "coherentuigt.dll", "coherenticuin.dll", "coherenticuuc.dll", "icudtcoherent53.dll",
  "wtf.dll", "renoircore.windowsdesktop.dll", "nvngx_dlss.dll",
  "akdelay.dll", "akmatrixreverb.dll", "akpeaklimiter.dll",
  "gtiii-osd64-gl.dll", "aswhook.dll", "nvtelemetrybridge64.dll", "mdnsnsp.dll",
]);
// v43 says who signed what it reports: "<name> (signed: <publisher>)". Publishers trusted since v44
// (sp-native #70) that v43 still reported: Apple (Bonjour's mdnsnsp.dll, a Winsock name provider in
// every game on PCs with iTunes or iCloud). A copied name without that signature is still posted.
const TRUSTED_SIGNERS = new Set(["apple inc."]);
const knownModule = (detail: string) => {
  const signed = /^.+ \(signed: (.+)\)$/.exec(detail);
  return signed ? TRUSTED_SIGNERS.has(signed[1].toLowerCase()) : KNOWN_DLLS.has(detail.toLowerCase());
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
  // The game's own DLLs and known overlays from older ClientFixes: nothing for a human to review.
  if (body?.signal === "module" && detail && knownModule(detail)) return new Response(null, { status: 204 });

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
