import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { PageHead } from "@/components/roadmap/PageHead";
import { ServerList } from "@/components/servers/ServerList";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLatestRelease } from "@/lib/github";
import { pageMetadata } from "@/lib/seo";
import { getServers } from "@/lib/servers";

export async function generateMetadata({ params }: PageProps<"/[lang]/servers">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  // The preview image shows how many servers are up: its link changes with that count.
  const servers = await getServers();
  const online = servers?.servers.filter((server) => server.online).length ?? 0;
  return pageMetadata(lang, "/servers", null, servers ? `${online}of${servers.servers.length}` : "");
}

export default async function ServersPage({ params }: PageProps<"/[lang]/servers">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const [release, servers] = await Promise.all([getLatestRelease(), getServers()]);

  return (
    <>
      <Nav downloadUrl={release.downloadUrl} page="/servers" />
      <main>
        <PageHead title={t.servers.title} lead={t.servers.lead} notice={servers ? null : t.servers.unavailable} />
        {servers && <ServerList initial={servers} />}
      </main>
      <Footer t={t} locale={lang} />
    </>
  );
}
