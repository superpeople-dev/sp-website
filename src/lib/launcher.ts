import { createHash, createPrivateKey, randomUUID, sign } from "node:crypto";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import { shownName, type BoardItem } from "./board";
import { kinds, typeAndPlatforms } from "./kinds";
import type { SessionUser } from "./session";
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

export const profileOfSession = (user: SessionUser) => ({ id: user.id, name: user.name, username: user.username, avatar: user.avatar });

// ------------------------------------------------------------- game pass ---
// Pressing Play, the launcher asks for a pass and hands it to the game backend (sp-backend,
// POST /launcher/api/session/discord), which finds the player's account by Discord id. The pass is
// signed with an Ed25519 key only this site has (LAUNCHER_PASS_KEY); the backend holds the public
// half, so it can check a pass but never make one. Two minutes, and the backend takes each once.

const passKey = process.env.LAUNCHER_PASS_KEY;
export const passReady = Boolean(passKey);
const passLifetime = 120_000;

export type GamePass = { d: string; u: string; n: string; exp: number; j: string };

export function gamePass(user: SessionUser): string {
  if (!passKey) throw new Error("LAUNCHER_PASS_KEY is not set");
  const key = createPrivateKey({ key: Buffer.from(passKey, "base64"), format: "der", type: "pkcs8" });
  const pass: GamePass = { d: user.id, u: user.username, n: user.name, exp: Date.now() + passLifetime, j: randomUUID() };
  const body = Buffer.from(JSON.stringify(pass)).toString("base64url");
  return `${body}.${sign(null, Buffer.from(body), key).toString("base64url")}`;
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
  };
}
