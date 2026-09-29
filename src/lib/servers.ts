// The game server list, from the backend's public route (sp-backend: GET /ds/api/listen/public).
// That route never carries addresses; it answers 404 until listenServers.publicStatus is on.
const statusUrl = process.env.SERVER_STATUS_URL || "http://64.226.112.204:8080/ds/api/listen/public";
const REVALIDATE_SECONDS = 15;

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
  return {
    name,
    online,
    mode: modes.has(raw.mode as Mode) ? (raw.mode as Mode) : "any",
    view: views.has(raw.view as View) ? (raw.view as View) : "any",
    match: online ? matchOf(raw.state_index, raw.map) : null,
    players: online ? players : null,
    country,
    continent: named ?? located,
  };
}

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
