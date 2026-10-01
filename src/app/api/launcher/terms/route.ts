import type { NextRequest } from "next/server";
import { launcherTerms, termsVersion } from "@/lib/launcher";
import { readSession, sameOrigin } from "@/lib/session";
import { acceptTerms, termsAcceptanceOf } from "@/lib/store";

// The terms the launcher asks the player to accept before Play (lib/launcher.ts), and whether this
// Discord account has accepted the current version.
export async function GET(request: NextRequest) {
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  const acceptance = await termsAcceptanceOf(user.id);
  if (acceptance === undefined) return Response.json({ error: "unavailable" }, { status: 503 });
  return Response.json(
    { ...launcherTerms(), accepted: acceptance?.version === termsVersion, acceptedAt: acceptance?.at ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// The player accepted, with the version the launcher showed: if the terms changed in between, they
// read the new ones first (409).
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { version?: unknown } | null;
  if (body?.version !== termsVersion) return Response.json({ error: "changed", version: termsVersion }, { status: 409 });
  const at = Date.now();
  try {
    await acceptTerms(user.id, { version: termsVersion, at });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
  return Response.json({ accepted: true, version: termsVersion, acceptedAt: at }, { headers: { "Cache-Control": "no-store" } });
}
