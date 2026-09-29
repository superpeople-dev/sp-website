import { notFound } from "next/navigation";
import { Band } from "@/components/Band";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";
import { Gallery } from "@/components/Gallery";
import { Help } from "@/components/Help";
import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { Progress } from "@/components/Progress";
import { Steps } from "@/components/Steps";
import { Story } from "@/components/Story";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLatestRelease } from "@/lib/github";
import { fallbackProgress, getProgress } from "@/lib/progress";
import { structuredData } from "@/lib/seo";

export const revalidate = 300;

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  const [release, progress] = await Promise.all([getLatestRelease(), getProgress()]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(release, lang)).replace(/</g, "\\u003c") }}
      />
      <Nav downloadUrl={release.downloadUrl} />
      <Hero release={release} />
      <main>
        <Story />
        <Steps downloadUrl={release.downloadUrl} />
        <Progress lists={progress ?? fallbackProgress(t.progress)} />
        <Gallery />
        <Help />
        <Faq />
        <Band downloadUrl={release.downloadUrl} />
      </main>
      <Footer t={t} locale={lang} />
    </>
  );
}
