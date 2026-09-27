"use client";

import { motion } from "motion/react";
import { useI18n } from "@/i18n/context";
import { monthYear } from "@/lib/format";
import { rich } from "@/lib/rich";
import { history, originalPriceUsd } from "@/lib/site";
import { Counter } from "./Counter";
import { Reveal, inView, rise, stagger } from "./motion";

const priceEase: [number, number, number, number] = [0.45, 0, 0.95, 0.55];

export function Story() {
  const { locale, t } = useI18n();

  return (
    <section id="why">
      <div className="wrap story">
        <Reveal>
          <h2>{t.story.title}</h2>
          {t.story.paragraphs.map((p, i) => (
            <p key={i}>{rich(p)}</p>
          ))}
        </Reveal>

        <div className="story__side">
          <Reveal className="panel" delay={0.15}>
            <p className="panel__title">{t.story.timelineTitle}</p>
            <motion.ol className="timeline" {...inView} variants={stagger(0.14, 0.2)}>
              {history.map((entry, i) => (
                <motion.li key={entry.date} className={entry.tone} variants={rise}>
                  <time dateTime={entry.date}>{monthYear(entry.date, locale)}</time>
                  <span>{t.story.history[i]}</span>
                </motion.li>
              ))}
            </motion.ol>
          </Reveal>
          <Reveal delay={0.25}>
            <div className="stats">
              <div className="stat">
                <b>
                  <Counter value={47392} />
                </b>
                <span className="stat__label">{t.story.peak}</span>
              </div>
              <div className="stat">
                <b>
                  <Counter value={2} duration={1.2} suffix="×" />
                </b>
                <span className="stat__label">{t.story.shutdowns}</span>
              </div>
              <div className="stat">
                <b>
                  <Counter from={originalPriceUsd} value={0} prefix="$" decimals={2} duration={2.4} ease={priceEase} end={t.story.free} />
                </b>
                <span className="stat__label">{t.story.cost}</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
