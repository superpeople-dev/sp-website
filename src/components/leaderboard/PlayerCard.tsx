"use client";

import Image from "next/image";
import { useMemo, type ReactNode } from "react";
import { fill, localeInfo } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { avatarUrl, tierOf, type LeaderRow } from "@/lib/leaderboard";
import { Icon } from "../Icon";
import { Modal } from "../Modal";
import { RelativeTime } from "../RelativeTime";

// A leaderboard player's card (components/leaderboard/Leaderboard.tsx): picture, name, tier and RP in the
// list's mode and view, that mode's season record and the newest matches. The record counts the matches
// the hosts reported (sp-backend routes/ds.js recordMatchStats); kills are kills of players.
export function PlayerCard({ row, modeLabel, flag, onClose }: { row: LeaderRow | null; modeLabel: string; flag: ReactNode; onClose: () => void }) {
  const { locale, t } = useI18n();
  const l = t.leaderboard;
  const c = l.card;
  const intl = localeInfo[locale].intl;
  const number = useMemo(() => new Intl.NumberFormat(intl), [intl]);
  const decimal = useMemo(() => new Intl.NumberFormat(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), [intl]);
  const percent = useMemo(() => new Intl.NumberFormat(intl, { style: "percent", maximumFractionDigits: 0 }), [intl]);
  const tier = row && tierOf(row.tier);
  const s = row?.stats;

  const facts: [string, string, string?][] = s
    ? [
        [c.matches, number.format(s.matches)],
        [c.wins, number.format(s.wins), percent.format(s.wins / s.matches)],
        [c.top10, number.format(s.top10), percent.format(s.top10 / s.matches)],
        [c.kills, number.format(s.kills)],
        [c.killsPerMatch, decimal.format(s.kills / s.matches)],
        [c.kd, decimal.format(s.kills / Math.max(1, s.deaths))],
        [c.avgPlace, `#${decimal.format(s.rankSum / s.matches)}`],
        [c.avgDamage, number.format(Math.round(s.damage / s.matches))],
        [c.assists, number.format(s.assists)],
        [c.revives, number.format(s.revives)],
        [c.aiKills, number.format(s.aiKills)],
        [c.playTime, fill(c.hours, { n: decimal.format(s.seconds / 3600) })],
      ]
    : [];

  return (
    <Modal open={row !== null} onClose={onClose} labelledBy="player-card-title" className="sheet--narrow player-card">
      {row && (
        <>
          <div className="sheet__bar">
            <span className="player-card__mode">
              #{row.rank} · {modeLabel}
            </span>
            <div className="sheet__actions">
              <button type="button" className="icon-btn" onClick={onClose} aria-label={t.board.close} title={t.board.close} data-autofocus>
                <Icon name="close" />
              </button>
            </div>
          </div>
          <div className="sheet__body">
            <div className="player-card__head">
              <span className="player-card__avatar">
                {row.avatar ? <Image src={avatarUrl(row.avatar)} alt="" width={72} height={72} unoptimized /> : <span aria-hidden="true">{[...row.name][0]}</span>}
              </span>
              <div className="player-card__who">
                <div id="player-card-title" className="player-card__name">
                  {flag}
                  <bdi>{row.name}</bdi>
                </div>
                <div className="player-card__tier">
                  {tier && (
                    <>
                      <Image src={tier.icon} alt="" width={36} height={36} unoptimized />
                      <span>
                        {l.tiers[tier.group]}
                        {tier.step && ` ${tier.step}`}
                      </span>
                    </>
                  )}
                  <b>
                    {number.format(row.rp)} <abbr title={l.pointsTitle}>{l.points}</abbr>
                  </b>
                </div>
              </div>
            </div>

            {s ? (
              <>
                <h3 className="player-card__label">{t.hero.season}</h3>
                <dl className="player-card__stats">
                  {facts.map(([label, value, extra]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>
                        {value}
                        {extra && <small>{extra}</small>}
                      </dd>
                    </div>
                  ))}
                </dl>
                {s.recent.length > 0 && (
                  <>
                    <h3 className="player-card__label">{c.recent}</h3>
                    <ol className="player-card__recent">
                      {s.recent.map((m, i) => {
                        const gain = m.rp - m.prev;
                        return (
                          <li key={i} className={m.rank === 1 ? "is-win" : undefined}>
                            <b>{fill(c.place, { rank: String(m.rank), of: String(m.of) })}</b>
                            <span className={gain >= 0 ? "is-up" : "is-down"}>
                              {gain >= 0 ? "+" : "−"}
                              {number.format(Math.abs(gain))} {l.points}
                            </span>
                            {m.at > 0 && <RelativeTime iso={new Date(m.at * 1000).toISOString()} locale={locale} />}
                          </li>
                        );
                      })}
                    </ol>
                  </>
                )}
              </>
            ) : (
              <p className="player-card__empty">{c.noStats}</p>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
