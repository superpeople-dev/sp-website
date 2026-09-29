import type { NextConfig } from "next";

const pages = ["servers", "ideas", "roadmap", "completed", "terms", "privacy"];
// Boards whose items have their own pages: /ideas/<id>/<slug> and so on.
const boards = ["ideas", "roadmap", "completed"];

const nextConfig: NextConfig = {
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 2560, 3200, 3840, 4096],
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
    ];
  },
};

export default nextConfig;
