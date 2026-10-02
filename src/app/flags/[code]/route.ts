import * as flags from "country-flag-icons/string/3x2";

// A country's flag as an image (/flags/de.svg), for the leaderboard: emoji flags don't show on Windows.
// Built at deploy time from country-flag-icons (MIT), one file per country code.

export const dynamicParams = false;

const svgs: Record<string, string> = flags;

export function generateStaticParams() {
  return Object.keys(svgs).map((code) => ({ code: `${code.toLowerCase()}.svg` }));
}

export async function GET(_request: Request, { params }: RouteContext<"/flags/[code]">) {
  const { code } = await params;
  const svg = svgs[code.replace(/\.svg$/, "").toUpperCase()];
  if (!svg) return new Response("Not found", { status: 404 });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000, immutable" } });
}
