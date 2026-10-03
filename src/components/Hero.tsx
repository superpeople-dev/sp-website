"use client";

import { motion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { useRef, type CSSProperties } from "react";
import hero from "@/assets/hero.jpg";
import { useI18n } from "@/i18n/context";
import type { HeadlineLine } from "@/i18n/types";
import type { Release } from "@/lib/github";
import { DiscordButton } from "./Buttons";
import { Icon } from "./Icon";
import { RelativeTime } from "./RelativeTime";
import { ease } from "./motion";

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease, delay },
});

const wide = /[ᄀ-ᇿ⺀-鿿가-힯＀-￯]/;

const lineWidth = ({ white = "", red = "" }: HeadlineLine) =>
  [...`${white} ${red}`.trim()].reduce((sum, ch) => sum + (wide.test(ch) ? 2.3 : ch === " " ? 0.55 : 1), 0);

export function Hero({ release }: { release: Release }) {
  const { locale, t } = useI18n();
  const h = t.hero;
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const artY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -120]);

  const units = Math.max(...h.lines.map(lineWidth));
  const scale = Math.min(1, 11.2 / units);
  const cap = Math.round(120 * Math.min(1, 20 / units));

  return (
    <header className="hero" id="top" ref={ref}>
      <motion.div
        className="hero__art"
        style={{ y: artY }}
        initial={{ scale: 1.16 }}
        animate={{ scale: 1.04 }}
        transition={{ duration: 2.4, ease }}
      >
        <Image src={hero} alt="" fill preload sizes="110vw" placeholder="blur" className="hero__img" quality={90} />
      </motion.div>
      <div className="hero__shade" />

      <motion.div className="wrap hero__copy" style={{ y: copyY }}>
        <h1 aria-label={h.title} style={{ "--hero-scale": scale, "--hero-cap": `${cap}px` } as CSSProperties}>
          {h.lines.map(({ white, red }, i) => (
            <span className="hero__line" key={i} aria-hidden="true">
              <motion.span
                initial={{ y: "130%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1, ease, delay: 0.2 + i * 0.13 }}
              >
                {white}
                {white && red && " "}
                {red && <em>{red}</em>}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p className="hero__lede" {...fadeUp(0.7)}>
          {h.lede}
        </motion.p>

        <motion.div className="cta" {...fadeUp(0.85)}>
          <DiscordButton label={h.discord} large />
          <a href={release.downloadUrl} className="hero__play">
            <Icon name="download" />
            <span>
              {h.playNow}
              <small>{h.playSub}</small>
            </span>
          </a>
        </motion.div>

        <motion.div className="hero__meta" {...fadeUp(1)}>
          {release.publishedAt && (
            <span className="hero__updated">
              <Icon name="clock" />
              {h.updated}{" "}
              <b>
                <RelativeTime iso={release.publishedAt} locale={locale} />
              </b>
            </span>
          )}
          {release.tag && (
            <span>
              {h.latest} <b>{release.tag}</b>
            </span>
          )}
          <span>{h.windows}</span>
        </motion.div>
      </motion.div>
    </header>
  );
}
