import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { AccountBar } from "@/components/roadmap/AccountBar";
import { PageHead } from "@/components/roadmap/PageHead";
import { PlanBoard } from "@/components/roadmap/PlanBoard";
import { isLocale, localeHref } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLatestRelease } from "@/lib/github";
import { getTags, listByStatus, safely, userToken } from "@/lib/reflet";
import { pageMetadata } from "@/lib/seo";
import { authReady, currentSession, viewerOf } from "@/lib/session";
import { isBanned, storeReady } from "@/lib/store";

export async function generateMetadata({ params }: PageProps<"/[lang]/roadmap">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return pageMetadata(lang, "/roadmap");
}

export default async function RoadmapPage({ params }: PageProps<"/[lang]/roadmap">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const session = await currentSession();
  const [release, items, tags, banned] = await Promise.all([
    getLatestRelease(),
    safely(async () => {
      const token = session ? await userToken(session) : undefined;
      const lists = await Promise.all([
        listByStatus("planned", 10, token),
        listByStatus("in_progress", 10, token),
        listByStatus("completed", 1),
      ]);
      return lists.flat();
    }),
    safely(getTags),
    session ? isBanned(session.id) : false,
  ]);
  const viewer = viewerOf(session, { banned, moderation: storeReady });
  const categories = tags?.categories;
  const types = tags?.types;

  return (
    <>
      <Nav downloadUrl={release.downloadUrl} page="/roadmap" />
      <main>
        <PageHead title={t.plan.title} lead={t.plan.lead} notice={items ? null : t.board.unavailable}>
          {items && <AccountBar authReady={authReady} next={localeHref(lang, "/roadmap")} viewer={viewer} />}
        </PageHead>
        {items && (
          <PlanBoard
            initial={items}
            categories={categories ?? []}
            types={types ?? []}
            viewer={viewer}
            authReady={authReady}
          />
        )}
      </main>
      <Footer t={t} locale={lang} />
    </>
  );
}
