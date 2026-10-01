import { backup, gameFiles } from "@/lib/downloads";
import { signingReady } from "@/lib/s3";

// The game's files for the launcher's Download tab (sp-launcher src-tauri/src/download.rs): each
// file's path, size and SHA-256, which the launcher checks every download against. The files come
// from the team's Storj bucket through links from ./link; this list lives here and not in the
// bucket, so a file changed there is refused. Made by scripts/game-files.mjs; the same for everyone
// until the next deploy.
//
// "backup" is the same game as one archive on archive.org, where the launcher quietly turns when
// the bucket can't serve (its limit reached, blocked where the player is). With "only", launchers
// go there at once: Storj isn't set up, or GAME_DOWNLOADS=backup in Vercel switches it off.
export const dynamic = "force-static";

export function GET() {
  const only = !signingReady || process.env.GAME_DOWNLOADS === "backup";
  return Response.json({ files: gameFiles, backup: { ...backup, only } });
}
