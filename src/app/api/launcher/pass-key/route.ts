import { passPublicKey } from "@/lib/launcher";

// The public half of the pass key (lib/launcher.ts passPublicKey), for builds that check the site's
// signatures themselves (sp-native's console lock). Public, it only checks signatures.
export function GET() {
  const key = passPublicKey();
  if (!key) return Response.json({ error: "unavailable" }, { status: 404 });
  return Response.json({ key }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
