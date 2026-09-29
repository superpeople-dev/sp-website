import type { NextRequest } from "next/server";
import { can } from "@/lib/board";
import { listPending } from "@/lib/reflet";
import { readSession } from "@/lib/session";
import { listStaff } from "@/lib/staff";
import { authorsOf, listBans, storeReady } from "@/lib/store";

// The admin panel's data. Each admin gets the parts their permissions cover (null otherwise).
export async function GET(request: NextRequest) {
  const user = await readSession(request);
  if (!user?.admin) return Response.json({ error: "forbidden" }, { status: user ? 403 : 401 });
  const pending = can(user, "review") ? await listPending().catch(() => null) : null;
  const authors = pending ? await authorsOf(pending.map((item) => item.id)) : {};
  return Response.json(
    {
      pending:
        pending?.map((item) => ({
          id: item.id,
          title: item.title,
          createdAt: item.createdAt,
          author: authors[item.id]?.name ?? item.author?.name ?? null,
        })) ?? null,
      bans: storeReady && can(user, "bans") ? await listBans() : null,
      staff: await listStaff(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
