import type { StaticImageData } from "next/image";
import bazooka from "@/assets/game/fig-bazooka.webp";
import tactical from "@/assets/game/fig-tactical.webp";
import whitehair from "@/assets/game/fig-whitehair.webp";
import gun01 from "@/assets/game/gun-01.webp";
import gun02 from "@/assets/game/gun-02.webp";
import gun03 from "@/assets/game/gun-03.webp";
import gun04 from "@/assets/game/gun-04.webp";
import gun05 from "@/assets/game/gun-05.webp";
import gun06 from "@/assets/game/gun-06.webp";
import gun07 from "@/assets/game/gun-07.webp";
import gun08 from "@/assets/game/gun-08.webp";
import gun09 from "@/assets/game/gun-09.webp";
import gun10 from "@/assets/game/gun-10.webp";
import gun11 from "@/assets/game/gun-11.webp";
import gun12 from "@/assets/game/gun-12.webp";
import gun13 from "@/assets/game/gun-13.webp";
import gun14 from "@/assets/game/gun-14.webp";
import headCompleted from "@/assets/game/head-completed.webp";
import headFaq from "@/assets/game/head-faq.webp";
import headIdeas from "@/assets/game/head-ideas.webp";
import headLeaderboard from "@/assets/game/head-leaderboard.webp";
import headRoadmap from "@/assets/game/head-roadmap.webp";
import headServers from "@/assets/game/head-servers.webp";
import loc01 from "@/assets/game/loc-01.webp";
import loc02 from "@/assets/game/loc-02.webp";
import loc03 from "@/assets/game/loc-03.webp";
import loc04 from "@/assets/game/loc-04.webp";
import loc05 from "@/assets/game/loc-05.webp";
import loc06 from "@/assets/game/loc-06.webp";
import loc07 from "@/assets/game/loc-07.webp";
import loc08 from "@/assets/game/loc-08.webp";
import loc09 from "@/assets/game/loc-09.webp";
import loc10 from "@/assets/game/loc-10.webp";
import loc11 from "@/assets/game/loc-11.webp";
import loc12 from "@/assets/game/loc-12.webp";
import loc13 from "@/assets/game/loc-13.webp";
import loc14 from "@/assets/game/loc-14.webp";

// The game's own artwork: character cutouts from the lobby's season sheet, OrbIsland's location
// panoramas from the map guide, and key art from the official Steam news posts. Decorative only.

// One key art behind each page head (components/roadmap/PageHead).
export const headArt = {
  leaderboard: headLeaderboard,
  servers: headServers,
  roadmap: headRoadmap,
  ideas: headIdeas,
  completed: headCompleted,
  faq: headFaq,
} satisfies Record<string, StaticImageData>;

export const figures = { bazooka, tactical, whitehair };

// The island strip under the gallery (components/Locations).
export const locations: StaticImageData[] = [loc01, loc02, loc03, loc04, loc05, loc06, loc07, loc08, loc09, loc10, loc11, loc12, loc13, loc14];

// Weapon skins from the item icons, a second strip under the island (components/Locations).
export const guns: StaticImageData[] = [gun01, gun02, gun03, gun04, gun05, gun06, gun07, gun08, gun09, gun10, gun11, gun12, gun13, gun14];
