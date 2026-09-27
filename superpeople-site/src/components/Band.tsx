"use client";

import { motion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { useRef } from "react";
import squad from "@/assets/squad.jpg";
import { useI18n } from "@/i18n/context";
import { DiscordButton, DownloadButton } from "./Buttons";
import { Reveal } from "./motion";

export function Band({ downloadUrl }: { downloadUrl: string }) {
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);

  return (
    <section className="band" ref={ref}>
      <motion.div className="band__art" style={{ y }}>
        <Image src={squad} alt="" fill sizes="100vw" placeholder="blur" />
      </motion.div>
      <div className="band__shade" />
      <Reveal className="wrap">
        <h2>{t.band.title}</h2>
        <p className="lead">{t.band.lead}</p>
        <div className="cta">
          <DownloadButton href={downloadUrl} label={t.hero.download} large />
          <DiscordButton label={t.hero.discord} large />
        </div>
      </Reveal>
    </section>
  );
}
