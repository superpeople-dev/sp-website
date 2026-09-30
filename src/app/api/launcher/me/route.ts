import type { NextRequest } from "next/server";
import { profileOfSession } from "@/lib/launcher";
import { readSession } from "@/lib/session";
import { isBanned } from "@/lib/store";

// Who the launcher's session belongs to; 401 once it has expired, so the launcher asks to connect again.
export async function GET(request: NextRequest) {
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  return Response.json(
    { profile: profileOfSession(user), banned: await isBanned(user.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
