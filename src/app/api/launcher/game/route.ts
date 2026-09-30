import { gameFiles } from "@/lib/downloads";

// The game's files for the launcher's Download tab (sp-launcher src-tauri/src/download.rs): each
// file's path, size and SHA-256, which the launcher checks every download against. The files come
// from the team's Storj bucket through links from ./link; this list lives here and not in the
// bucket, so a file changed there is refused. Made by scripts/game-files.mjs; the same for everyone
// until the next deploy.
export const dynamic = "force-static";

export function GET() {
  return Response.json({ files: gameFiles });
}
