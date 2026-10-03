"use client";

import Image from "next/image";
import { useMemo, useState, type CSSProperties } from "react";
import { fill, localeInfo } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import {
  leaderModes,
  leaderViews,
  paramOfKey,
  tierOf,
  type LeaderKey,
  type LeaderRow,
  type Leaderboard as Board,
  type LeaderMode,
  type LeaderView,
} from "@/lib/leaderboard";
import { Icon } from "../Icon";
import { Reveal } from "../motion";
import { ModeIcon, ViewIcon } from "./ModeIcons";
import { PlayerCard } from "./PlayerCard";
import { Ranks } from "./Ranks";

// Names match with or without accents and capitals ("lea" finds "Léa").
const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// The season leaderboard (app/[lang]/leaderboard): a mode and a view picked above the list, kept in the
// link (?mode=squad-fpp) without reloading the page, and a search by name that stays when the list
// changes (where does a player stand in each mode?). Players found keep their rank. The top three stand
// on a podium (2 - 1 - 3), the rest are a list. Desktop: one bar, the search on the right, the list in
// four columns. Phone: the modes on a row of their own, the view and the search under them, the tier
// under the name. A click on a player opens their card (PlayerCard) with that mode's season record.
export function Leaderboard({ board, initialKey, initialPlayer }: { board: Board; initialKey: LeaderKey; initialPlayer: string | null }) {
  const { locale, t } = useI18n();
  const l = t.leaderboard;
  const [key, setKey] = useState(initialKey);
  const [query, setQuery] = useState("");
  // A shared card (?player=<name>) opens over its list.
  const [shown, setShown] = useState<LeaderRow | null>(() => board.lists[initialKey].find((row) => row.name === initialPlayer) ?? null);
  const [mode, view] = key.split("_") as [LeaderMode, LeaderView];
  const list = board.lists[key];
  const wanted = plain(query.trim());
  // The first three stand on a podium; the list under it goes on from rank 4. A search lists every
  // player found, the top three included, without the podium.
  const podium = wanted ? [] : list.slice(0, 3);
  const rows = wanted ? list.filter((row) => plain(row.name).includes(wanted)) : list.slice(3);
  const topRp = list[0]?.rp ?? 0;
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

  const flagOf = (country: string | null) =>
    country && (
      <Image
        className="leaders__flag"
        src={`/flags/${country.toLowerCase()}.svg`}
        alt={nameOf(country)}
        title={nameOf(country)}
        width={21}
        height={14}
        unoptimized
      />
    );

  const badgeOf = (id: number, withIcon: boolean) => {
    const tier = tierOf(id);
    return (
      tier && (
        <span className={`tier tier--${tier.group}`}>
          {withIcon && <Image className="tier__icon" src={tier.icon} alt="" width={24} height={24} unoptimized />}
          {l.tiers[tier.group]}
          {tier.step && ` ${tier.step}`}
        </span>
      )
    );
  };

  // The list and the open card are kept in the link, so it can be shared (?mode=squad-fpp&player=Nova).
  const setLink = (param: string, value: string | null) => {
    const url = new URL(window.location.href);
    if (value === null) url.searchParams.delete(param);
    else url.searchParams.set(param, value);
    window.history.replaceState(window.history.state, "", url);
  };
  const pick = (next: LeaderKey) => {
    setKey(next);
    setLink("mode", paramOfKey(next));
  };
  const show = (row: LeaderRow | null) => {
    setShown(row);
    if (row) setLink("mode", paramOfKey(key));
    setLink("player", row ? row.name : null);
  };

  return (
    <section className="flush">
      <div className="wrap leaders">
        <Reveal className="leaders__bar" y={16}>
          <div className="ideas__sort leaders__modes" role="group" aria-label={l.mode}>
            {leaderModes.map((m) => (
              <button key={m} type="button" className={m === mode ? "is-active" : undefined} aria-pressed={m === mode} onClick={() => pick(`${m}_${view}`)}>
                <ModeIcon mode={m} />
                {t.servers.modes[m]}
              </button>
            ))}
          </div>
          <div className="ideas__sort leaders__views" role="group" aria-label={l.view}>
            {leaderViews.map((v) => (
              <button key={v} type="button" className={v === view ? "is-active" : undefined} aria-pressed={v === view} onClick={() => pick(`${mode}_${v}`)}>
                <ViewIcon view={v} />
                {t.servers.views[v]}
              </button>
            ))}
          </div>
          <Ranks />
          {/* The ideas board's sort switches and search box, as on Bugs & Ideas. */}
          <label className="ideas__search">
            <Icon name="search" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={l.search} aria-label={l.search} />
          </label>
        </Reveal>

        <Reveal delay={0.08} y={16}>
          {podium.length > 0 && (
            <ol className="podium" aria-label={`${l.title}: ${t.servers.modes[mode]} ${t.servers.views[view]}`}>
              {podium.map((row) => {
                const tier = tierOf(row.tier);
                return (
                  <li key={row.rank} className={`podium__place podium__place--${row.rank}`}>
                    <button type="button" className="podium__player" onClick={() => show(row)} aria-label={fill(l.card.open, { name: row.name })}>
                      {tier && <Image className="podium__icon" src={tier.icon} alt="" width={64} height={64} unoptimized />}
                      <span className="leaders__name podium__name">
                        {flagOf(row.country)}
                        <bdi>{row.name}</bdi>
                      </span>
                      {badgeOf(row.tier, false)}
                      <span className="podium__rp">
                        {number.format(row.rp)} <abbr title={l.pointsTitle}>{l.points}</abbr>
                      </span>
                    </button>
                    <div className="podium__step">{row.rank}</div>
                  </li>
                );
              })}
            </ol>
          )}
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
                {rows.map((row) => (
                  <tr key={row.rank} className={row.rank <= 3 ? `is-top is-top-${row.rank}` : undefined} onClick={() => show(row)}>
                    <td className="leaders__rank">{row.rank}</td>
                    <td className="leaders__player">
                      {/* The row opens the card on a click; the name is the button for the keyboard. */}
                      <button type="button" className="leaders__name" onClick={(e) => (e.stopPropagation(), show(row))}>
                        {flagOf(row.country)}
                        <bdi>{row.name}</bdi>
                      </button>
                      <span className="leaders__tier-under">{badgeOf(row.tier, true)}</span>
                    </td>
                    <td className="leaders__tier">{badgeOf(row.tier, true)}</td>
                    <td className="leaders__rp">
                      {number.format(row.rp)}
                      {/* The share of the leader's RP: how far behind the top a player is, at a glance. */}
                      <span className="leaders__share" style={{ "--share": topRp ? row.rp / topRp : 0 } as CSSProperties} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            podium.length === 0 && <p className="servers__empty">{list.length ? fill(l.noMatch, { name: query.trim() }) : l.empty}</p>
          )}
        </Reveal>
      </div>
      <PlayerCard row={shown} modeLabel={`${t.servers.modes[mode]} ${t.servers.views[view]}`} flag={shown && flagOf(shown.country)} onClose={() => show(null)} />
    </section>
  );
}
