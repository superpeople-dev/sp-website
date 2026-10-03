import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Editor } from "@/components/news/Editor";
import { isLocale } from "@/i18n/config";
import { can } from "@/lib/board";
import { getLatestRelease } from "@/lib/github";
import { currentSession } from "@/lib/session";

// The news editor, for admins with "manage" only (everyone else gets the 404 page).
export const metadata: Metadata = { title: "Write a post", robots: { index: false, follow: false } };

export default async function NewsWritePage({ params, searchParams }: PageProps<"/[lang]/news/write">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const session = await currentSession();
  if (!can(session, "manage")) notFound();
  const id = (await searchParams).id;
  const release = await getLatestRelease();
  return (
    <>
      <Nav downloadUrl={release.downloadUrl} page="/news" />
      <main className="news-write-page">
        <Editor initialId={typeof id === "string" ? id : null} />
      </main>
    </>
  );
}
