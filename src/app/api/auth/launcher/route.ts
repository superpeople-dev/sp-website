import { NextResponse, type NextRequest } from "next/server";
import { connectedPath, isChallenge } from "@/lib/launcher";
import { authReady, launcherCookie, oauthCookieOptions } from "@/lib/session";
import { storeReady } from "@/lib/store";

// The launcher's Discord sign-in (lib/launcher.ts): remembers its PKCE challenge, then goes through
// the site's own Discord sign-in, whose callback hands the launcher a one-time code instead of a cookie.
export function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("challenge");
  if (!isChallenge(challenge) || !authReady || !storeReady) {
    return NextResponse.redirect(new URL(`${connectedPath}?error=unavailable`, request.url));
  }
  const response = NextResponse.redirect(new URL(`/api/auth/discord?next=${encodeURIComponent(connectedPath)}`, request.url));
  response.cookies.set(launcherCookie, challenge, oauthCookieOptions);
  return response;
}
