import { notFound } from "next/navigation";
import { Band } from "@/components/Band";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";
import { Gallery } from "@/components/Gallery";
import { Help } from "@/components/Help";
import { Hero } from "@/components/Hero";
import { JsonLd } from "@/components/JsonLd";
import { Nav } from "@/components/Nav";
import { LatestNews } from "@/components/news/LatestNews";
import { Progress } from "@/components/Progress";
import { Steps } from "@/components/Steps";
import { Story } from "@/components/Story";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLatestRelease } from "@/lib/github";
import { listNews, newsReady } from "@/lib/news";
import { fallbackProgress, getProgress } from "@/lib/progress";
import { getServers, playersOnline } from "@/lib/servers";
import { structuredData } from "@/lib/seo";

export const revalidate = 300;

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const [release, progress, servers, news] = await Promise.all([
    getLatestRelease(),
    getProgress(),
    getServers(),
    // The news row must never take the home page down with it.
    newsReady ? listNews(3).catch((error) => (console.error(`[news] home: ${error instanceof Error ? error.message : String(error)}`), [])) : Promise.resolve([]),
  ]);

  return (
    <>
      <JsonLd data={structuredData(release, lang)} />
      <Nav downloadUrl={release.downloadUrl} />
      <Hero release={release} players={playersOnline(servers)} />
      <main>
        <Story />
        <Steps downloadUrl={release.downloadUrl} />
        <LatestNews posts={news} />
        <Progress lists={progress ?? fallbackProgress(t.progress)} />
        <Gallery />
        <Help />
        <Faq />
        <Band downloadUrl={release.downloadUrl} />
      </main>
      <Footer t={t} locale={lang} />
    </>
  );
}
