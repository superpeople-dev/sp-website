import { hasFlag } from "country-flag-icons";
import { statusUrl } from "./servers";

// The season leaderboard: each mode's in-game Top 100, from the backend's public route next to the
// server list (sp-backend: GET /ds/api/listen/public/leaderboard). Only what the lobby shows every
// player: in-game name, RP, tier and country. The route answers 404 until it is deployed and
// listenServers.publicStatus is on.
const leaderboardUrl = `${statusUrl}/leaderboard`;
const REVALIDATE_SECONDS = 60;

export const leaderModes = ["solo", "duo", "trio", "squad"] as const;
export const leaderViews = ["tpp", "fpp"] as const;
export type LeaderMode = (typeof leaderModes)[number];
export type LeaderView = (typeof leaderViews)[number];
export type LeaderKey = `${LeaderMode}_${LeaderView}`;
// The lists in the game's order: Solo TPP, Solo FPP, Duo TPP and so on.
export const leaderKeys = leaderModes.flatMap((mode) => leaderViews.map((view): LeaderKey => `${mode}_${view}`));

// rank from 1; tier: the game's tier id (tierOf); country: an ISO code the site has a flag for, or null.
export type LeaderRow = { rank: number; name: string; rp: number; tier: number; country: string | null };
export type Leaderboard = { updated: number; lists: Record<LeaderKey, LeaderRow[]> };

function rowsOf(value: unknown): LeaderRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((raw: { rank?: unknown; name?: unknown; rp?: unknown; tier?: unknown; country?: unknown }) => {
      const rank = Number(raw?.rank);
      const rp = Number(raw?.rp);
      if (!Number.isInteger(rank) || rank < 1 || !Number.isFinite(rp)) return [];
      const country = typeof raw.country === "string" && /^[A-Z]{2}$/.test(raw.country) && hasFlag(raw.country) ? raw.country : null;
      return [{ rank, name: String(raw.name ?? "").trim() || "?", rp, tier: Number(raw.tier) || 0, country }];
    })
    .slice(0, 100);
}

// Null when the backend cannot be reached or doesn't have the route (yet).
export async function getLeaderboard(): Promise<Leaderboard | null> {
  try {
    const res = await fetch(leaderboardUrl, { cache: "force-cache", next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    const body = (await res.json()) as { d?: { updated?: unknown; modes?: unknown } };
    const modes = body.d?.modes;
    if (!modes || typeof modes !== "object") return null;
    const lists = Object.fromEntries(leaderKeys.map((key) => [key, rowsOf((modes as Record<string, unknown>)[key])])) as Record<LeaderKey, LeaderRow[]>;
    const updated = Number(body.d?.updated);
    return { updated: Number.isFinite(updated) ? updated : Math.floor(Date.now() / 1000), lists };
  } catch {
    return null;
  }
}

// A list in a link: ?mode=squad-fpp.
export const keyOfParam = (value: unknown): LeaderKey | null => {
  const key = typeof value === "string" ? value.toLowerCase().replace("-", "_") : "";
  return (leaderKeys as string[]).includes(key) ? (key as LeaderKey) : null;
};
export const paramOfKey = (key: LeaderKey) => key.replace("_", "-");

// The list a visitor sees first: the one with the most ranked players (the first one when all are empty).
export const busiestKey = (board: Leaderboard) =>
  leaderKeys.reduce((best, key) => (board.lists[key].length > board.lists[best].length ? key : best), leaderKeys[0]);

export type TierGroup = "superSoldier" | "legendary" | "grandMaster" | "master" | "diamond" | "platinum" | "gold" | "silver" | "bronze" | "iron";

// The game's tier ids (sp-backend lib/tables.js): 420100001 Super Soldier, 420100002 Legendary,
// 420100003 Grand Master, 420100004 Master, then Diamond I (420100005) down to Iron V (420100034).
const ladder: Record<number, TierGroup> = { 420100001: "superSoldier", 420100002: "legendary", 420100003: "grandMaster", 420100004: "master" };
const groups: TierGroup[] = ["diamond", "platinum", "gold", "silver", "bronze", "iron"];
const steps = ["I", "II", "III", "IV", "V"];

// icon: the game's own 64px tier icon (TBL-SeasonTier SmallIcon, cut from the Sprite_Tier_01 sheet),
// public/tiers/<id - 420100000>.png.
export function tierOf(id: number): { group: TierGroup; step: string | null; icon: string } | null {
  const icon = `/tiers/${id - 420100000}.png`;
  if (ladder[id]) return { group: ladder[id], step: null, icon };
  const offset = id - 420100005;
  if (!Number.isInteger(offset) || offset < 0 || offset >= groups.length * steps.length) return null;
  return { group: groups[Math.floor(offset / steps.length)], step: steps[offset % steps.length], icon };
}
