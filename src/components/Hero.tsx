"use client";

import { motion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { useRef, type CSSProperties } from "react";
import hero from "@/assets/hero.jpg";
import { useI18n } from "@/i18n/context";
import { heroSlides } from "@/lib/art";
import type { HeadlineLine } from "@/i18n/types";
import type { Release } from "@/lib/github";
import { scrollToSection } from "@/lib/scroll";
import { DiscordButton, DownloadButton } from "./Buttons";
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
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const artY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const slabNear = useTransform(scrollYProgress, [0, 1], [0, -260]);
  const slabFar = useTransform(scrollYProgress, [0, 1], [0, -120]);

  const units = Math.max(...t.hero.lines.map(lineWidth));
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
        {/* The hero's own picture, then the game's key art: a slow crossfade with a zoom, 7 s each. */}
        {[hero, ...heroSlides].map((src, i) => (
          <div key={i} className="hero__slide">
            <Image
              src={src}
              alt=""
              fill
              preload={i === 0}
              loading={i === 0 ? undefined : "eager"}
              sizes="(max-aspect-ratio: 53/25) 233vh, 110vw"
              placeholder="blur"
              className="hero__img"
              quality={90}
            />
          </div>
        ))}
      </motion.div>
      <div className="hero__shade" />
      <motion.div className="slab slab--a" style={{ y: slabNear }} />
      <motion.div className="slab slab--b" style={{ y: slabFar }} />
      <motion.div className="slab slab--c" style={{ y: slabNear }} />

      <motion.div className="wrap hero__copy" style={{ y: copyY }}>
        <h1 aria-label={t.hero.title} style={{ "--hero-scale": scale, "--hero-cap": `${cap}px` } as CSSProperties}>
          {t.hero.lines.map(({ white, red }, i) => (
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
          {t.hero.lede}
        </motion.p>

        <motion.div className="cta" {...fadeUp(0.85)}>
          <DownloadButton href={release.downloadUrl} label={t.hero.download} large />
          <DiscordButton label={t.hero.discord} large />
        </motion.div>

        <motion.div className="hero__meta" {...fadeUp(1)}>
          {release.publishedAt && (
            <span className="hero__updated">
              <Icon name="clock" />
              {t.hero.updated}{" "}
              <b>
                <RelativeTime iso={release.publishedAt} locale={locale} />
              </b>
            </span>
          )}
          {release.tag && (
            <span>
              {t.hero.latest} <b>{release.tag}</b>
            </span>
          )}
          <span>{t.hero.windows}</span>
        </motion.div>
      </motion.div>

      <motion.a
        href="#why"
        onClick={(e) => {
          e.preventDefault();
          scrollToSection("why");
        }}
        className="hero__scroll"
        aria-label={t.hero.scrollLabel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 1 }}
      >
        <span>{t.hero.scroll}</span>
        <i />
      </motion.a>
    </header>
  );
}
