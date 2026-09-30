"use client";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import type { HistoryPoint, HistoryRange } from "@/lib/servers";

// One line chart of a server's history (ServerHistory): players or ping over the period, with the
// times the server was offline shaded and a gap where nothing was checked (the backend was down).
// Drawn in the browser at the width it gets: the times are in the visitor's own time zone.

const HEIGHT = 190;
const PAD = { top: 12, right: 10, bottom: 26, left: 38 };

// The axis labels: every few hours over 24 hours, every few days over 7 and 30 days, as many as fit.
const tickSteps: Record<HistoryRange, { unit: "hour" | "day"; steps: number[]; format: Intl.DateTimeFormatOptions }> = {
  "24h": { unit: "hour", steps: [1, 2, 3, 4, 6, 8, 12], format: { hour: "numeric", minute: "2-digit" } },
  "7d": { unit: "day", steps: [1, 2, 3, 7], format: { weekday: "short" } },
  "30d": { unit: "day", steps: [1, 2, 3, 5, 7, 10, 15], format: { day: "numeric", month: "short" } },
};
const MIN_LABEL_GAP = 64;

// A round top for the axis, in 4 steps: 12 players -> 0 3 6 9 12, 87 ms -> 0 25 50 75 100. Counts
// take any whole step up to 10 (a peak of 12 is not drawn on a scale to 20).
function niceTop(max: number, whole: boolean) {
  const raw = Math.max(max, whole ? 1 : 10) / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const factors = whole ? [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] : [1, 2, 2.5, 5, 10];
  const step = factors.map((m) => m * power).find((s) => s >= raw && (!whole || Number.isInteger(s))) ?? 10 * power;
  return step * 4;
}

// Local midnights or whole hours between two times, every step-th one.
function tickTimes(fromMs: number, toMs: number, range: HistoryRange, width: number) {
  const { unit, steps } = tickSteps[range];
  const spanMs = toMs - fromMs;
  const unitMs = unit === "hour" ? 3_600_000 : 86_400_000;
  const step = steps.find((s) => (width * s * unitMs) / spanMs >= MIN_LABEL_GAP) ?? steps[steps.length - 1];
  const d = new Date(fromMs);
  if (unit === "hour") d.setMinutes(0, 0, 0);
  else d.setHours(0, 0, 0, 0);
  const out: number[] = [];
  let n = 0;
  while (d.getTime() <= toMs) {
    if (d.getTime() >= fromMs) {
      const take = unit === "hour" ? d.getHours() % step === 0 : n++ % step === 0;
      if (take) out.push(d.getTime());
    }
    if (unit === "hour") d.setHours(d.getHours() + 1);
    else d.setDate(d.getDate() + 1);
  }
  return out;
}

