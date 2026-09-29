import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { Nav } from "@/components/Nav";
import { AccountBar } from "@/components/roadmap/AccountBar";
import { Changelog } from "@/components/roadmap/Changelog";
import { CompletedList } from "@/components/roadmap/CompletedList";
import { PageHead } from "@/components/roadmap/PageHead";
import { isLocale, localeHref } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLatestRelease } from "@/lib/github";
import { getTags, getChangelog, listByStatus, safely } from "@/lib/reflet";
import { pageMetadata, pageStructuredData } from "@/lib/seo";
import { itemSegments, settleItem, sharedPage } from "@/lib/share";
import { forBoard } from "@/lib/votes";
import { authReady, currentSession, viewerOf } from "@/lib/session";
import { isBanned, storeReady } from "@/lib/store";

export async function generateMetadata({ params }: PageProps<"/[lang]/completed/[[...item]]">): Promise<Metadata> {
  const { lang, item } = await params;
  if (!isLocale(lang)) notFound();
  return pageMetadata(lang, "/completed", await sharedPage(itemSegments(item)?.id));
}

export default async function CompletedPage({ params, searchParams }: PageProps<"/[lang]/completed/[[...item]]">) {
  const { lang, item } = await params;
  if (!isLocale(lang)) notFound();
  // An item page (/completed/<id>/<slug>), or an old ?item=<id> link that is sent to one.
  const legacy = (await searchParams).item;
  const wanted = itemSegments(item) ?? (typeof legacy === "string" ? { id: legacy, slug: "?" } : null);
  const t = getDictionary(lang);
  const session = await currentSession();
  const [release, items, tags, banned, changelog] = await Promise.all([
    getLatestRelease(),
    safely(() => listByStatus("completed")),
    safely(getTags),
    session ? isBanned(session.id) : false,
    safely(getChangelog),
  ]);
  const viewer = viewerOf(session, { banned, moderation: storeReady });
  const board = items && (await forBoard(items, session?.id));
  if (board) await settleItem(lang, "/completed", wanted, (id) => board.find((entry) => entry.id === id));
  // The item's page describes the item itself to search engines.
  const shared = wanted ? await sharedPage(wanted.id) : null;
  const categories = tags?.categories;
  const types = tags?.types;

  return (
    <>
      <JsonLd data={pageStructuredData(lang, "/completed", shared)} />
      <Nav downloadUrl={release.downloadUrl} page="/completed" />
      <main>
        <PageHead title={t.completed.title} lead={t.completed.lead} notice={items ? null : t.board.unavailable}>
          {items && <AccountBar authReady={authReady} next={localeHref(lang, "/completed")} viewer={viewer} />}
        </PageHead>
        {board && (
          <CompletedList
            initial={board}
            openId={wanted?.id}
            categories={categories ?? []}
            types={types ?? []}
            viewer={viewer}
            authReady={authReady}
          />
        )}
        {changelog && changelog.length > 0 && <Changelog entries={changelog} t={t.completed} locale={lang} />}
      </main>
      <Footer t={t} locale={lang} />
    </>
  );
}
