"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { fill, localeInfo } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { historyRanges, type GameServer, type HistoryPoint, type HistoryRange, type ServerHistory as History } from "@/lib/servers";
import { Dropdown } from "../Dropdown";
import { Icon } from "../Icon";
import { HistoryChart } from "./HistoryChart";

// The backend adds a point every 5 minutes: a period shown is fetched again at that pace.
const REFRESH_MS = 5 * 60_000;

export const historyId = "server-history";

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

// Under the server list: one server's players and ping over 24 hours, 7 or 30 days, with its peak,
// average, uptime and average ping. The server is picked here or with a card's chart button.
export function ServerHistory({
  initial,
  servers,
  selected,
  onSelect,
}: {
  initial: History;
  servers: GameServer[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  const { locale, t } = useI18n();
  const s = t.servers;
  const intl = localeInfo[locale].intl;
  const headingId = useId();
  const [range, setRange] = useState<HistoryRange>("24h");
  const [histories, setHistories] = useState<Partial<Record<HistoryRange, History>>>({ "24h": initial });
  const [failed, setFailed] = useState<Partial<Record<HistoryRange, boolean>>>({});
  const loadedAt = useRef<Partial<Record<HistoryRange, number>>>({});

  useEffect(() => {
    loadedAt.current["24h"] ??= Date.now();
  }, []);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const at = loadedAt.current[range];
      if (document.hidden || (at && Date.now() - at < REFRESH_MS)) return;
      try {
        const res = await fetch(`/api/servers/history?range=${range}`);
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as History;
        if (!live) return;
        loadedAt.current[range] = Date.now();
        setHistories((old) => ({ ...old, [range]: next }));
        setFailed((old) => ({ ...old, [range]: false }));
      } catch {
        // Keep what is shown; the next minute tries again.
        if (live) setFailed((old) => ({ ...old, [range]: true }));
      }
    };
    void load();
    const timer = setInterval(() => void load(), 60_000);
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [range]);

  // While a period loads for the first time, the 24 hours stay on screen, dimmed.
  const view = histories[range] ?? histories["24h"] ?? initial;
  const loading = !histories[range];

  // The servers in the list's order (online first), then any only the history knows.
  const names = useMemo(() => {
    const known = new Set(view.servers.map((srv) => srv.name));
    const listed = servers.map((srv) => srv.name).filter((name) => known.has(name));
    return [...new Set([...listed, ...view.servers.map((srv) => srv.name)])];
  }, [servers, view.servers]);
  const fallback = names.find((name) => view.servers.find((srv) => srv.name === name)?.points.length) ?? names[0] ?? null;
  const current = selected && names.includes(selected) ? selected : fallback;
  const points = useMemo(() => view.servers.find((srv) => srv.name === current)?.points ?? [], [view.servers, current]);
  const live = servers.find((srv) => srv.name === current);

  const number = useMemo(() => new Intl.NumberFormat(intl, { maximumFractionDigits: 1 }), [intl]);
  const percent = useMemo(() => new Intl.NumberFormat(intl, { style: "percent", maximumFractionDigits: 1 }), [intl]);
  const playersText = (count: number) => (count === 1 ? s.onePlayer : fill(s.players, { count: number.format(count) }));
  const msText = (ms: number) => fill(s.ping, { ms: number.format(Math.round(ms)) });

  const peaks = points.map((p) => p.peak).filter((v): v is number => v !== null);
  const peak = peaks.length ? Math.max(...peaks) : null;
  const average = mean(points.map((p) => p.players).filter((v): v is number => v !== null));
  const uptime = mean(points.map((p) => p.up));
  const ping = mean(points.map((p) => p.ping).filter((v): v is number => v !== null));
  const stats = [
    { label: s.peak, value: peak === null ? "-" : number.format(peak) },
    { label: s.average, value: average === null ? "-" : number.format(average) },
    { label: s.uptime, value: uptime === null ? "-" : percent.format(Math.floor(uptime * 1000) / 1000) },
    { label: s.avgPing, value: ping === null ? "-" : msText(ping) },
  ];

  const describePlayers = (p: HistoryPoint) => {
    if (p.up < 0.5 && p.players === null) return s.offline;
    if (p.players === null || p.peak === null) return s.online;
    if (p.peak !== p.players) return fill(s.peakAverage, { peak: number.format(p.peak), average: number.format(p.players) });
    return playersText(p.peak);
  };
  const describePing = (p: HistoryPoint) => (p.ping !== null ? msText(p.ping) : p.up < 0.5 ? s.offline : s.noPing);
  const playersNow = !live ? null : !live.online ? s.offline : live.players !== null ? playersText(live.players) : null;

  return (
    <section id={historyId} className="history" aria-labelledby={headingId}>
      <div className="history__head">
        <div className="history__intro">
          <h2 id={headingId} className="history__title">
            {s.history}
          </h2>
          <p className="history__lead">{s.historyLead}</p>
        </div>
        <div className="history__controls">
          {current && names.length > 1 ? (
            <Dropdown
              label={s.historyServer}
              buttonLabel={`${s.historyServer}: ${current}`}
              options={names.map((name) => ({ key: name, label: name, icon: "server" as const }))}
              value={current}
              onChange={onSelect}
              className="history__server"
              buttonClass="ideas__filter-btn history__server-btn"
            >
              <Icon name="server" />
              <span>{current}</span>
              <Icon name="chevron" className="ideas__chevron" />
            </Dropdown>
          ) : (
            current && (
              <span className="ideas__filter-btn history__server-btn history__server-one">
                <Icon name="server" />
                <span>{current}</span>
              </span>
            )
          )}
          <div className="ideas__sort history__range" role="group" aria-label={s.historyRange}>
            {historyRanges.map((key) => (
              <button
                key={key}
                type="button"
                className={range === key ? "is-active" : undefined}
                aria-pressed={range === key}
                aria-label={s.rangeNames[key]}
                title={s.rangeNames[key]}
                onClick={() => setRange(key)}
              >
                {s.rangeShort[key]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {failed[range] && loading ? (
        <p className="servers__empty">{s.historyError}</p>
      ) : !points.length ? (
        <p className="servers__empty">{s.historyEmpty}</p>
      ) : (
        <div className={`history__body${loading ? " is-loading" : ""}`} aria-busy={loading}>
          <dl className="history__stats">
            {stats.map((stat) => (
              <div key={stat.label} className="history__stat">
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
          <div className="history__charts">
            <HistoryChart
              title={s.playersChart}
              current={playersNow}
              points={points}
              value={(p) => p.peak}
              whole
              range={view.range}
              from={view.from}
              to={view.to}
              bucket={view.bucket}
              intl={intl}
              formatAxis={(v) => number.format(v)}
              describe={describePlayers}
              tone="players"
              offlineLabel={s.offline}
            />
            <HistoryChart
              title={s.pingChart}
              current={live?.ping != null ? msText(live.ping) : null}
              points={points}
              value={(p) => p.ping}
              whole={false}
              range={view.range}
              from={view.from}
              to={view.to}
              bucket={view.bucket}
              intl={intl}
              formatAxis={(v) => number.format(v)}
              describe={describePing}
              tone="ping"
              offlineLabel={s.offline}
            />
          </div>
        </div>
      )}
    </section>
  );
}
