import { avatarSource, isAvatarHash } from "@/lib/leaderboard";

// A leaderboard player's Discord avatar, by its hash (sp-backend GET /ds/api/listen/public/avatar):
// the backend is plain HTTP, the site is not, so the picture comes through here. A changed avatar has a
// new hash, so a day of caching is safe.
const DAY = 86_400;

export async function GET(_request: Request, { params }: RouteContext<"/api/leaderboard/avatar/[hash]">) {
  const { hash } = await params;
  if (!isAvatarHash(hash)) return new Response(null, { status: 404 });
  const res = await fetch(avatarSource(hash), { next: { revalidate: DAY } }).catch(() => null);
  if (!res?.ok || !res.headers.get("content-type")?.startsWith("image/png")) return new Response(null, { status: 502 });
  return new Response(await res.arrayBuffer(), {
    headers: { "Content-Type": "image/png", "Cache-Control": `public, max-age=${DAY}, immutable` },
  });
}
