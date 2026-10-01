import type { NextRequest } from "next/server";

// Who is on the other end of a request: their IP and where they are.
//
// superpeople.dev runs on Vercel behind Cloudflare's proxy, so the connection Vercel sees comes from
// a Cloudflare server (an address like 172.69.x.x, located wherever that server is), not from the
// player. Cloudflare passes the player's own address in CF-Connecting-IP, and their country in
// CF-IPCountry (and region in CF-Region-Code, with its "Add visitor location headers" transform on).
// Those headers are believed only when the connection really came from Cloudflare: anyone who
// reaches Vercel directly could send them made up. Otherwise it is Vercel's own view, as before.

// Cloudflare's published ranges, https://www.cloudflare.com/ips (checked 2026-10-01).
const CLOUDFLARE = [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18",
  "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17",
  "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32",
  "2a06:98c0::/29", "2c0f:f248::/32",
];

// An IPv4 address as 4 bytes, an IPv6 one as 16, anything else null.
export function bytesOf(ip: string): number[] | null {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4) {
    const bytes = v4.slice(1).map(Number);
    return bytes.every((byte) => byte <= 255) ? bytes : null;
  }
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) return bytesOf(mapped[1]);
  if (!/^[0-9a-fA-F:]{2,39}$/.test(ip)) return null;
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const groups = (part: string) => (part ? part.split(":") : []);
  const head = groups(halves[0]);
  const tail = halves.length === 2 ? groups(halves[1]) : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (all.some((group) => !/^[0-9a-fA-F]{1,4}$/.test(group))) return null;
  return all.flatMap((group) => {
    const value = parseInt(group, 16);
    return [value >> 8, value & 255];
  });
}

const ranges = CLOUDFLARE.map((cidr) => {
  const [ip, bits] = cidr.split("/");
  return { bytes: bytesOf(ip) as number[], bits: Number(bits) };
});

export function fromCloudflare(ip: string) {
  const bytes = bytesOf(ip);
  if (!bytes) return false;
  return ranges.some((range) => {
    if (range.bytes.length !== bytes.length) return false;
    for (let i = 0, left = range.bits; left > 0; i++, left -= 8) {
      const mask = left >= 8 ? 255 : (255 << (8 - left)) & 255;
      if ((bytes[i] & mask) !== (range.bytes[i] & mask)) return false;
    }
    return true;
  });
}

// The address Vercel saw the connection come from (its own headers, which a client cannot set).
function peerOf(request: NextRequest) {
  const forwarded = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || request.headers.get("x-real-ip")?.trim() || "";
}

// The player's IP: Cloudflare's CF-Connecting-IP when the connection came through Cloudflare,
// else the address Vercel saw.
export function clientIp(request: NextRequest) {
  const peer = peerOf(request);
  if (fromCloudflare(peer)) {
    const real = request.headers.get("cf-connecting-ip")?.trim() ?? "";
    if (bytesOf(real)) return real;
  }
  return peer || "unknown";
}

// Where the player is: country and region, never the city. Through Cloudflare from its headers,
// else from Vercel's. Unknown and Tor ("XX", "T1") read as unknown.
export function clientLocation(request: NextRequest) {
  const viaCloudflare = fromCloudflare(peerOf(request));
  const country = request.headers.get(viaCloudflare ? "cf-ipcountry" : "x-vercel-ip-country")?.trim().toUpperCase();
  if (!country || !/^[A-Z]{2}$/.test(country) || country === "XX" || country === "T1") return undefined;
  const region = request.headers.get(viaCloudflare ? "cf-region-code" : "x-vercel-ip-country-region")?.trim().toUpperCase();
  return { country, region: region && /^[A-Z0-9]{1,3}$/.test(region) ? region : undefined };
}
