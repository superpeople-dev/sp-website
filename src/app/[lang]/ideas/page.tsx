import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { AccountBar } from "@/components/roadmap/AccountBar";
import { IdeasBoard } from "@/components/roadmap/IdeasBoard";
import { PageHead } from "@/components/roadmap/PageHead";
import { isLocale, localeHref } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLatestRelease } from "@/lib/github";
import { pendingCount } from "@/lib/authorship";
import { getTags, listIdeas, listPending, safely, userToken } from "@/lib/reflet";
import { pageMetadata } from "@/lib/seo";
import { followItem, itemParam, sharedItem, sharedPreview } from "@/lib/share";
import { authReady, currentSession, viewerOf } from "@/lib/session";
import { isBanned, storeReady } from "@/lib/store";

export async function generateMetadata({ params, searchParams }: PageProps<"/[lang]/ideas">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const shared = await sharedItem(itemParam((await searchParams).item));
  return pageMetadata(lang, "/ideas", sharedPreview(shared));
}

export default async function IdeasPage({ params, searchParams }: PageProps<"/[lang]/ideas">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const session = await currentSession();
  const [release, ideas, tags, pending, banned, mine] = await Promise.all([
    getLatestRelease(),
    safely(async () => listIdeas(session ? await userToken(session) : undefined)),
    safely(getTags),
    session?.admin ? safely(listPending) : null,
    session ? isBanned(session.id) : false,
    session && !session.admin ? pendingCount(session).catch(() => 0) : 0,
  ]);
  const viewer = viewerOf(session, { banned, moderation: storeReady });
  if (ideas) await followItem(lang, "/ideas", itemParam((await searchParams).item), (id) => [...ideas.items, ...(pending ?? [])].some((item) => item.id === id));

  return (
    <>
      <Nav downloadUrl={release.downloadUrl} page="/ideas" />
      <main>
        <PageHead title={t.ideas.title} lead={t.ideas.lead} notice={ideas ? null : t.board.unavailable}>
          {ideas && <AccountBar authReady={authReady} next={localeHref(lang, "/ideas")} viewer={viewer} />}
        </PageHead>
        {ideas && (
          <IdeasBoard
            initial={[...ideas.items.filter((item) => item.status === "open"), ...(pending ?? [])]}
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
