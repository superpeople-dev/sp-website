import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { Nav } from "@/components/Nav";
import { NewsList } from "@/components/news/NewsList";
import { PageHead } from "@/components/roadmap/PageHead";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { headArt } from "@/lib/art";
import { can } from "@/lib/board";
import { getLatestRelease } from "@/lib/github";
import { listNews, newsReady } from "@/lib/news";
import { pageMetadata, pageStructuredData } from "@/lib/seo";
import { currentSession } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/[lang]/news">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return pageMetadata(lang, "/news");
}

export default async function NewsPage({ params }: PageProps<"/[lang]/news">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const [release, posts, session] = await Promise.all([getLatestRelease(), newsReady ? listNews(lang, 60) : Promise.resolve([]), currentSession()]);

  return (
    <>
      <JsonLd data={pageStructuredData(lang, "/news")} />
      <Nav downloadUrl={release.downloadUrl} page="/news" />
      <main>
        <PageHead art={headArt.news} title={t.news.title} lead={t.news.lead}>
          {can(session, "manage") && (
            <Link href="/news/write" className="btn btn--sm btn--primary news-write">
              <Icon name="edit" /> {t.news.write}
            </Link>
          )}
        </PageHead>
        <section className="flush">
          <div className="wrap">
            <NewsList posts={posts} />
          </div>
        </section>
      </main>
      <Footer t={t} locale={lang} />
    </>
  );
}
