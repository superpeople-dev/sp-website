"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { fill, localeHref } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { monthYear } from "@/lib/format";
import { nextPlaytestProgress, openStatuses, progressMonth } from "@/lib/site";
import { Icon } from "./Icon";
import { Reveal, ease, inView, rise, stagger } from "./motion";

const drawCheck = {
  hidden: { pathLength: 0 },
  show: { pathLength: 1, transition: { duration: 0.5, ease, delay: 0.25 } },
};

export function Progress() {
  const { locale, t } = useI18n();
  const p = t.progress;

  return (
    <section id="progress">
      <div className="wrap">
        <Reveal>
          <h2>{p.title}</h2>
          <p className="lead">{p.lead}</p>
        </Reveal>

        <div className="progress-grid">
          <Reveal className="panel">
            <p className="panel__title">
              {fill(p.doneTitle, { month: monthYear(progressMonth, locale, "long") })}{" "}
              <span className="panel__count">{p.doneItems.length}</span>
            </p>
            <motion.ul className="rows" {...inView} variants={stagger(0.07, 0.15)}>
              {p.doneItems.map((title) => (
                <motion.li key={title} variants={rise}>
                  <svg className="rows__check" viewBox="0 0 24 24" aria-hidden="true">
                    <motion.path d="M5 12.5l4.5 4.5L19 7.5" variants={drawCheck} />
                  </svg>
                  <span>{title}</span>
                  <span className="st st--done">{p.done}</span>
                </motion.li>
              ))}
            </motion.ul>
          </Reveal>

          <Reveal className="panel" delay={0.12}>
            <p className="panel__title">{p.workingTitle}</p>
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
            <motion.ul className="rows" {...inView} variants={stagger(0.08, 0.3)}>
              {p.openItems.map((task, i) => {
                const status = openStatuses[i] ?? "next";
                return (
                  <motion.li key={task.title} variants={rise}>
                    <i className={`rows__dot rows__dot--${status}`} aria-hidden="true" />
                    <span>
                      {task.title}
                      {task.note && <small>{task.note}</small>}
                    </span>
                    <span className={`st st--${status}`}>{status === "wip" ? p.inProgress : p.upNext}</span>
                  </motion.li>
                );
              })}
            </motion.ul>
          </Reveal>
        </div>

        <Reveal className="progress__more" delay={0.1} y={12}>
          <Link className="btn" href={localeHref(locale, "/roadmap")}>
            {p.roadmapCta}
            <Icon name="right" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
