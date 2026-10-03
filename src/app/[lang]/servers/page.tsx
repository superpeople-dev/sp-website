import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { Nav } from "@/components/Nav";
import { PageHead } from "@/components/roadmap/PageHead";
import { headArt } from "@/lib/art";
import { ServerList } from "@/components/servers/ServerList";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLatestRelease } from "@/lib/github";
import { pageMetadata, pageStructuredData } from "@/lib/seo";
import { getHistory, getPlayerHistory, getServers } from "@/lib/servers";

export async function generateMetadata({ params }: PageProps<"/[lang]/servers">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return pageMetadata(lang, "/servers");
}

export default async function ServersPage({ params }: PageProps<"/[lang]/servers">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const [release, servers, history, players] = await Promise.all([getLatestRelease(), getServers(), getHistory("24h"), getPlayerHistory("24h")]);

  return (
    <>
      <JsonLd data={pageStructuredData(lang, "/servers")} />
      <Nav downloadUrl={release.downloadUrl} page="/servers" />
      <main>
        <PageHead art={headArt.servers} title={t.servers.title} lead={t.servers.lead} notice={servers ? null : t.servers.unavailable} />
        {servers && <ServerList initial={servers} history={history} players={players} />}
      </main>
      <Footer t={t} locale={lang} />
    </>
  );
}
