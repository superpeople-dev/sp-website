import type { ReactNode } from "react";
import { fill, localeInfo, type Locale } from "@/i18n/config";
import type { LegalDoc } from "@/i18n/types";
import { contactEmail, legalUpdated } from "@/lib/site";
import { PageHead } from "./roadmap/PageHead";

function withEmail(text: string) {
  const [before, ...rest] = text.split(contactEmail);
  if (!rest.length) return text;
  return (
    <>
      {before}
      <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
      {rest.join(contactEmail)}
    </>
  );
}

// children: shown under the introduction (the privacy policy's data choice).
export function LegalPage({
  title,
  updated,
  doc,
  locale,
  children,
}: {
  title: string;
  updated: string;
  doc: LegalDoc;
  locale: Locale;
  children?: ReactNode;
}) {
  const date = new Intl.DateTimeFormat(localeInfo[locale].intl, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${legalUpdated}T00:00:00Z`));

  return (
    <>
      <PageHead title={title}>
        <p className="page-head__date">
          <time dateTime={legalUpdated}>{fill(updated, { date })}</time>
        </p>
      </PageHead>
      <section className="flush">
        <div className="wrap legal">
          <p className="legal__intro">{doc.intro}</p>
          {children}
          {doc.sections.map((section) => (
            <div key={section.title} className="legal__section">
              <h2>{section.title}</h2>
              <p>{withEmail(section.body)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
