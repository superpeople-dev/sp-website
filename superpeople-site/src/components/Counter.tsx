"use client";

import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { useI18n } from "@/i18n/context";
import { localeInfo } from "@/i18n/config";

type Ease = [number, number, number, number];

const settle: Ease = [0.16, 1, 0.3, 1];

type Props = {
  value: number;
  from?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  ease?: Ease;
  end?: string;
};

export function Counter({
  value,
  from = 0,
  duration = 1.8,
  prefix = "",
  suffix = "",
  decimals = 0,
  ease = settle,
  end,
}: Props) {
  const { locale } = useI18n();
  const format = useMemo(() => new Intl.NumberFormat(localeInfo[locale].intl), [locale]);
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const count = useMotionValue(from);
  const text = useTransform(count, (v) => {
    const settled = Math.abs(v - value) < 0.005;
    const number = decimals && !settled ? v.toFixed(decimals) : format.format(Math.round(v));
    return prefix + number + suffix;
  });
  const progress = useTransform(count, (v) => (from === value ? 1 : (v - from) / (value - from)));
  const countOpacity = useTransform(progress, [0, 0.5, 0.88], [1, 1, 0]);
  const countBlur = useTransform(progress, [0.45, 0.88], ["blur(0px)", "blur(10px)"]);
  const countY = useTransform(progress, [0.35, 1], ["0em", "0.35em"]);
  const endOpacity = useTransform(progress, [0.6, 1], [0, 1]);
  const endBlur = useTransform(progress, [0.6, 1], ["blur(10px)", "blur(0px)"]);
  const endY = useTransform(progress, [0.6, 1], ["-0.25em", "0em"]);

  useEffect(() => {
    if (!seen) return;
    const controls = animate(count, value, { duration: reduced ? 0 : duration, ease });
    return () => controls.stop();
  }, [seen, reduced, value, duration, count, ease]);

  if (!end) return <motion.span ref={ref}>{text}</motion.span>;

  return (
    <span ref={ref} className="counter">
      <motion.span aria-hidden="true" style={{ opacity: countOpacity, filter: countBlur, y: countY }}>
        {text}
      </motion.span>
      <motion.span style={{ opacity: endOpacity, filter: endBlur, y: endY }}>{end}</motion.span>
    </span>
  );
}
