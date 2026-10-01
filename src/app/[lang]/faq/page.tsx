import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FaqHash } from "@/components/FaqHash";
import { FaqList } from "@/components/FaqList";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { Nav } from "@/components/Nav";
import { PageHead } from "@/components/roadmap/PageHead";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLatestRelease } from "@/lib/github";
import { pageMetadata, pageStructuredData } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/faq">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return pageMetadata(lang, "/faq");
}

// Every question on one page (the home page shows the same ones): linked from the footer, marked up
// as the site's FAQPage (lib/seo.ts).
export default async function FaqPage({ params }: PageProps<"/[lang]/faq">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const release = await getLatestRelease();

  return (
    <>
      <JsonLd data={pageStructuredData(lang, "/faq")} />
      <Nav downloadUrl={release.downloadUrl} page="/faq" />
      <main>
        <PageHead title={t.faq.title} lead={t.faq.lead} />
        <section className="flush">
          <div className="wrap">
            <FaqList items={t.faq.items} />
          </div>
        </section>
        <FaqHash />
      </main>
      <Footer t={t} locale={lang} />
    </>
  );
}
