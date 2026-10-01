import type { StaticImageData } from "next/image";
import powers from "@/assets/powers.jpg";
import vehicle from "@/assets/vehicle.jpg";
import jetpack from "@/assets/jetpack.jpg";
import squad from "@/assets/squad.jpg";
import fight from "@/assets/fight.jpg";
import tower from "@/assets/tower.jpg";

export const site = {
  repo: "superpeople-dev/sp-launcher",
  discord: "https://discord.com/invite/superpeopleofficial",
};

export const contactEmail = "contact@superpeople.dev";

export const repoUrl = `https://github.com/${site.repo}`;
export const releasesUrl = `${repoUrl}/releases/latest`;

export const history: { date: string; tone?: "off" | "on" }[] = [
  { date: "2022" },
  { date: "2023-08", tone: "off" },
  { date: "2025-09" },
  { date: "2026-02", tone: "off" },
  { date: "2026-09", tone: "on" },
];

export const openStatuses: ("wip" | "next")[] = ["wip", "wip", "wip", "next", "next"];

export const nextPlaytestProgress = 70;

export const originalPriceUsd = 14.99;

export const seoHiddenFaq = [0];

export const ideaLimits = { title: 60, titleMax: 100, description: 2000, comment: 1000, pending: 3 };

export const mediaLimits = {
  files: 4,
  image: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  types: ["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"],
};

export const ideaTypes = [
  { slug: "bug-report", icon: "bug" },
  { slug: "feature-request", icon: "sparkle" },
  { slug: "enhancement", icon: "trend" },
  { slug: "question", icon: "question" },
  { slug: "other", icon: "other" },
] as const;

export const legalUpdated = "2026-10-01";

export const galleryImages: StaticImageData[] = [powers, vehicle, jetpack, squad, fight, tower];
