import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin, sessionCookie, sessionCookieOptions } from "@/lib/session";

export function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(sessionCookie, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
