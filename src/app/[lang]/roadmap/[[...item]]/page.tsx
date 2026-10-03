import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { Nav } from "@/components/Nav";
import { AccountBar } from "@/components/roadmap/AccountBar";
import { PageHead } from "@/components/roadmap/PageHead";
import { headArt } from "@/lib/art";
import { PlanBoard } from "@/components/roadmap/PlanBoard";
import { isLocale, localeHref } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLatestRelease } from "@/lib/github";
import { getTags, listByStatus, safely, userToken } from "@/lib/reflet";
import { pageMetadata, pageStructuredData } from "@/lib/seo";
import { itemSegments, settleItem, sharedPage } from "@/lib/share";
import { forBoard } from "@/lib/votes";
import { authReady, currentSession, viewerOf } from "@/lib/session";
import { isBanned, storeReady } from "@/lib/store";

export async function generateMetadata({ params }: PageProps<"/[lang]/roadmap/[[...item]]">): Promise<Metadata> {
  const { lang, item } = await params;
  if (!isLocale(lang)) notFound();
  return pageMetadata(lang, "/roadmap", await sharedPage(itemSegments(item)?.id));
}

export default async function RoadmapPage({ params, searchParams }: PageProps<"/[lang]/roadmap/[[...item]]">) {
  const { lang, item } = await params;
  if (!isLocale(lang)) notFound();
  // An item page (/roadmap/<id>/<slug>), or an old ?item=<id> link that is sent to one.
  const legacy = (await searchParams).item;
  const wanted = itemSegments(item) ?? (typeof legacy === "string" ? { id: legacy, slug: "?" } : null);
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
  const board = items && (await forBoard(items, session?.id));
  if (board) await settleItem(lang, "/roadmap", wanted, (id) => board.find((entry) => entry.id === id));
  // The item's page describes the item itself to search engines.
  const shared = wanted ? await sharedPage(wanted.id) : null;
  const categories = tags?.categories;
  const types = tags?.types;

  return (
    <>
      <JsonLd data={pageStructuredData(lang, "/roadmap", shared)} />
      <Nav downloadUrl={release.downloadUrl} page="/roadmap" />
      <main>
        <PageHead art={headArt.roadmap} title={t.plan.title} lead={t.plan.lead} notice={items ? null : t.board.unavailable}>
          {items && <AccountBar authReady={authReady} next={localeHref(lang, "/roadmap")} viewer={viewer} />}
        </PageHead>
        {board && (
          <PlanBoard
            initial={board}
            openId={wanted?.id}
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
