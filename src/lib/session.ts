import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { Viewer } from "./board";
import { admins } from "./admins";

export type SessionUser = { id: string; name: string; username: string; avatar: string; admin: boolean };

export const sessionCookie = "sp_session";
export const oauthCookie = "sp_oauth";

const maxAge = 60 * 60 * 24 * 30;

const envAdmins = (process.env.ADMIN_DISCORD_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

export const isListedAdmin = (discordId: string) =>
  envAdmins.includes(discordId) || admins.some((admin) => admin.discordId === discordId);
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

export const readSession = (request: NextRequest) => verifySession(request.cookies.get(sessionCookie)?.value);

export const currentSession = async () => verifySession((await cookies()).get(sessionCookie)?.value);

export const viewerOf = (session: SessionUser | null, { banned = false, moderation = false } = {}): Viewer | null =>
  session
    ? {
        id: session.id,
        name: session.name,
        username: session.username,
        avatar: session.avatar,
        admin: session.admin,
        banned,
        canBan: session.admin && moderation,
      }
    : null;

async function verifySession(value: string | undefined): Promise<SessionUser | null> {
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
    return {
      id,
      name,
      username: typeof data.username === "string" ? data.username : name,
      avatar: String(data.avatar),
      admin: data.admin === true || isListedAdmin(id),
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
