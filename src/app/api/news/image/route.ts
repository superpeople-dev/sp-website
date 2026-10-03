import type { NextRequest } from "next/server";
import { isNewsKey } from "@/lib/news";
import { objectsReady, viewLink } from "@/lib/objects";

// A news image (cover or a picture in the text): the browser is sent on to a short-lived link to the
// private bucket. The redirect itself is cached for 50 minutes, well inside the link's hour.
export function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!isNewsKey(key) || !objectsReady) return new Response("Not found", { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: viewLink(key, 3600), "Cache-Control": "public, max-age=3000, s-maxage=3000" },
  });
}
