import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { Nav } from "@/components/Nav";
import { AccountBar } from "@/components/roadmap/AccountBar";
import { IdeasBoard } from "@/components/roadmap/IdeasBoard";
import { PageHead } from "@/components/roadmap/PageHead";
import { isLocale, localeHref } from "@/i18n/config";
import { can } from "@/lib/board";
import { getDictionary } from "@/i18n/dictionaries";
import { getLatestRelease } from "@/lib/github";
import { pendingCount } from "@/lib/authorship";
import { getTags, listByStatus, listPending, safely, userToken } from "@/lib/reflet";
import { pageMetadata, pageStructuredData } from "@/lib/seo";
import { itemSegments, settleItem, sharedPage } from "@/lib/share";
import { forBoard } from "@/lib/votes";
import { authReady, currentSession, viewerOf } from "@/lib/session";
import { isBanned, storeReady } from "@/lib/store";

export async function generateMetadata({ params }: PageProps<"/[lang]/bugs-and-ideas/[[...item]]">): Promise<Metadata> {
  const { lang, item } = await params;
  if (!isLocale(lang)) notFound();
  return pageMetadata(lang, "/bugs-and-ideas", await sharedPage(itemSegments(item)?.id));
}

export default async function IdeasPage({ params, searchParams }: PageProps<"/[lang]/bugs-and-ideas/[[...item]]">) {
  const { lang, item } = await params;
  if (!isLocale(lang)) notFound();
  // An item page (/bugs-and-ideas/<id>/<slug>), or an old ?item=<id> link that is sent to one.
  const legacy = (await searchParams).item;
  const wanted = itemSegments(item) ?? (typeof legacy === "string" ? { id: legacy, slug: "?" } : null);
  const t = getDictionary(lang);
  const session = await currentSession();
  const [release, ideas, tags, pending, banned, mine] = await Promise.all([
    getLatestRelease(),
    // The open ideas themselves (by status, every page): the 100 most voted items of any status no
    // longer include them once the roadmap has more than 100 items.
    safely(async () => listByStatus("open", 10, session ? await userToken(session) : undefined)),
    safely(getTags),
    session && can(session, "review") ? safely(listPending) : null,
    session ? isBanned(session.id) : false,
    session && !session.admin ? pendingCount(session).catch(() => 0) : 0,
  ]);
  const viewer = viewerOf(session, { banned, moderation: storeReady });
  const board = ideas && (await forBoard([...ideas, ...(pending ?? [])], session?.id));
  if (board) await settleItem(lang, "/bugs-and-ideas", wanted, (id) => board.find((entry) => entry.id === id));
  // The item's page describes the item itself to search engines.
  const shared = wanted ? await sharedPage(wanted.id) : null;

  return (
    <>
      <JsonLd data={pageStructuredData(lang, "/bugs-and-ideas", shared)} />
      <Nav downloadUrl={release.downloadUrl} page="/bugs-and-ideas" />
      <main>
        <PageHead title={t.ideas.title} lead={t.ideas.lead} notice={ideas ? null : t.board.unavailable}>
          {ideas && <AccountBar authReady={authReady} next={localeHref(lang, "/bugs-and-ideas")} viewer={viewer} suggest={Boolean(board)} />}
        </PageHead>
        {board && (
          <IdeasBoard
            initial={board}
            openId={wanted?.id}
            categories={tags?.categories ?? []}
            types={tags?.types ?? []}
            viewer={viewer}
            authReady={authReady}
            pendingMine={mine}
          />
        )}
      </main>
      <Footer t={t} locale={lang} />
    </>
  );
}
