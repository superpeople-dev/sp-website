// The game server list, from the backend's public route (sp-backend: GET /ds/api/listen/public).
// That route never carries addresses; it answers 404 until listenServers.publicStatus is on.
export const statusUrl = process.env.SERVER_STATUS_URL || "http://64.226.112.204:8080/ds/api/listen/public";
const REVALIDATE_SECONDS = 15;
// The charts' samples (sp-backend lib/listen-history.js), a new point every 5 minutes at most.
const HISTORY_REVALIDATE_SECONDS = 60;

export type Mode = "any" | "solo" | "duo" | "trio" | "squad";
export type View = "any" | "fpp" | "tpp";
export type MatchState = "waiting" | "starting" | "running" | "over" | "between" | null;
export type Continent = "africa" | "asia" | "europe" | "northAmerica" | "southAmerica" | "oceania" | "antarctica";

export type GameServer = {
  name: string;
  online: boolean;
  mode: Mode;
  view: View;
  match: MatchState;
  players: number | null;
  // Round trip in ms between the backend and the server (not the visitor's own ping), while online.
  ping: number | null;
  country: string | null;
  continent: Continent | null;
};

export type ServerList = { updated: number; servers: GameServer[] };

type RawServer = {
  name?: unknown;
  online?: unknown;
  mode?: unknown;
  view?: unknown;
  state_index?: unknown;
  map?: unknown;
  players?: unknown;
  ping?: unknown;
  country?: unknown;
};

const modes = new Set<Mode>(["any", "solo", "duo", "trio", "squad"]);
const views = new Set<View>(["any", "fpp", "tpp"]);

// EBattleRoyaleState: 1 Waiting, 2 Ready, 3 CheckStartPlay, 4 Play, 5 MatchEnd. After a round the host
// drops to the title map until it restarts (same reading as sp-bot/src/statusboard.js).
function matchOf(stateIndex: unknown, map: unknown): MatchState {
  if (/^LV-Title/i.test(String(map ?? ""))) return "between";
  const states: Record<number, MatchState> = { 1: "waiting", 2: "starting", 3: "starting", 4: "running", 5: "over" };
  return states[Number(stateIndex)] ?? null;
}

// Which continent each country code is on. Browsers do not translate continent codes, so the names
// come from the dictionaries (servers.continents).
const continentCountries: Record<Continent, string> = {
  africa: "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW",
  asia: "AF AM AZ BH BD BT BN KH CN CY GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE",
  europe: "AX AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB VA",
  northAmerica: "AI AG AW BS BB BZ BM BQ VG CA KY CR CU CW DM DO SV GL GD GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC SX TT TC US VI UM",
  southAmerica: "AR BO BV BR CL CO EC FK GF GY PY PE GS SR UY VE",
  oceania: "AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF",
  antarctica: "AQ TF HM",
};
const continentOf = new Map(
  (Object.entries(continentCountries) as [Continent, string][]).flatMap(([continent, list]) =>
    list.split(" ").map((cc) => [cc, continent] as const),
  ),
);

// A region at the start of the name ("EU SOLO", "NA-DUO"), chosen by whoever runs the server. It
// beats the address lookup: a server behind a tunnel (playit.gg) has the tunnel's address, often on
// another continent. SA is South America here, as in games.
const nameRegions: [RegExp, Continent][] = [
  [/^(eu|euw|eune|europe)\b/i, "europe"],
  [/^(na|nae|naw|us|usa|north america)\b/i, "northAmerica"],
  [/^(sa|br|latam|south america)\b/i, "southAmerica"],
  [/^(asia|sea|jp|kr)\b/i, "asia"],
  [/^(oce|au|oceania)\b/i, "oceania"],
  [/^(africa)\b/i, "africa"],
];

function toServer(raw: RawServer): GameServer {
  const online = raw.online === true;
  const name = String(raw.name ?? "").trim() || "Server";
  const found = typeof raw.country === "string" && /^[A-Z]{2}$/.test(raw.country) ? raw.country : null;
  const named = nameRegions.find(([pattern]) => pattern.test(name))?.[1] ?? null;
  const located = found ? (continentOf.get(found) ?? null) : null;
  // A country on another continent than the name says is the tunnel's, not the server's: rather
  // show only the name's region than a wrong country (backend: country= in listen-servers.txt).
  const country = named && located && named !== located ? null : found;
  const players = Number.isInteger(raw.players) && (raw.players as number) >= 0 ? (raw.players as number) : null;
  const ping = Number.isInteger(raw.ping) && (raw.ping as number) >= 0 ? (raw.ping as number) : null;
  return {
    name,
    online,
    mode: modes.has(raw.mode as Mode) ? (raw.mode as Mode) : "any",
    view: views.has(raw.view as View) ? (raw.view as View) : "any",
    match: online ? matchOf(raw.state_index, raw.map) : null,
    players: online ? players : null,
    ping: online ? ping : null,
    country,
    continent: named ?? located,
  };
}

