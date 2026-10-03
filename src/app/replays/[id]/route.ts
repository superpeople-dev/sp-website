import type { NextRequest } from "next/server";
import { expiresAt, KEEP_DAYS, replayOf } from "@/lib/replays";

// A reported match's replay (lib/replays.ts), from the link in #in-game-report: Open in the launcher
// (sp-launcher://replay/<id>: the launcher downloads it into the game's Replay menu, sp-launcher
// replays.rs) or download the zip. No sign-in: the id is the secret. Never indexed.
type Context = RouteContext<"/replays/[id]">;

const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function page(status: number, title: string, body: string) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>${title} - SUPER PEOPLE</title>
<style>html,body{min-height:100%;margin:0}body{display:grid;place-items:center;min-height:100vh;padding:24px 16px;box-sizing:border-box;background:#0a0a0c;color:#f4f1ee;font:15px/1.5 "Segoe UI",system-ui,sans-serif;text-align:center}main{max-width:560px}h1{margin:0 0 6px;font-size:22px;letter-spacing:.04em;text-transform:uppercase}p{margin:0 0 10px;color:#bdb7b2}code{color:#f4f1ee;word-break:break-all}.facts{margin:0 0 20px}.actions{display:flex;gap:10px;justify-content:center;margin:0 0 18px}@media (max-width:520px){.actions{flex-direction:column;align-items:stretch}}a.btn{display:inline-block;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;letter-spacing:.03em;text-transform:uppercase;font-size:14px}a.primary{background:#ef4438;color:#fff}a.secondary{border:1px solid #3a3a40;color:#f4f1ee}small{color:#8d8781}</style>
</head><body><main>${body}</main></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" },
  });
}

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const replay = await replayOf(id).catch(() => null);
  if (!replay?.uploaded) {
    return page(404, "Replay gone", `<h1>This replay is gone</h1><p>Replays of reported matches are kept ${KEEP_DAYS} days, then deleted.</p>`);
  }
  const mb = (replay.bytes / 1048576).toFixed(1);
  return page(
    200,
    "Match replay",
    `<h1>Match replay</h1>
<p class="facts"><code>${esc(replay.name)}</code><br>${mb} MB, uploaded ${day(replay.at)} (UTC), kept until ${day(expiresAt(replay))}</p>
<div class="actions"><a class="btn primary" href="sp-launcher://replay/${replay.id}">Open in the launcher</a><a class="btn secondary" href="/replays/${replay.id}/download">Download the zip</a></div>
<p><small>Open in the launcher puts it in the game's Replay menu. Or unzip the download into <code>%LOCALAPPDATA%\\BravoHotelGame\\Saved\\Demos</code> and open it there.</small></p>`,
  );
}
