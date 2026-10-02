"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { fill, localeInfo } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import {
  leaderModes,
  leaderViews,
  paramOfKey,
  tierOf,
  type LeaderKey,
  type Leaderboard as Board,
  type LeaderMode,
  type LeaderView,
} from "@/lib/leaderboard";
import { Icon } from "../Icon";
import { Reveal } from "../motion";

// Names match with or without accents and capitals ("lea" finds "Léa").
const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// The season leaderboard (app/[lang]/leaderboard): a mode and a view picked above the list, kept in the
// link (?mode=squad-fpp) without reloading the page, and a search by name that stays when the list
// changes (where does a player stand in each mode?). Players found keep their rank. Desktop: one bar,
// the search on the right, the list in four columns. Phone: the modes on a row of their own, the view
// and the search under them, the tier under the name.
export function Leaderboard({ board, initialKey }: { board: Board; initialKey: LeaderKey }) {
  const { locale, t } = useI18n();
  const l = t.leaderboard;
  const [key, setKey] = useState(initialKey);
  const [query, setQuery] = useState("");
  const [mode, view] = key.split("_") as [LeaderMode, LeaderView];
  const list = board.lists[key];
  const wanted = plain(query.trim());
  const rows = wanted ? list.filter((row) => plain(row.name).includes(wanted)) : list;
  const intl = localeInfo[locale].intl;
  const number = useMemo(() => new Intl.NumberFormat(intl), [intl]);
  const regions = useMemo(() => new Intl.DisplayNames([intl], { type: "region" }), [intl]);

  const nameOf = (code: string) => {
    try {
      return regions.of(code) ?? code;
    } catch {
      return code;
    }
  };

  const pick = (next: LeaderKey) => {
    setKey(next);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", paramOfKey(next));
    window.history.replaceState(window.history.state, "", url);
  };

  return (
    <section className="flush">
      <div className="wrap leaders">
        <Reveal className="leaders__bar" y={16}>
          <div className="ideas__sort leaders__modes" role="group" aria-label={l.mode}>
            {leaderModes.map((m) => (
              <button key={m} type="button" className={m === mode ? "is-active" : undefined} aria-pressed={m === mode} onClick={() => pick(`${m}_${view}`)}>
                {t.servers.modes[m]}
              </button>
            ))}
          </div>
          <div className="ideas__sort leaders__views" role="group" aria-label={l.view}>
            {leaderViews.map((v) => (
              <button key={v} type="button" className={v === view ? "is-active" : undefined} aria-pressed={v === view} onClick={() => pick(`${mode}_${v}`)}>
                {t.servers.views[v]}
              </button>
            ))}
          </div>
          {/* The ideas board's sort switches and search box, as on Bugs & Ideas. */}
          <label className="ideas__search">
            <Icon name="search" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={l.search} aria-label={l.search} />
          </label>
        </Reveal>

        <Reveal delay={0.08} y={16}>
          {rows.length ? (
            <table className="leaders__table">
              <caption className="leaders__caption">{`${l.title}: ${t.servers.modes[mode]} ${t.servers.views[view]}`}</caption>
              <thead>
                <tr>
                  <th scope="col" className="leaders__rank">
                    {l.rank}
                  </th>
                  <th scope="col">{l.player}</th>
                  <th scope="col" className="leaders__tier">
                    {l.tier}
                  </th>
                  <th scope="col" className="leaders__rp">
                    <abbr title={l.pointsTitle}>{l.points}</abbr>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const tier = tierOf(row.tier);
                  const badge = tier && (
                    <span className={`tier tier--${tier.group}`}>
                      {l.tiers[tier.group]}
                      {tier.step && ` ${tier.step}`}
                    </span>
                  );
                  return (
                    <tr key={row.rank} className={row.rank <= 3 ? `is-top is-top-${row.rank}` : undefined}>
                      <td className="leaders__rank">{row.rank}</td>
                      <td className="leaders__player">
                        <span className="leaders__name">
                          {row.country && (
                            <Image
                              className="leaders__flag"
                              src={`/flags/${row.country.toLowerCase()}.svg`}
                              alt={nameOf(row.country)}
                              title={nameOf(row.country)}
                              width={21}
                              height={14}
                              unoptimized
                            />
                          )}
                          <bdi>{row.name}</bdi>
                        </span>
                        {badge && <span className="leaders__tier-under">{badge}</span>}
                      </td>
                      <td className="leaders__tier">{badge}</td>
                      <td className="leaders__rp">{number.format(row.rp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="servers__empty">{list.length ? fill(l.noMatch, { name: query.trim() }) : l.empty}</p>
          )}
        </Reveal>
      </div>
    </section>
  );
}
