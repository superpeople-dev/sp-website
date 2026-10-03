import type { NextConfig } from "next";

const pages = ["news", "servers", "leaderboard", "bugs-and-ideas", "roadmap", "completed", "faq", "terms", "privacy"];
// Pages with pages under them: /news/<slug>, /bugs-and-ideas/<id>/<slug> and so on.
const boards = ["news", "bugs-and-ideas", "roadmap", "completed"];
// Pages that moved: the old links (shared, posted on Discord, found by search engines) keep working.
const moved = [
  { from: "ideas", to: "bugs-and-ideas" },
  { from: "idea", to: "bugs-and-ideas" },
];

const nextConfig: NextConfig = {
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 2560, 3200, 3840, 4096],
    // 90 for the game's artwork (lib/art.ts), which is mostly key art with fine detail.
    qualities: [75, 90],
    remotePatterns: [{ protocol: "https", hostname: "cdn.discordapp.com" }],
  },
  experimental: {
    globalNotFound: true,
  },
  async rewrites() {
    return [
      { source: "/", destination: "/en" },
      ...pages.map((page) => ({ source: `/${page}`, destination: `/en/${page}` })),
      ...boards.map((board) => ({ source: `/${board}/:path+`, destination: `/en/${board}/:path+` })),
    ];
  },
  async redirects() {
    return [
      { source: "/en", destination: "/", permanent: true },
      ...pages.map((page) => ({ source: `/en/${page}`, destination: `/${page}`, permanent: true })),
      ...boards.map((board) => ({ source: `/en/${board}/:path+`, destination: `/${board}/:path+`, permanent: true })),
      // English has no /en prefix, so /en/<old> goes straight to /<new>; the other languages keep theirs.
      ...moved.flatMap(({ from, to }) => [
        { source: `/${from}`, destination: `/${to}`, permanent: true },
        { source: `/${from}/:path+`, destination: `/${to}/:path+`, permanent: true },
        { source: `/en/${from}`, destination: `/${to}`, permanent: true },
        { source: `/en/${from}/:path+`, destination: `/${to}/:path+`, permanent: true },
        { source: `/:lang([a-z]{2})/${from}`, destination: `/:lang/${to}`, permanent: true },
        { source: `/:lang([a-z]{2})/${from}/:path+`, destination: `/:lang/${to}/:path+`, permanent: true },
      ]),
    ];
  },
};

export default nextConfig;
