import { getLatestRelease } from "@/lib/github";

export async function GET() {
  const { downloadUrl } = await getLatestRelease();
  return Response.redirect(downloadUrl, 302);
}
