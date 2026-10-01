import { NextResponse, type NextRequest } from "next/server";
import { consentCookie, cookieValue, type Choice } from "@/lib/consent";
import { saveChoice } from "@/lib/consentstore";
import { readSession, sameOrigin } from "@/lib/session";

// The data pop-up's answer (components/Consent.tsx): a cookie for this device (readable by the page,
// so it knows not to ask again) and, when signed in, the Discord account's choice, which the
// launcher follows.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { choice?: unknown };
  if (body.choice !== "accepted" && body.choice !== "declined") return NextResponse.json({ error: "invalid" }, { status: 400 });
  const choice: Choice = body.choice;
  const user = await readSession(request);
  if (user) await saveChoice(user.id, choice).catch(() => null);
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(consentCookie, cookieValue(choice), {
    path: "/",
    maxAge: 365 * 24 * 3600,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  });
  return response;
}
