import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { LegalPage } from "@/components/LegalPage";
import { Nav } from "@/components/Nav";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLatestRelease } from "@/lib/github";
import { pageMetadata, pageStructuredData } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return pageMetadata(lang, "/privacy");
}

export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const release = await getLatestRelease();

  return (
    <>
      <JsonLd data={pageStructuredData(lang, "/privacy")} />
      <Nav downloadUrl={release.downloadUrl} page="/privacy" />
      <main>
        <LegalPage title={t.legal.privacy} updated={t.legal.updated} doc={t.legal.privacyDoc} locale={lang} />
      </main>
      <Footer t={t} locale={lang} />
    </>
  );
}
