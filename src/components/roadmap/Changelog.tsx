import type { ChangelogEntry } from "reflet-sdk";
import { localeInfo, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { Reveal } from "../motion";

export function Changelog({ entries, t, locale }: { entries: ChangelogEntry[]; t: Dictionary["completed"]; locale: Locale }) {
  const format = new Intl.DateTimeFormat(localeInfo[locale].intl, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <section id="changelog" className="tint">
      <div className="wrap">
        <Reveal>
          <h2>{t.changelogTitle}</h2>
        </Reveal>
        {entries.length ? (
          <div className="changes">
            {entries.map((entry) => (
              <Reveal key={entry.id} className="change" y={16}>
                <div className="change__meta">
                  {entry.version && <b>{entry.version}</b>}
                  {entry.publishedAt && (
                    <time dateTime={new Date(entry.publishedAt).toISOString()}>{format.format(entry.publishedAt)}</time>
                  )}
                </div>
                <div className="change__body">
                  <h3>{entry.title}</h3>
                  {entry.description && <p>{entry.description}</p>}
                  {entry.feedback.length > 0 && (
                    <p className="change__related">
                      {t.related}: {entry.feedback.map((f) => f.title).join(" - ")}
                    </p>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        ) : (
          <p className="lead">{t.changelogEmpty}</p>
        )}
      </div>
    </section>
  );
}
