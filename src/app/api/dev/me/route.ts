import type { NextRequest } from "next/server";
import { devJson, devUser } from "@/lib/devapi";

// Who the API key belongs to, to check a key before using it.
export async function GET(request: NextRequest) {
  const { user, error } = await devUser(request);
  if (error) return error;
  return devJson({
    id: user.id,
    name: user.name,
    username: user.username,
    owner: user.owner,
    permissions: user.permissions,
    key: user.via,
  });
}
