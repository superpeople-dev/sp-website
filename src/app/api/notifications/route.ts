import type { NextRequest } from "next/server";
import { readSession, sameOrigin } from "@/lib/session";
import { markNoticesSeen, readNotices } from "@/lib/store";

const noStore = { "Cache-Control": "no-store" };

// The signed-in person's notifications (the bell): assigned a task, mentioned in a comment.
export async function GET(request: NextRequest) {
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401, headers: noStore });
  return Response.json(await readNotices(user.id), { headers: noStore });
}

// They opened the list: what is there now is no longer new.
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const user = await readSession(request);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  await markNoticesSeen(user.id);
  return Response.json({ ok: true });
}
