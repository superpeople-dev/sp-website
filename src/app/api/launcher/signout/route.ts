import { after, type NextRequest } from "next/server";
import { logAuth } from "@/lib/discord";
import { readSession, sameOrigin } from "@/lib/session";

// The launcher's Disconnect: it forgets the session on the PC itself; this only tells
// #discord-auth-logs.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  after(() => logAuth("signed_out", user, "launcher"));
  return new Response(null, { status: 204 });
}
