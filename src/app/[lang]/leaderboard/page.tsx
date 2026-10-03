import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { Leaderboard } from "@/components/leaderboard/Leaderboard";
import { Nav } from "@/components/Nav";
import { PageHead } from "@/components/roadmap/PageHead";
import { headArt } from "@/lib/art";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLatestRelease } from "@/lib/github";
import { busiestKey, getLeaderboard, keyOfParam } from "@/lib/leaderboard";
import { pageMetadata, pageStructuredData } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/leaderboard">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return pageMetadata(lang, "/leaderboard");
}

export default async function LeaderboardPage({ params, searchParams }: PageProps<"/[lang]/leaderboard">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const [release, board, query] = await Promise.all([getLatestRelease(), getLeaderboard(), searchParams]);
  // A shared link (?mode=squad-fpp) opens on its list; else the list with the most players.
  const first = board && (keyOfParam(query.mode) ?? busiestKey(board));

  return (
    <>
      <JsonLd data={pageStructuredData(lang, "/leaderboard")} />
      <Nav downloadUrl={release.downloadUrl} page="/leaderboard" />
      <main>
        <PageHead art={headArt.leaderboard} title={t.leaderboard.title} lead={t.leaderboard.lead} notice={board ? null : t.leaderboard.unavailable} />
        {board && first && <Leaderboard board={board} initialKey={first} />}
      </main>
      <Footer t={t} locale={lang} />
    </>
  );
}
