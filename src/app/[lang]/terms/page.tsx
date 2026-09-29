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

export async function generateMetadata({ params }: PageProps<"/[lang]/terms">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return pageMetadata(lang, "/terms");
}

export default async function TermsPage({ params }: PageProps<"/[lang]/terms">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const release = await getLatestRelease();

  return (
    <>
      <JsonLd data={pageStructuredData(lang, "/terms")} />
      <Nav downloadUrl={release.downloadUrl} page="/terms" />
      <main>
        <LegalPage title={t.legal.terms} updated={t.legal.updated} doc={t.legal.termsDoc} locale={lang} />
      </main>
      <Footer t={t} locale={lang} />
    </>
  );
}
