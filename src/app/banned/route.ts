// Where a Discord sign-in of someone banned from everything ends (lib/honeypot.ts): no session.
export function GET() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>Banned - SUPER PEOPLE</title>
<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#0a0a0c;color:#f4f1ee;font:15px/1.5 "Segoe UI",system-ui,sans-serif;text-align:center}main{max-width:460px}h1{margin:0 0 6px;font-size:22px;letter-spacing:.04em;text-transform:uppercase}p{margin:0;color:#bdb7b2}</style>
</head><body><main><h1>Account banned</h1><p>This account is banned from SUPER PEOPLE Revival: it can't sign in on the website or in the launcher. If you think this is a mistake, contact the team on Discord.</p></main></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
