import { createHash, createPrivateKey, randomUUID, sign } from "node:crypto";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import { localeHref } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { shownName, type BoardItem } from "./board";
import { kinds, typeAndPlatforms } from "./kinds";
import { siteUrl } from "./seo";
import type { SessionUser } from "./session";
import { legalUpdated } from "./site";
import type { Profile } from "./store";

// The SUPER PEOPLE launcher (github.com/superpeople-dev/sp-launcher) signs players in through this
// site and shows its Ideas, Roadmap and Completed items (app/api/launcher/*).

// ---------------------------------------------------------------- sign-in ---
// The launcher opens /api/auth/launcher?challenge=… in its own window. After Discord, the callback
// keeps the sealed session under a one-time code and shows /launcher/connected?code=…; the launcher
// reads the code from that address and trades it, with the verifier behind the challenge (PKCE,
// RFC 7636), at /api/launcher/token. A code seen by anything else is useless without the verifier.

export const connectedPath = "/launcher/connected";

// A PKCE S256 challenge: base64url of a SHA-256, 43 characters.
export const isChallenge = (value: string | null): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

export const challengeOf = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

// With what the player may do as an admin (lib/staff.ts), for the launcher's admin tools. The site
// checks the same permissions again on every admin call.
export const profileOfSession = (user: SessionUser) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  avatar: user.avatar,
  admin: user.admin,
  permissions: user.permissions,
});

// ------------------------------------------------------------- game pass ---
// Pressing Play, the launcher asks for a pass and hands it to the game backend (sp-backend,
// POST /launcher/api/session/discord), which finds the player's account by Discord id. The pass is
// signed with an Ed25519 key only this site has (LAUNCHER_PASS_KEY); the backend holds the public
// half, so it can check a pass but never make one. Two minutes, and the backend takes each once.

const passKey = process.env.LAUNCHER_PASS_KEY;
export const passReady = Boolean(passKey);
const passLifetime = 120_000;

// a: the hash of the player's Discord avatar ("" for Discord's default one). The backend keeps it and
// shows the picture as the player's profile picture in the game's lobby.
export type GamePass = { d: string; u: string; n: string; a: string; exp: number; j: string };

// The session keeps the avatar as its CDN address (app/api/auth/discord/callback).
const avatarHash = (avatar: string) => avatar.match(/\/avatars\/\d+\/((?:a_)?[0-9a-f]{32})\.png/)?.[1] ?? "";

export function gamePass(user: SessionUser): string {
  if (!passKey) throw new Error("LAUNCHER_PASS_KEY is not set");
  const key = createPrivateKey({ key: Buffer.from(passKey, "base64"), format: "der", type: "pkcs8" });
  const pass: GamePass = {
    d: user.id,
    u: user.username,
    n: user.name,
    a: avatarHash(user.avatar),
    exp: Date.now() + passLifetime,
    j: randomUUID(),
  };
  const body = Buffer.from(JSON.stringify(pass)).toString("base64url");
  return `${body}.${sign(null, Buffer.from(body), key).toString("base64url")}`;
}

// ------------------------------------------------------------------ terms ---
// Play in the launcher needs the player to accept the Terms of Service and the Privacy Policy, in the
// launcher, once per Discord account and again whenever the legal pages change: their date is the
// version. The launcher shows the English text (app/api/launcher/terms) and records the acceptance
// here. With LAUNCHER_TERMS_REQUIRED=1 the site also refuses game passes without it, which stops
// launchers older than the terms screen too, so it stays off until players have the new launcher.

export const termsVersion = legalUpdated;
export const termsRequired = process.env.LAUNCHER_TERMS_REQUIRED === "1";

export function launcherTerms() {
  const { legal } = getDictionary("en");
  return {
    version: termsVersion,
    docs: [
      { title: legal.terms, url: `${siteUrl}${localeHref("en", "/terms")}`, ...legal.termsDoc },
      { title: legal.privacy, url: `${siteUrl}${localeHref("en", "/privacy")}`, ...legal.privacyDoc },
    ],
  };
}

// ------------------------------------------------------------------ items ---
// Items as the launcher draws them: the score (upvotes minus downvotes), the player's own vote, the
// type as a short label and the platforms as tags, and who posted it.

export type LauncherItem = {
  id: string;
  title: string;
  description: string;
  status: FeedbackStatus;
  score: number;
  myVote: "up" | "down" | null;
  commentCount: number;
  createdAt: number;
  completedAt: number | null;
  tags: { name: string; color: string }[];
  author: { name: string; avatar: string | null } | null;
  // Its type and platform tags, which an admin's edit keeps (app/api/admin/feedback, action "edit").
  typeId: string | null;
  platformId: string | null;
};

const typeLabel: Record<string, string> = {
  "bug-report": "Bug",
  "feature-request": "Idea",
  enhancement: "Improvement",
  question: "Question",
};

const reporter = /\s*Reported on Discord by (.+?)\.?\s*$/;
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

export function launcherItem(item: FeedbackItem & BoardItem, authors: Record<string, Profile>): LauncherItem {
  const { type, platforms } = typeAndPlatforms(item.tags);
  const typeTag = item.tags.find((tag) => !platforms.includes(tag.name)) ?? null;
  const platformTag = item.tags.find((tag) => platforms.includes(tag.name)) ?? null;
  const profile = authors[item.id];
  const reported = item.description.match(reporter)?.[1];
  const author = profile
    ? { name: shownName(profile.name, profile.username), avatar: profile.avatar || null }
    : reported
      ? { name: reported, avatar: null }
      : item.author?.name
        ? { name: item.author.name, avatar: item.author.avatar ?? null }
        : null;
  const tags = [
    ...(typeLabel[type] ? [{ name: typeLabel[type], color: hex(kinds[type].color) }] : []),
    ...platforms.map((name) => ({ name, color: item.tags.find((tag) => tag.name === name)?.color || "#9ca3af" })),
  ];
  return {
    id: item.id,
    title: item.title,
    description: item.description.replace(reporter, "").trim(),
    status: item.status,
    score: item.voteCount,
    myVote: item.hasVoted ? "up" : item.hasDownvoted ? "down" : null,
    commentCount: item.commentCount,
    createdAt: item.createdAt,
    completedAt: item.status === "completed" ? (item.completedAt ?? item.updatedAt) : null,
    tags,
    author,
    typeId: typeTag?.id ?? null,
    platformId: platformTag?.id ?? null,
  };
}

// The types an admin can give an item, as the launcher names them.
export const typeName = (slug: string) => typeLabel[slug] ?? "Other";
