import { ImageResponse } from "next/og";
import { isLocale } from "@/i18n/config";
import { dictionaries } from "@/i18n/dictionaries";
import { assetDataUrl, googleFont, imageLocale, ogColors as c, ogSize } from "@/lib/og";
import { itemPreview, pageOf, sharedItem, type BoardPage } from "@/lib/share";
import { downvoteCounts } from "@/lib/store";

// The link preview of an item page (/ideas/<id>/<slug>…), like Reddit's: the title, the start of
// the description, the upvotes and downvotes and the status. Drawn on request (votes change), kept
// by the CDN for five minutes: /og/<lang>/item/<id>.png.

const art: Record<BoardPage, string> = { "/ideas": "powers", "/roadmap": "vehicle", "/completed": "tower" };
const statusColor: Record<string, string> = { open: c.dim, planned: "#f0b719", in_progress: "#ff6d5e", completed: "#3ddc84" };

const titleSize = (title: string) => (title.length <= 28 ? 92 : title.length <= 50 ? 76 : title.length <= 80 ? 62 : 54);
const cut = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text);

function Chevron({ down, color }: { down?: boolean; color: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24">
      <path d={down ? "m6 9 6 6 6-6" : "m6 15 6-6 6 6"} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
  const up = String(item.voteCount);
  const down = String((await downvoteCounts([item.id]))[item.id] ?? 0);
  const footer = "SUPER PEOPLE · OPEN SOURCE";
  const condensed = [tagline, status, title, up, down, footer].join("");

  const [heavy, bold, body, picture, logo] = await Promise.all([
    googleFont("Barlow Condensed", 800, condensed),
    googleFont("Barlow Condensed", 700, condensed),
    googleFont("Barlow", 500, preview || "a"),
    assetDataUrl(`og/${art[pageOf(item.status)]}.jpg`, "image/jpeg"),
    assetDataUrl("sp-logo.png", "image/png"),
  ]);

  const pill = (color: string, border: string, fill: string) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    height: 64,
    padding: "0 22px 0 16px",
    border: `2px solid ${border}`,
    borderRadius: 8,
    background: fill,
    color,
    fontSize: 40,
    fontWeight: 800,
  });

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
                padding: "6px 14px",
                border: `2px solid ${statusColor[item.status] ?? c.dim}`,
                borderRadius: 4,
                color: statusColor[item.status] ?? c.dim,
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
              <div style={{ marginTop: 18, fontFamily: "Barlow", fontSize: 28, fontWeight: 500, lineHeight: 1.35, color: c.muted }}>
                {preview}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 34 }}>
            <div style={pill(c.blue, "rgba(143,176,255,0.6)", "rgba(143,176,255,0.12)")}>
              <Chevron color={c.blue} />
              {up}
            </div>
            <div style={pill(c.red, "rgba(239,68,56,0.7)", "rgba(239,68,56,0.12)")}>
              <Chevron down color={c.red} />
              {down}
            </div>
            <div style={{ marginLeft: "auto", fontSize: 26, fontWeight: 700, letterSpacing: 1.5, color: c.dim }}>{footer}</div>
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
