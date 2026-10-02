import { categoryUrl, liveStreams, twitchReady } from "@/lib/twitch";

// The launcher's Twitch tab: who is live in the SUPER PEOPLE category (lib/twitch.ts). Public, like
// Twitch's own directory. configured: false until the Twitch app's keys are set; streams null when
// Twitch could not be reached.
export async function GET() {
  const streams = await liveStreams();
  return Response.json({ configured: twitchReady, streams, category: categoryUrl }, { headers: { "Cache-Control": "public, max-age=60" } });
}
