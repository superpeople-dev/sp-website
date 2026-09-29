import type { NextConfig } from "next";

const pages = ["servers", "ideas", "roadmap", "completed", "terms", "privacy"];

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
    ];
  },
  async redirects() {
    return [
      { source: "/en", destination: "/", permanent: true },
      ...pages.map((page) => ({ source: `/en/${page}`, destination: `/${page}`, permanent: true })),
    ];
  },
};

export default nextConfig;
