import { bytesOf } from "./clientip";
import { dbReady, getExpiring, setExpiring } from "./db";

// A player's IPv4 address, for #launcher-logs when their PC also has IPv6. The site is reached over
// IPv6 when the PC has it, so the launcher checks in once over IPv4 just before it reports a game
// start (app/api/launcher/ipv4); the address the site saw is kept here for a few minutes, and the
// report shows it next to the one it came from. Both are what the site saw, never what the
// launcher says.

const KEEP_SECONDS = 5 * 60;
const key = (userId: string) => `ipv4:${userId}`;

export const isIpv4 = (ip: string) => bytesOf(ip)?.length === 4;

export async function rememberIpv4(userId: string, ip: string) {
  if (!dbReady || !isIpv4(ip)) return false;
  await setExpiring(key(userId), ip, KEEP_SECONDS);
  return true;
}

export async function recentIpv4(userId: string) {
  if (!dbReady) return undefined;
  const ip = await getExpiring<string>(key(userId)).catch(() => null);
  return typeof ip === "string" && isIpv4(ip) ? ip : undefined;
}
