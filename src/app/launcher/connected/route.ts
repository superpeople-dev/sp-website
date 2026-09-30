import type { NextRequest } from "next/server";

// Where the launcher's Discord window ends (lib/launcher.ts). The launcher reads the code from this
// address and closes the window itself; the page only shows in the moment before that.
export function GET(request: NextRequest) {
  const ok = request.nextUrl.searchParams.has("code");
  const title = ok ? "Connected" : "Could not connect";
  const text = ok
    ? "You're signed in. You can go back to the launcher."
    : "Discord did not sign you in. Close this window and try again from the launcher.";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} - SUPER PEOPLE</title>
<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#0a0a0c;color:#f4f1ee;font:15px/1.5 "Segoe UI",system-ui,sans-serif;text-align:center}h1{margin:0 0 6px;font-size:22px;letter-spacing:.04em;text-transform:uppercase}p{margin:0;color:#bdb7b2}</style>
</head><body><main><h1>${title}</h1><p>${text}</p></main></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