// Players on the online servers, null while the backend's list is unavailable.
export const playersOnline = (list: ServerList | null) =>
  list ? list.servers.reduce((sum, server) => sum + (server.online ? (server.players ?? 0) : 0), 0) : null;

// Online servers first, then by name. Null when the backend cannot be reached or has the route off.
export async function getServers(): Promise<ServerList | null> {
  try {
    const res = await fetch(statusUrl, { cache: "force-cache", next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    const body = (await res.json()) as { d?: { updated?: unknown; servers?: unknown } };
    if (!Array.isArray(body.d?.servers)) return null;
    const servers = (body.d.servers as RawServer[])
      .map(toServer)
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
    const updated = Number(body.d.updated);
    return { updated: Number.isFinite(updated) ? updated : Math.floor(Date.now() / 1000), servers };
  } catch {
    return null;
  }
}

// The charts' periods: 5-minute points over 24 hours, 30-minute over 7 days, 2-hour over 30 days.
export const historyRanges = ["24h", "7d", "30d"] as const;
export type HistoryRange = (typeof historyRanges)[number];
export const isHistoryRange = (value: unknown): value is HistoryRange => historyRanges.includes(value as HistoryRange);

// One bucket: its start (unix seconds), the share of checks the server was online (0 to 1), the
// average and the most players while online, the average ping while online. A bucket without any
// check is not there.
export type HistoryPoint = { t: number; up: number; players: number | null; peak: number | null; ping: number | null };
export type ServerHistory = { range: HistoryRange; bucket: number; from: number; to: number; servers: { name: string; points: HistoryPoint[] }[] };

const numberOrNull = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);

// Null when the backend cannot be reached, is older than the charts or has the list off.
export async function getHistory(range: HistoryRange): Promise<ServerHistory | null> {
  try {
    const res = await fetch(`${statusUrl}/history?range=${range}`, { cache: "force-cache", next: { revalidate: HISTORY_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    const body = (await res.json()) as { d?: { bucket?: unknown; from?: unknown; to?: unknown; servers?: unknown } };
    const d = body.d;
    if (!d || !Array.isArray(d.servers) || typeof d.bucket !== "number" || typeof d.from !== "number" || typeof d.to !== "number") return null;
    const servers = (d.servers as { name?: unknown; points?: unknown }[]).map((srv) => ({
      name: String(srv.name ?? "").trim() || "Server",
      points: (Array.isArray(srv.points) ? (srv.points as unknown[]) : [])
        .filter((p): p is unknown[] => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number")
        .map((p) => ({ t: p[0] as number, up: p[1] as number, players: numberOrNull(p[2]), peak: numberOrNull(p[3]), ping: numberOrNull(p[4]) })),
    }));
    return { range, bucket: d.bucket, from: d.from, to: d.to, servers };
  } catch {
    return null;
  }
}

// The player chart's periods (sp-backend lib/player-history.js): the three above, and every day so far.
export const playerRanges = ["24h", "7d", "30d", "all"] as const;
export type PlayerRange = (typeof playerRanges)[number];
export const isPlayerRange = (value: unknown): value is PlayerRange => playerRanges.includes(value as PlayerRange);

// One bucket: its start (unix seconds), the average and the most players online, the average in the
// lobby and in a match. unique: different players over 24 hours, 7 and 30 days (counted since `since`,
// the first day sampled), and all: every player account. Counts only, no names.
export type PlayerPoint = { t: number; online: number; peak: number; lobby: number; match: number };
export type PlayerHistory = {
  range: PlayerRange;
  bucket: number;
  from: number;
  to: number;
  points: PlayerPoint[];
  unique: { "24h": number; "7d": number; "30d": number; all: number | null };
  since: number | null;
};

const count = (value: unknown) => numberOrNull(value) ?? 0;

// Null when the backend cannot be reached, is older than the player chart or has the list off.
export async function getPlayerHistory(range: PlayerRange): Promise<PlayerHistory | null> {
  try {
    const res = await fetch(`${statusUrl}/players?range=${range}`, { cache: "force-cache", next: { revalidate: HISTORY_REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    const body = (await res.json()) as { d?: { bucket?: unknown; from?: unknown; to?: unknown; points?: unknown; unique?: Record<string, unknown>; since?: unknown } };
    const d = body.d;
    if (!d || !Array.isArray(d.points) || typeof d.bucket !== "number" || typeof d.from !== "number" || typeof d.to !== "number") return null;
    const points = (d.points as unknown[])
      .filter((p): p is unknown[] => Array.isArray(p) && typeof p[0] === "number")
      .map((p) => ({ t: p[0] as number, online: count(p[1]), peak: count(p[2]), lobby: count(p[3]), match: count(p[4]) }));
    const unique = d.unique ?? {};
    return {
      range,
      bucket: d.bucket,
      from: d.from,
      to: d.to,
      points,
      unique: { "24h": count(unique["24h"]), "7d": count(unique["7d"]), "30d": count(unique["30d"]), all: numberOrNull(unique.all) },
      since: numberOrNull(d.since),
    };
  } catch {
    return null;
  }
}
