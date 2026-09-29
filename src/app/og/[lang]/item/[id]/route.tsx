import { ImageResponse } from "next/og";
import { isLocale } from "@/i18n/config";
import { dictionaries } from "@/i18n/dictionaries";
import { assetDataUrl, googleFont, imageLocale, ogColors as c, ogSize } from "@/lib/og";
import { itemPreview, pageOf, sharedItem, type BoardPage } from "@/lib/share";
import { downvoteCounts } from "@/lib/store";

// The link preview of an item page (/ideas/<id>/<slug>…), like a Reddit post's: the status, the
// title, the start of the description, then the score (upvotes minus downvotes) and the number of
// comments. Drawn on request (votes change), kept by the CDN for five minutes: /og/<lang>/item/<id>.png.

const art: Record<BoardPage, string> = { "/ideas": "powers", "/roadmap": "vehicle", "/completed": "tower" };
// The status is a filled badge: red for open ideas, light text on red and dark text on the lighter colours.
const statusColor: Record<string, string> = { open: c.red, planned: "#f0b719", in_progress: "#ff6d5e", completed: "#3ddc84" };
const statusText: Record<string, string> = { open: c.paper, planned: c.ink, in_progress: c.ink, completed: c.ink };

const titleSize = (title: string) => (title.length <= 28 ? 92 : title.length <= 50 ? 76 : title.length <= 80 ? 62 : 54);
const cut = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text);

// Reddit's outlined arrow and speech bubble.
const icons = {
  score: "M12 3.5 4 12h5v8.5h6V12h5z",
  comments: "M12 4c-4.7 0-8.5 3.2-8.5 7.2 0 2.2 1.1 4.1 2.9 5.4L5.7 20.5l4.3-2a10 10 0 0 0 2 .2c4.7 0 8.5-3.2 8.5-7.3S16.7 4 12 4z",
};

function Stat({ icon, value }: { icon: keyof typeof icons; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 42, fontWeight: 700, color: c.paper }}>
      <svg width="38" height="38" viewBox="0 0 24 24">
        <path d={icons[icon]} fill="none" stroke={c.muted} strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      {value}
    </div>
  );
}

export async function GET(_request: Request, { params }: RouteContext<"/og/[lang]/item/[id]">) {
  const { lang, id } = await params;
  const item = isLocale(lang) ? await sharedItem(id.replace(/\.png$/, "")) : null;
  if (!isLocale(lang) || !item || item.status === "under_review" || item.status === "closed") {
    return new Response("Not found", { status: 404 });
  }

  const locale = imageLocale(lang);
  const d = dictionaries[locale];
  const tagline = d.nav.tagline.toLocaleUpperCase(locale);
  const status = d.board.status[item.status].toLocaleUpperCase(locale);
  const title = cut(item.title, 110).toLocaleUpperCase();
  const preview = itemPreview(item, 150);
  const score = String(item.voteCount - ((await downvoteCounts([item.id]))[item.id] ?? 0));
  const comments = String(item.commentCount);
  const condensed = [tagline, status, title, score, comments].join("");

  const [heavy, bold, body, picture, logo] = await Promise.all([
    googleFont("Barlow Condensed", 800, condensed),
    googleFont("Barlow Condensed", 700, condensed),
    googleFont("Barlow", 500, preview || "a"),
    assetDataUrl(`og/${art[pageOf(item.status)]}.jpg`, "image/jpeg"),
    assetDataUrl("sp-logo.png", "image/png"),
  ]);

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: 1200, height: 630, background: c.ink, fontFamily: "Barlow Condensed", color: c.paper }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
        <img src={picture} width={760} height={630} alt="" style={{ position: "absolute", top: 0, right: 0 }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            backgroundImage:
              "linear-gradient(90deg, #0a0a0c 0%, #0a0a0c 45%, rgba(10,10,12,0.9) 62%, rgba(10,10,12,0.6) 82%, rgba(10,10,12,0.4) 100%)",
          }}
        />
        <div style={{ position: "absolute", left: 0, bottom: 0, width: 1200, height: 10, background: c.red }} />
        <div style={{ display: "flex", flexDirection: "column", width: 1200, height: 620, padding: "52px 64px 48px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
            <img src={logo} width={105} height={48} alt="" />
            <div style={{ marginLeft: 22, fontSize: 24, fontWeight: 700, letterSpacing: 1.5, color: c.dim }}>{tagline}</div>
            <div
              style={{
                marginLeft: "auto",
                padding: "8px 16px",
                borderRadius: 4,
                background: statusColor[item.status] ?? c.red,
                color: statusText[item.status] ?? c.paper,
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 2,
              }}
            >
              {status}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", maxWidth: 1072 }}>
            <div style={{ fontSize: titleSize(title), fontWeight: 800, lineHeight: 1.02 }}>{title}</div>
            {preview && (
              <div style={{ maxWidth: 960, marginTop: 18, fontFamily: "Barlow", fontSize: 28, fontWeight: 500, lineHeight: 1.35, color: c.muted }}>
                {preview}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 34 }}>
            <Stat icon="score" value={score} />
            <Stat icon="comments" value={comments} />
          </div>
        </div>
      </div>
    ),
    {
      ...ogSize,
      fonts: [
        { name: "Barlow Condensed", data: heavy, weight: 800, style: "normal" },
        { name: "Barlow Condensed", data: bold, weight: 700, style: "normal" },
        { name: "Barlow", data: body, weight: 500, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400" },
    },
  );
}
