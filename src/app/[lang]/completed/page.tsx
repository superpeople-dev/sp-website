import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { AccountBar } from "@/components/roadmap/AccountBar";
import { Changelog } from "@/components/roadmap/Changelog";
import { CompletedList } from "@/components/roadmap/CompletedList";
import { PageHead } from "@/components/roadmap/PageHead";
import { isLocale, localeHref } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLatestRelease } from "@/lib/github";
import { getTags, getChangelog, listByStatus, safely } from "@/lib/reflet";
import { pageMetadata } from "@/lib/seo";
import { followItem, itemParam, sharedItem, sharedPreview } from "@/lib/share";
import { withDownvotes } from "@/lib/votes";
import { authReady, currentSession, viewerOf } from "@/lib/session";
import { isBanned, storeReady } from "@/lib/store";

export async function generateMetadata({ params, searchParams }: PageProps<"/[lang]/completed">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const shared = await sharedItem(itemParam((await searchParams).item));
  return pageMetadata(lang, "/completed", sharedPreview(shared));
}

export default async function CompletedPage({ params, searchParams }: PageProps<"/[lang]/completed">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
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
  const board = items && (await withDownvotes(items, session?.id));
  if (items) await followItem(lang, "/completed", itemParam((await searchParams).item), (id) => items.some((item) => item.id === id));
  const categories = tags?.categories;
  const types = tags?.types;

  return (
    <>
      <Nav downloadUrl={release.downloadUrl} page="/completed" />
      <main>
        <PageHead title={t.completed.title} lead={t.completed.lead} notice={items ? null : t.board.unavailable}>
          {items && <AccountBar authReady={authReady} next={localeHref(lang, "/completed")} viewer={viewer} />}
        </PageHead>
        {board && (
          <CompletedList
            initial={board}
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
