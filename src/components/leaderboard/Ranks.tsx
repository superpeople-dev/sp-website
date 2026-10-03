"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { fill, localeInfo } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { rankSteps, stepsOf, tierOf } from "@/lib/leaderboard";
import { Icon } from "../Icon";
import { Modal } from "../Modal";

// The leaderboard's "Ranks" button and dialog: every tier, highest first, with what it takes to reach it
// (lib/leaderboard.ts rankSteps, the backend's own thresholds) and the RP each step starts at.
export function Ranks() {
  const { locale, t } = useI18n();
  const l = t.leaderboard;
  const [open, setOpen] = useState(false);
  const number = useMemo(() => new Intl.NumberFormat(localeInfo[locale].intl), [locale]);

  const need = (r: (typeof rankSteps)[number]) =>
    r.top === 1
      ? l.rankFirst
      : r.top
        ? fill(l.rankTop, { n: String(r.top) })
        : r.to === undefined
          ? fill(l.rpFrom, { n: number.format(r.from ?? 0) })
          : fill(l.rpRange, { from: number.format(r.from ?? 0), to: number.format(r.to) });

  return (
    <>
      <button type="button" className="btn btn--sm leaders__ranks" onClick={() => setOpen(true)} title={l.ranksTitle}>
        <Icon name="info" />
        <span>{l.ranks}</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy="ranks-title" className="sheet--narrow">
        <div className="sheet__bar">
          <h2 id="ranks-title" className="sheet__heading">
            {l.ranksTitle}
          </h2>
          <div className="sheet__actions">
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label={t.board.close} title={t.board.close} data-autofocus>
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="sheet__body">
          <p className="ranks__note">{l.ranksNote}</p>
          <ol className="ranks">
            {rankSteps.map((r) => {
              const tier = tierOf(r.id);
              return (
                <li key={r.id} className={`ranks__row tier--${r.group}`}>
                  {tier && <Image src={tier.icon} alt="" width={48} height={48} unoptimized />}
                  <div className="ranks__what">
                    <b className={`tier tier--${r.group}`}>{l.tiers[r.group]}</b>
                    <span>{need(r)}</span>
                    {r.to !== undefined && (
                      <span className="ranks__steps">
                        {stepsOf(r.from ?? 0).map(({ step, from }) => (
                          <span key={step}>
                            <i>{step}</i> {number.format(from)}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </Modal>
    </>
  );
}
