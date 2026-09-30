import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { Permission, Viewer } from "./board";
import { offensiveName } from "./moderation";
import { accessOf } from "./staff";
import { banOf } from "./store";

export { isListedAdmin } from "./staff";

// admin, owner and permissions come from lib/staff.ts on every request. In the cookie, admin only
// records whether they had the Discord admin role when they signed in.
export type SessionUser = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  admin: boolean;
  owner: boolean;
  permissions: Permission[];
};

export const sessionCookie = "sp_session";
export const oauthCookie = "sp_oauth";
// Set while the launcher signs in (app/api/auth/launcher): its PKCE challenge.
export const launcherCookie = "sp_launcher";

const maxAge = 60 * 60 * 24 * 30;

const secure = process.env.NODE_ENV === "production";
const encoder = new TextEncoder();

export const authReady = Boolean(
  process.env.AUTH_SECRET &&
    process.env.DISCORD_CLIENT_ID &&
    process.env.DISCORD_CLIENT_SECRET &&
    process.env.REFLET_SECRET_KEY &&
    process.env.NEXT_PUBLIC_REFLET_PUBLIC_KEY,
);

export const sessionCookieOptions = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge };
export const oauthCookieOptions = { httpOnly: true, secure, sameSite: "lax" as const, path: "/api/auth", maxAge: 600 };

const signingKey = () =>
  crypto.subtle.importKey("raw", encoder.encode(process.env.AUTH_SECRET ?? ""), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);

export async function sealSession(user: SessionUser) {
  const body = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + maxAge * 1000 })).toString("base64url");
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(body));
  return `${body}.${Buffer.from(signature).toString("base64url")}`;
}

// The website sends the session as a cookie; the launcher sends the same sealed session as a bearer
// token (it signed in through /api/auth/launcher). Browsers never add an Authorization header on
// their own, so accepting one opens no cross-site way in.
export const readSession = (request: NextRequest) => verifySession(bearerOf(request) ?? request.cookies.get(sessionCookie)?.value);

const bearerOf = (request: NextRequest) => request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];

export const currentSession = async () => verifySession((await cookies()).get(sessionCookie)?.value);

export const viewerOf = (session: SessionUser | null, { banned = false, moderation = false } = {}): Viewer | null =>
  session
    ? {
        id: session.id,
        name: session.name,
        username: session.username,
        avatar: session.avatar,
        admin: session.admin,
        owner: session.owner,
        permissions: session.permissions,
        banned,
        canBan: session.permissions.includes("bans") && moderation,
        nameBlocked: offensiveName(session),
      }
    : null;

export async function verifySession(value: string | undefined): Promise<SessionUser | null> {
  if (!value || !process.env.AUTH_SECRET) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(),
    Buffer.from(signature, "base64url"),
    encoder.encode(body),
  );
  if (!valid) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    const id = String(data.id);
    const name = String(data.name);
    const [access, ban] = await Promise.all([accessOf(id, data.admin === true), banOf(id)]);
    // Locked out (the honeypot): the session is gone, here and in the launcher.
    if (ban?.lockout && !access) return null;
    return {
      id,
      name,
      username: typeof data.username === "string" ? data.username : name,
      avatar: String(data.avatar),
      admin: access !== null,
      owner: access?.owner ?? false,
      permissions: access?.permissions ?? [],
    };
  } catch {
    return null;
  }
}

export function safeNext(value: string | null | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/roadmap";
}

export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}
