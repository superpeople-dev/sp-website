import { launcherApi, siteRequest } from "./launcher";
import { banOf } from "./store";

// What stops a player from playing, for the launcher (app/api/launcher/me and pass): a ban on this site
// (the bot's /ban and /tempban, or a ban from a comment) or one on their game account (sp-backend: a
// suspension or ban made in the game's admin panel, which this site does not store), whichever lasts
// longer. until: null for a ban until lifted. inMatch: they are in a match right now, so the launcher
// lets that round finish before it closes the game.
export type PlayBan = { reason: string; at: number; until: number | null; inMatch: boolean };

type GameStatus = { status?: string; until?: string | null; reason?: string; since?: string | null; in_match?: boolean };

// sp-backend POST /launcher/api/site/status, asked with a request only this site can sign. Nothing (an
// older backend, no key, no answer in 3 s) means: what this site knows is all there is.
async function gameStatusOf(discordId: string): Promise<GameStatus | null> {
  try {
    const response = await fetch(`${launcherApi()}/site/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request: siteRequest("status", { d: discordId }) }),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    return response.ok ? ((await response.json()) as GameStatus) : null;
  } catch {
    return null;
  }
}

const timeOf = (iso: string | null | undefined) => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : null;
};

export async function playBanOf(discordId: string): Promise<PlayBan | null> {
  const [site, game] = await Promise.all([banOf(discordId), gameStatusOf(discordId)]);
  const inMatch = game?.in_match === true;
  const fromSite: PlayBan | null = site ? { reason: site.reason ?? "", at: site.at, until: site.until ?? null, inMatch } : null;
  const blocked = game?.status === "suspended" || game?.status === "revoked";
  const fromGame: PlayBan | null = blocked
    ? {
        reason: game?.reason ?? "",
        at: timeOf(game?.since) ?? Date.now(),
        until: game?.status === "revoked" ? null : timeOf(game?.until),
        inMatch,
      }
    : null;
  if (!fromSite || !fromGame) return fromSite ?? fromGame;
  // Both: the one that lasts longer, a ban until lifted the longest.
  if (fromSite.until === null) return fromSite;
  if (fromGame.until === null) return fromGame;
  return fromSite.until >= fromGame.until ? fromSite : fromGame;
}
