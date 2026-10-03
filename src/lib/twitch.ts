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
// Streams are asked for at most once a minute, whoever opens the tab; a channel's clips every 10 minutes.
const CACHE_MS = 60_000;
const MAX_STREAMS = 24;
const CLIPS_MS = 10 * 60_000;
const CLIPS_SHOWN = 4;
const CLIP_DAYS = 30;

// One of a channel's most watched SUPER PEOPLE clips of the last 30 days.
export type Clip = { title: string; url: string; thumbnail: string; views: number; seconds: number; createdAt: string };

export type Stream = {
  login: string;
  name: string;
  title: string;
  viewers: number;
  // 440x248 preview, refreshed by Twitch every few minutes.
  thumbnail: string;
  startedAt: string;
  language: string;
  // The channel: its picture, its bio, "partner" or "affiliate" (else ""), when it joined Twitch.
  avatar: string;
  bio: string;
  badge: "partner" | "affiliate" | "";
  since: string;
  // The stream's own tags ("Portuguese", "FPS", ...) and whether it is marked for mature audiences.
  tags: string[];
  mature: boolean;
  clips: Clip[];
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

type RawStream = {
  user_id: string;
  user_login: string;
  user_name: string;
  title: string;
  viewer_count: number;
  thumbnail_url: string;
  started_at: string;
  language: string;
  tags?: string[] | null;
  is_mature?: boolean;
};
type RawUser = { id: string; description: string; profile_image_url: string; broadcaster_type: string; created_at: string };
type RawClip = { url: string; title: string; thumbnail_url: string; view_count: number; duration: number; created_at: string; game_id: string };

const said = (error: unknown) => (error instanceof Error ? error.message : String(error));

// The channels of these streams, in one call (Twitch takes up to 100 ids). Without them the streams
// still show, just without the channel's details.
async function channelsOf(ids: string[]) {
  if (!ids.length) return new Map<string, RawUser>();
  try {
    const { data } = await helix<{ data: RawUser[] }>(`/users?${ids.map((id) => `id=${encodeURIComponent(id)}`).join("&")}`);
    return new Map(data.map((user) => [user.id, user]));
  } catch (error) {
    console.error(`[twitch] channels: ${said(error)}`);
    return new Map<string, RawUser>();
  }
}

// A channel's most watched SUPER PEOPLE clips of the last 30 days (Twitch lists a channel's clips by
// views, any game; the others are left out). Kept 10 minutes per channel.
const clipsKept = new Map<string, { at: number; clips: Clip[] }>();
async function clipsOf(userId: string, game: string) {
  const kept = clipsKept.get(userId);
  if (kept && Date.now() - kept.at < CLIPS_MS) return kept.clips;
  try {
    const since = new Date(Date.now() - CLIP_DAYS * 86_400_000).toISOString();
    const { data } = await helix<{ data: RawClip[] }>(
      `/clips?broadcaster_id=${encodeURIComponent(userId)}&started_at=${encodeURIComponent(since)}&first=50`,
    );
    const clips = data
      .filter((clip) => clip.game_id === game)
      .sort((a, b) => b.view_count - a.view_count)
      .slice(0, CLIPS_SHOWN)
      .map((clip) => ({
        title: clip.title,
        url: clip.url,
        thumbnail: clip.thumbnail_url,
        views: clip.view_count,
        seconds: Math.round(clip.duration),
        createdAt: clip.created_at,
      }));
    clipsKept.set(userId, { at: Date.now(), clips });
    return clips;
  } catch (error) {
    console.error(`[twitch] clips: ${said(error)}`);
    return kept?.clips ?? [];
  }
}

// The live streams in the SUPER PEOPLE category, most viewers first. Null when Twitch is not set up or
// cannot be reached (the last list is kept for a minute either way).
export async function liveStreams(): Promise<Stream[] | null> {
  if (!twitchReady) return null;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.streams;
  try {
    const game = await category();
    const { data } = await helix<{ data: RawStream[] }>(`/streams?game_id=${game}&type=live&first=${MAX_STREAMS}`);
    const [channels, clips] = await Promise.all([
      channelsOf(data.map((s) => s.user_id)),
      Promise.all(data.map((s) => clipsOf(s.user_id, game))),
    ]);
    const streams = data
      .map((s, i): Stream => {
        const channel = channels.get(s.user_id);
        const badge = channel?.broadcaster_type;
        return {
          login: s.user_login,
          name: s.user_name || s.user_login,
          title: s.title,
          viewers: s.viewer_count,
          thumbnail: s.thumbnail_url.replace("{width}", "440").replace("{height}", "248"),
          startedAt: s.started_at,
          language: s.language,
          avatar: channel?.profile_image_url ?? "",
          bio: channel?.description?.trim() ?? "",
          badge: badge === "partner" || badge === "affiliate" ? badge : "",
          since: channel?.created_at ?? "",
          tags: s.tags ?? [],
          mature: s.is_mature === true,
          clips: clips[i],
        };
      })
      .sort((a, b) => b.viewers - a.viewers);
    cached = { at: Date.now(), streams };
    return streams;
  } catch (error) {
    console.error(`[twitch] ${said(error)}`);
    return cached?.streams ?? null;
  }
}
