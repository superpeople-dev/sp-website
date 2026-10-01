import { after, NextResponse, type NextRequest } from "next/server";
import { logAuth } from "@/lib/discord";
import { readSession, sameOrigin, sessionCookie, sessionCookieOptions } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  // #discord-auth-logs: who signed out.
  const user = await readSession(request);
  if (user) after(() => logAuth("signed_out", user, "website"));
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(sessionCookie, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
