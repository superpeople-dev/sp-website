import type { NextRequest } from "next/server";
import { admins } from "@/lib/admins";
import { listPending } from "@/lib/reflet";
import { readSession } from "@/lib/session";
import { authorsOf, listBans, storeReady } from "@/lib/store";

export async function GET(request: NextRequest) {
  const user = await readSession(request);
  if (!user?.admin) return Response.json({ error: "forbidden" }, { status: user ? 403 : 401 });
  const pending = await listPending().catch(() => null);
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
      bans: storeReady ? await listBans() : null,
      admins: admins.map((admin) => admin.name),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
