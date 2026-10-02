// Live SUPER PEOPLE streams on Twitch, for the launcher's Twitch tab (app/api/launcher/streams).
// Twitch's API needs an application: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET from
// dev.twitch.tv/console (an app token, no user sign-in). Without them there is nothing to ask and the
// tab says streams are not set up. TWITCH_GAME_ID can name the category; else it is looked up by name.

const clientId = process.env.TWITCH_CLIENT_ID?.trim() ?? "";
const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim() ?? "";
export const twitchReady = Boolean(clientId && clientSecret);

// The category's page on Twitch, for "See all on Twitch".
export const categoryUrl = "https://www.twitch.tv/directory/category/super-people";
const categoryName = "SUPER PEOPLE";
// Streams are asked for at most once a minute, whoever opens the tab.
const CACHE_MS = 60_000;
const MAX_STREAMS = 24;

export type Stream = {
  login: string;
  name: string;
  title: string;
  viewers: number;
  // 440x248 preview, refreshed by Twitch every few minutes.
  thumbnail: string;
  startedAt: string;
  language: string;
};

let token: { value: string; until: number } | null = null;
let gameId = process.env.TWITCH_GAME_ID?.trim() || "";
let cached: { at: number; streams: Stream[] } | null = null;

async function appToken() {
  if (token && Date.now() < token.until) return token.value;
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`twitch token ${res.status}`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("twitch token: none");
  // A minute's margin before Twitch's own expiry.
  token = { value: body.access_token, until: Date.now() + Math.max(0, (body.expires_in ?? 3600) - 60) * 1000 };
  return token.value;
}

async function helix<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    headers: { "Client-Id": clientId, Authorization: `Bearer ${await appToken()}` },
    cache: "no-store",
  });
  // A token Twitch dropped early: the next call makes a new one.
  if (res.status === 401) token = null;
  if (!res.ok) throw new Error(`twitch ${path.split("?")[0]} ${res.status}`);
  return (await res.json()) as T;
}

async function category() {
  if (gameId) return gameId;
  const { data } = await helix<{ data: { id: string; name: string }[] }>(`/games?name=${encodeURIComponent(categoryName)}`);
  gameId = data[0]?.id ?? "";
  if (!gameId) throw new Error("twitch: no SUPER PEOPLE category");
  return gameId;
}

type RawStream = { user_login: string; user_name: string; title: string; viewer_count: number; thumbnail_url: string; started_at: string; language: string };

// The live streams in the SUPER PEOPLE category, most viewers first. Null when Twitch is not set up or
// cannot be reached (the last list is kept for a minute either way).
export async function liveStreams(): Promise<Stream[] | null> {
  if (!twitchReady) return null;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.streams;
  try {
    const { data } = await helix<{ data: RawStream[] }>(`/streams?game_id=${await category()}&type=live&first=${MAX_STREAMS}`);
    const streams = data
      .map((s) => ({
        login: s.user_login,
        name: s.user_name || s.user_login,
        title: s.title,
        viewers: s.viewer_count,
        thumbnail: s.thumbnail_url.replace("{width}", "440").replace("{height}", "248"),
        startedAt: s.started_at,
        language: s.language,
      }))
      .sort((a, b) => b.viewers - a.viewers);
    cached = { at: Date.now(), streams };
    return streams;
  } catch (error) {
    console.error(`[twitch] ${error instanceof Error ? error.message : String(error)}`);
    return cached?.streams ?? null;
  }
}
