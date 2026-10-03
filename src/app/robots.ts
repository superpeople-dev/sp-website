import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

const aiCrawlers = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "DuckAssistBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    // The API answers the site's own pages; it has nothing to index. Nor do the replays of reported
    // matches (lib/replays.ts), whose pages are only reached through the staff's links.
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/replays/"] },
      { userAgent: aiCrawlers, allow: "/", disallow: ["/api/", "/replays/"] },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