export function HistoryChart({
  title,
  current,
  points,
  value,
  whole,
  range,
  from,
  to,
  bucket,
  intl,
  formatAxis,
  describe,
  tone,
  offlineLabel,
}: {
  title: string;
  // The value now, next to the title.
  current: string | null;
  points: HistoryPoint[];
  value: (point: HistoryPoint) => number | null;
  // Counts (players) get whole-number steps on the axis.
  whole: boolean;
  range: HistoryRange;
  from: number;
  to: number;
  bucket: number;
  intl: string;
  formatAxis: (value: number) => string;
  // The tooltip's line for a point (offline, or its value).
  describe: (point: HistoryPoint) => string;
  tone: "players" | "ping";
  offlineLabel: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<HistoryPoint | null>(null);
  const gradient = useId();

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => setWidth(Math.round(node.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const startMs = from * 1000;
  const endMs = (to + bucket) * 1000;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (tSeconds: number) => PAD.left + ((tSeconds * 1000 - startMs) / (endMs - startMs)) * plotW;

  const drawn = useMemo(() => {
    const values = points.map(value);
    const top = niceTop(Math.max(0, ...values.map((v) => v ?? 0)), whole);
    const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
    const xAt = (tSeconds: number) => PAD.left + ((tSeconds * 1000 - startMs) / (endMs - startMs)) * plotW;
    // Lines break where a bucket has no value (offline, or not checked).
    const runs: { x: number; y: number }[][] = [];
    let run: { x: number; y: number }[] = [];
    let last = -Infinity;
    points.forEach((point, i) => {
      const v = values[i];
      if (v === null || point.t - last > bucket * 1.5) {
        if (run.length) runs.push(run);
        run = [];
      }
      if (v !== null) run.push({ x: xAt(point.t + bucket / 2), y: y(v) });
      last = v === null ? -Infinity : point.t;
    });
    if (run.length) runs.push(run);
    // Offline stretches: buckets where the server was down most of the time, merged.
    const offline: { x1: number; x2: number }[] = [];
    for (const point of points) {
      if (point.up >= 0.5) continue;
      const x1 = xAt(point.t);
      const x2 = xAt(point.t + bucket);
      const prev = offline[offline.length - 1];
      if (prev && Math.abs(prev.x2 - x1) < 0.5) prev.x2 = x2;
      else offline.push({ x1, x2 });
    }
    return { top, y, runs, offline };
  }, [points, value, whole, bucket, plotH, plotW, startMs, endMs]);

  const axis = useMemo(() => new Intl.DateTimeFormat(intl, tickSteps[range].format), [intl, range]);
  const when = useMemo(
    () =>
      new Intl.DateTimeFormat(intl, range === "24h" ? { weekday: "short", hour: "numeric", minute: "2-digit" } : { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
    [intl, range],
  );
  const ticks = width ? tickTimes(startMs, endMs, range, plotW) : [];
  const levels = [0, 1, 2, 3, 4].map((i) => (drawn.top / 4) * i);

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = points[0];
    for (const point of points) {
      if (Math.abs(x(point.t + bucket / 2) - px) < Math.abs(x(best.t + bucket / 2) - px)) best = point;
    }
    setHover(best);
  };

  const hoverValue = hover ? value(hover) : null;
  const hoverX = hover ? x(hover.t + bucket / 2) : 0;
  const hoverLabel = hover
    ? bucket > 300
      ? when.formatRange(new Date(hover.t * 1000), new Date((hover.t + bucket) * 1000))
      : when.format(new Date(hover.t * 1000))
    : "";

  return (
    <figure className={`chart chart--${tone}`}>
      <figcaption className="chart__head">
        <span className="chart__title">{title}</span>
        {current && <span className="chart__now">{current}</span>}
      </figcaption>
      <div ref={box} className="chart__plot" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            role="img"
            aria-label={current ? `${title}: ${current}` : title}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            </defs>
            {drawn.offline.map((band, i) => (
              <rect key={i} className="chart__offline" x={band.x1} y={PAD.top} width={Math.max(1, band.x2 - band.x1)} height={plotH}>
                <title>{offlineLabel}</title>
              </rect>
            ))}
            {levels.map((level) => (
              <g key={level}>
                <line className="chart__grid" x1={PAD.left} x2={width - PAD.right} y1={drawn.y(level)} y2={drawn.y(level)} />
                <text className="chart__axis" x={PAD.left - 8} y={drawn.y(level)} textAnchor="end" dominantBaseline="middle">
                  {formatAxis(level)}
                </text>
              </g>
            ))}
            {ticks.map((tick) => (
              <text key={tick} className="chart__axis" x={x(tick / 1000)} y={HEIGHT - 6} textAnchor="middle">
                {axis.format(new Date(tick))}
              </text>
            ))}
            {drawn.runs.map((run, i) =>
              run.length === 1 ? (
                <circle key={i} className="chart__dot" cx={run[0].x} cy={run[0].y} r={2.5} />
              ) : (
                <g key={i}>
                  <path
                    className="chart__area"
                    fill={`url(#${gradient})`}
                    d={`M${run[0].x},${PAD.top + plotH} ${run.map((p) => `L${p.x},${p.y}`).join(" ")} L${run[run.length - 1].x},${PAD.top + plotH}Z`}
                  />
                  <path className="chart__line" d={run.map((p, j) => `${j ? "L" : "M"}${p.x},${p.y}`).join(" ")} />
                </g>
              ),
            )}
            {hover && (
              <g className="chart__hover">
                <line x1={hoverX} x2={hoverX} y1={PAD.top} y2={PAD.top + plotH} />
                {hoverValue !== null && <circle cx={hoverX} cy={drawn.y(hoverValue)} r={4} />}
              </g>
            )}
          </svg>
        )}
        {hover && width > 0 && (
          <div className="chart__tip" style={{ left: Math.min(Math.max(hoverX, 90), width - 90) }} aria-hidden="true">
            <span className="chart__tip-time">{hoverLabel}</span>
            <b>{describe(hover)}</b>
          </div>
        )}
      </div>
    </figure>
  );
}
