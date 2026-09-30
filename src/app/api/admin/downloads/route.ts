import type { NextRequest } from "next/server";
import { can } from "@/lib/board";
import { limitsReady, unblock } from "@/lib/downloads";
import { readSession, sameOrigin } from "@/lib/session";

// Lifts a download limit (lib/downloads.ts) before its day is over: the account's, and the one on
// the IP it downloaded from. Admins who handle bans only.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user || !can(user, "bans")) return Response.json({ error: "forbidden" }, { status: user ? 403 : 401 });
  if (!limitsReady) return Response.json({ error: "store" }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; account?: unknown };
  const account = typeof body.account === "string" ? body.account : "";
  if (body.action !== "unblock" || !/^\d{5,32}$/.test(account)) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    await unblock(account);
    console.log(`[downloads] ${user.id} lifted the download limit on ${account}`);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(`[downloads] unblock failed: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: "store" }, { status: 502 });
  }
}
