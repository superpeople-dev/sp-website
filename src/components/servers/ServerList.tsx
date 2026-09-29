"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { fill, localeInfo } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import type { Continent, GameServer, ServerList as List } from "@/lib/servers";
import { Icon } from "../Icon";
import { Reveal } from "../motion";

const POLL_MS = 30_000;

// A clock that ticks every 10 s, so "updated … ago" stays true without re-rendering every second.
// The server snapshot is null: the relative time only appears once the page runs in the browser.
const subscribeClock = (tick: () => void) => {
  const timer = setInterval(tick, 10_000);
  return () => clearInterval(timer);
};
const clockNow = () => Math.floor(Date.now() / 10_000) * 10;

export function ServerList({ initial }: { initial: List }) {
  const { locale, t } = useI18n();
  const s = t.servers;
  const [list, setList] = useState(initial);
  const [continent, setContinent] = useState<Continent | "all">("all");
  const now = useSyncExternalStore(subscribeClock, clockNow, () => null);
  const intl = localeInfo[locale].intl;
  const regions = useMemo(() => new Intl.DisplayNames([intl], { type: "region" }), [intl]);
  const since = useMemo(() => new Intl.RelativeTimeFormat(intl, { numeric: "auto" }), [intl]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/servers", { cache: "no-store" });
        if (res.ok && live) setList((await res.json()) as List);
      } catch {
        // Keep showing the last list; the next poll tries again.
      }
    };
    const timer = setInterval(() => void load(), POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const nameOf = (code: string) => {
    try {
      return regions.of(code) ?? code;
    } catch {
      return code;
    }
  };

  const continents = useMemo(
    () => [...new Set(list.servers.map((srv) => srv.continent).filter((c): c is Continent => c !== null))],
    [list.servers],
  );
  const active = continent !== "all" && continents.includes(continent) ? continent : "all";
  const shown = active === "all" ? list.servers : list.servers.filter((srv) => srv.continent === active);
  const online = list.servers.filter((srv) => srv.online).length;

  const updated = () => {
    if (now === null) return null;
    const ago = Math.max(0, now - list.updated);
    return fill(s.updated, { time: ago < 60 ? since.format(-ago, "second") : since.format(-Math.round(ago / 60), "minute") });
  };

  const place = (srv: GameServer) =>
    srv.country ? [nameOf(srv.country), srv.continent && s.continents[srv.continent]].filter(Boolean).join(" · ") : s.unknownLocation;

  const details = (srv: GameServer) =>
    [
      srv.match && s.match[srv.match],
      srv.players !== null && (srv.players === 1 ? s.onePlayer : fill(s.players, { count: String(srv.players) })),
    ].filter(Boolean);

  return (
    <section className="flush">
      <div className="wrap servers">
        <Reveal className="servers__bar" y={16}>
          <p className="servers__summary">
            <span className={`servers__pulse${online ? " is-on" : ""}`} aria-hidden="true" />
            {online > 0 && online === list.servers.length
              ? s.allOnline
              : fill(s.summary, { online: String(online), total: String(list.servers.length) })}
            <span className="servers__updated">{updated()}</span>
          </p>
          {continents.length > 1 && (
            <div className="servers__filters" role="group" aria-label={s.title}>
              {(["all", ...continents] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={active === key ? "is-active" : undefined}
                  aria-pressed={active === key}
                  onClick={() => setContinent(key)}
                >
                  {key === "all" ? s.filterAll : s.continents[key]}
                </button>
              ))}
            </div>
          )}
        </Reveal>

        <Reveal delay={0.08} y={16}>
          {shown.length ? (
            <ul className="server-list">
              {shown.map((srv, i) => (
                <li key={`${srv.name}-${i}`} className={`server${srv.online ? " is-online" : ""}`}>
                  <div className="server__top">
                    <h3 className="server__name">
                      <span className="server__dot" aria-hidden="true" />
                      {srv.name}
                    </h3>
                    <span className="server__status">{srv.online ? s.online : s.offline}</span>
                  </div>
                  <p className="server__where">
                    <Icon name="globe" />
                    {place(srv)}
                  </p>
                  <div className="server__tags">
                    <span className="server__tag">{s.modes[srv.mode]}</span>
                    <span className="server__tag">{s.views[srv.view]}</span>
                  </div>
                  {details(srv).length > 0 && <p className="server__live">{details(srv).join(" · ")}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="servers__empty">{s.empty}</p>
          )}
        </Reveal>
      </div>
    </section>
  );
}
