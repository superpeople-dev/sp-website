import type { NextRequest } from "next/server";
import { gameFiles } from "@/lib/downloads";
import { gameFileLink, signingReady, storageProbe, storageSettings } from "@/lib/s3";
import { readSession } from "@/lib/session";

// For admins, in the browser: tries the game's storage the way a launcher does (a link to one small
// file, then its first bytes) and shows what Storj answered, with its own error code and message.
// Never the key: only its length, and whether spaces were pasted along with it.
export async function GET(request: NextRequest) {
  const user = await readSession(request);
  if (!user?.admin) return Response.json({ error: "forbidden" }, { status: user ? 403 : 401 });
  const settings = storageSettings();
  if (!signingReady) {
    return Response.json({ ok: false, problem: "STORJ_ACCESS_KEY_ID or STORJ_SECRET_ACCESS_KEY is not set in Vercel", settings });
  }
  // What the key may do besides reading a file: see buckets, list the game's folder.
  const probe = async (kind: "buckets" | "list") => {
    try {
      const response = await fetch(storageProbe(kind), { cache: "no-store" });
      const body = (await response.text()).slice(0, 20000);
      const tag = kind === "buckets" ? "Name" : "Key";
      return {
        status: response.status,
        code: body.match(/<Code>([^<]*)<\/Code>/)?.[1] ?? null,
        seen: [...body.matchAll(new RegExp(`<${tag}>([^<]*)</${tag}>`, "g"))].map((m) => m[1]).slice(0, 10),
      };
    } catch (error) {
      return { problem: error instanceof Error ? error.message : String(error) };
    }
  };
  const [buckets, list] = await Promise.all([probe("buckets"), probe("list")]);
  const file = [...gameFiles].sort((a, b) => a.size - b.size).find((f) => f.size >= 16) ?? gameFiles[0];
  const started = Date.now();
  try {
    const response = await fetch(gameFileLink(file.path, 60), { headers: { Range: "bytes=0-15" }, cache: "no-store" });
    const body = response.ok ? "" : (await response.text()).slice(0, 2000);
    return Response.json(
      {
        ok: response.ok,
        status: response.status,
        // S3's own words for a refusal: SignatureDoesNotMatch, AccessDenied, InvalidAccessKeyId, NoSuchKey...
        code: body.match(/<Code>([^<]*)<\/Code>/)?.[1] ?? null,
        message: body.match(/<Message>([^<]*)<\/Message>/)?.[1] ?? null,
        file: file.path,
        ms: Date.now() - started,
        buckets,
        list,
        settings,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json({ ok: false, problem: error instanceof Error ? error.message : String(error), file: file.path, settings });
  }
}
