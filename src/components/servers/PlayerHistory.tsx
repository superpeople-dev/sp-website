"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { fill, localeInfo } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { playerRanges, type PlayerHistory as History, type PlayerPoint, type PlayerRange } from "@/lib/servers";
import { HistoryChart } from "./HistoryChart";

// The backend adds a point every 5 minutes: a period shown is fetched again at that pace.
const REFRESH_MS = 5 * 60_000;

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

// Under the server list: everyone online (in the lobby or in a match) over 24 hours, 7 or 30 days or
// all of it, with the peak, the average, the average in a match and how many different players.
export function PlayerHistory({ initial }: { initial: History }) {
  const { locale, t } = useI18n();
  const s = t.servers;
  const intl = localeInfo[locale].intl;
  const headingId = useId();
  const [range, setRange] = useState<PlayerRange>("24h");
  const [histories, setHistories] = useState<Partial<Record<PlayerRange, History>>>({ "24h": initial });
  const [failed, setFailed] = useState<Partial<Record<PlayerRange, boolean>>>({});
  const loadedAt = useRef<Partial<Record<PlayerRange, number>>>({});

  useEffect(() => {
    loadedAt.current["24h"] ??= Date.now();
  }, []);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const at = loadedAt.current[range];
      if (document.hidden || (at && Date.now() - at < REFRESH_MS)) return;
      try {
        const res = await fetch(`/api/servers/players?range=${range}`);
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
  const points = view.points;

  const number = useMemo(() => new Intl.NumberFormat(intl, { maximumFractionDigits: 1 }), [intl]);
  const day = useMemo(() => new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric" }), [intl]);
  const playersText = (count: number) => (count === 1 ? s.onePlayer : fill(s.players, { count: number.format(count) }));

  const peak = points.length ? Math.max(...points.map((p) => p.peak)) : null;
  const average = mean(points.map((p) => p.online));
  const inMatch = mean(points.map((p) => p.match));
  const different = view.range === "all" ? view.unique.all : view.unique[view.range];
  const stats = [
    { label: s.peak, value: peak === null ? "-" : number.format(peak) },
    { label: s.average, value: average === null ? "-" : number.format(average) },
    { label: s.matchAverage, value: inMatch === null ? "-" : number.format(inMatch) },
    { label: view.range === "all" ? s.allPlayers : s.uniquePlayers, value: different === null ? "-" : number.format(different) },
  ];
  // The different players of a period are counted from the first day the backend sampled.
  const since = view.since !== null && view.range !== "all" && view.since > view.from ? fill(s.countedSince, { date: day.format(new Date(view.since * 1000)) }) : null;

  const last = points[points.length - 1];
  const describeOnline = (p: PlayerPoint) =>
    p.peak !== p.online ? fill(s.peakAverage, { peak: number.format(p.peak), average: number.format(p.online) }) : playersText(p.peak);
  const describeMatch = (p: PlayerPoint) => playersText(p.match);

  return (
    <section className="history" aria-labelledby={headingId}>
      <div className="history__head">
        <div className="history__intro">
          <h2 id={headingId} className="history__title">
            {s.playersTitle}
          </h2>
          <p className="history__lead">{s.playersLead}</p>
        </div>
        <div className="history__controls">
          <div className="ideas__sort history__range" role="group" aria-label={s.historyRange}>
            {playerRanges.map((key) => (
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
        <p className="servers__empty">{s.playersError}</p>
      ) : !points.length ? (
        <p className="servers__empty">{s.playersEmpty}</p>
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
          {since && <p className="history__note">{since}</p>}
          <div className="history__charts">
            <HistoryChart
              title={s.onlineChart}
              current={view.range === "24h" && last ? playersText(last.online) : null}
              points={points}
              value={(p) => p.peak}
              whole
              range={view.range}
              from={view.from}
              to={view.to}
              bucket={view.bucket}
              intl={intl}
              formatAxis={(v) => number.format(v)}
              describe={describeOnline}
              tone="players"
              offlineLabel={s.offline}
            />
            <HistoryChart
              title={s.matchChart}
              current={view.range === "24h" && last ? playersText(last.match) : null}
              points={points}
              value={(p) => p.match}
              whole
              range={view.range}
              from={view.from}
              to={view.to}
              bucket={view.bucket}
              intl={intl}
              formatAxis={(v) => number.format(v)}
              describe={describeMatch}
              tone="match"
              offlineLabel={s.offline}
            />
          </div>
        </div>
      )}
    </section>
  );
}
