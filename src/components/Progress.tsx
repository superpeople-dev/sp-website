"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { localeHref, type PagePath } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { guns } from "@/lib/art";
import type { ProgressLists, ProgressRow } from "@/lib/progress";
import { nextPlaytestProgress } from "@/lib/site";
import { Icon } from "./Icon";
import { Reveal, ease, inView, rise, stagger } from "./motion";

const drawCheck = {
  hidden: { pathLength: 0 },
  show: { pathLength: 1, transition: { duration: 0.5, ease, delay: 0.25 } },
};

export function Progress({ lists }: { lists: ProgressLists }) {
  const { locale, t } = useI18n();
  const p = t.progress;
  const label = { done: p.done, wip: p.inProgress, next: p.upNext };

  const rows = (items: ProgressRow[], delay: number) => (
    <motion.ul className="rows" {...inView} variants={stagger(0.07, delay)}>
      {items.map((item) => (
        <motion.li key={item.id} variants={rise}>
          {item.status === "done" ? (
            <svg className="rows__check" viewBox="0 0 24 24" aria-hidden="true">
              <motion.path d="M5 12.5l4.5 4.5L19 7.5" variants={drawCheck} />
            </svg>
          ) : (
            <i className={`rows__dot rows__dot--${item.status}`} aria-hidden="true" />
          )}
          <span className="rows__title" title={item.title}>
            {item.title}
          </span>
          <span className={`st st--${item.status}`}>{label[item.status]}</span>
        </motion.li>
      ))}
    </motion.ul>
  );

  const more = (page: PagePath, text: string) => (
    <Link className="progress__link" href={localeHref(locale, page)}>
      {text}
      <Icon name="right" />
    </Link>
  );

  return (
    <section id="progress">
      <Image className="gun gun--progress" src={guns.red} quality={90} alt="" aria-hidden="true" />
      <div className="wrap">
        <Reveal>
          <h2>{p.title}</h2>
          <p className="lead">{p.lead}</p>
        </Reveal>

        <Reveal className="panel playtest" delay={0.05}>
          <div className="pct">
            <b>{p.nextPlaytest}</b>
            <span>{p.inProgress}</span>
          </div>
          <div className="bar">
            <motion.i
              initial={{ width: 0 }}
              whileInView={{ width: `${nextPlaytestProgress}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.6, ease, delay: 0.35 }}
            />
          </div>
        </Reveal>

        {/* Both panels have the same number of rows (lib/progress.ts), so they come out the same size. */}
        <div className="progress-grid">
          <Reveal className="panel progress__panel">
            <p className="panel__title">
              {p.recentTitle} <span className="panel__count">{lists.doneTotal}</span>
            </p>
            {rows(lists.done, 0.15)}
            {more("/completed", p.viewCompleted)}
          </Reveal>

          <Reveal className="panel progress__panel" delay={0.12}>
            <p className="panel__title">
              {p.workingTitle} <span className="panel__count">{lists.wipTotal}</span>
            </p>
            {rows(lists.working, 0.3)}
            {more("/roadmap", p.roadmapCta)}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
