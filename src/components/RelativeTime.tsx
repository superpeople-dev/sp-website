"use client";

import { useSyncExternalStore } from "react";
import { localeInfo, type Locale } from "@/i18n/config";

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

function ago(iso: string, now: number, intl: string) {
  const relative = new Intl.RelativeTimeFormat(intl, { numeric: "auto" });
  const seconds = (Date.parse(iso) - now) / 1000;
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return relative.format(0, "second");
}

const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 60_000);
  return () => clearInterval(id);
};
const currentMinute = () => Math.floor(Date.now() / 60_000);

export function RelativeTime({ iso, locale }: { iso: string; locale: Locale }) {
  const minute = useSyncExternalStore(subscribe, currentMinute, () => null);
  const intl = localeInfo[locale].intl;
  const date = new Intl.DateTimeFormat(intl, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso),
  );
  return (
    <time dateTime={iso} title={date}>
      {minute === null ? date : ago(iso, minute * 60_000, intl)}
    </time>
  );
}
