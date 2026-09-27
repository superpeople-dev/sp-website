"use client";

import { motion } from "motion/react";
import { useI18n } from "@/i18n/context";
import { rich } from "@/lib/rich";
import { DiscordButton, DownloadButton } from "./Buttons";
import { Icon, type IconName } from "./Icon";
import { Reveal, inView, rise, stagger } from "./motion";

const reqIcons: IconName[] = ["windows", "drive", "steam"];

export function Steps({ downloadUrl }: { downloadUrl: string }) {
  const { t } = useI18n();

  return (
    <section id="play" className="tint">
      <div className="wrap">
        <Reveal>
          <h2>{t.steps.title}</h2>
          <p className="lead">{t.steps.lead}</p>
        </Reveal>
        <motion.div className="steps" {...inView} variants={stagger(0.15)}>
          {t.steps.items.map((step, i) => (
            <motion.div key={i} className="panel step" variants={rise} whileHover={{ y: -6 }}>
              <span className="step__num">0{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{rich(step.body)}</p>
              {i === 0 && <DownloadButton href={downloadUrl} label={t.hero.download} />}
              {i === 1 && <DiscordButton label={t.hero.discord} />}
            </motion.div>
          ))}
        </motion.div>
        <Reveal className="reqs" delay={0.2} y={12}>
          {t.steps.reqs.map((req, i) => (
            <span key={req.label}>
              <Icon name={reqIcons[i]} />
              <b>{req.label}</b> {req.value}
            </span>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
