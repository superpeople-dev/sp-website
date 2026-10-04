"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/context";
import { guns } from "@/lib/art";
import { repoUrl, site } from "@/lib/site";
import { DiscordButton } from "./Buttons";
import { Icon, type IconName } from "./Icon";
import { Reveal, inView, rise, stagger } from "./motion";
import { Toast } from "./Toast";

// Hovering only restyles the border (CSS) and tilts the icon; the card itself stays put.
const card: Variants = rise;
const badge: Variants = { hover: { rotate: -10, scale: 1.12 } };

function Card({ icon, title, text, action }: { icon: IconName; title: string; text: string; action: ReactNode }) {
  return (
    <motion.div className="panel help__card" variants={card} whileHover="hover">
      <motion.div className="ico" variants={badge}>
        <Icon name={icon} />
      </motion.div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </motion.div>
  );
}

function ShareButton() {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.origin + window.location.pathname;
    if (navigator.share) {
      try {
        await navigator.share({ title: t.help.shareTitle, text: t.help.shareText, url });
      } catch {}
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <>
      <button className="btn" type="button" onClick={share}>
        <Icon name={copied ? "check" : "share"} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? "copied" : "share"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {copied ? t.help.copied : t.help.share}
          </motion.span>
        </AnimatePresence>
      </button>
      <Toast show={copied}>{t.board.linkCopied}</Toast>
    </>
  );
}

export function Help() {
  const { t } = useI18n();
  const h = t.help;

  return (
    <section id="help" className="tint tint--rev">
      <Image className="gun gun--help" src={guns.gold} quality={90} alt="" aria-hidden="true" />
      <div className="wrap">
        <Reveal>
          <h2>{h.title}</h2>
          <p className="lead">{h.lead}</p>
        </Reveal>
        <motion.div className="help" {...inView} variants={stagger(0.12)}>
          <Card icon="upload" title={h.spreadTitle} text={h.spreadText} action={<ShareButton />} />
          <Card
            icon="code"
            title={h.codeTitle}
            text={h.codeText}
            action={
              <a className="btn" href={repoUrl} target="_blank" rel="noopener">
                <Icon name="github" />
                {h.github}
              </a>
            }
          />
          <Card icon="layers" title={h.testTitle} text={h.testText} action={<DiscordButton label={t.hero.discord} />} />
          <Card
            icon="heart"
            title={h.supportTitle}
            text={h.supportText}
            action={
              <a className="btn" href={site.patreon} target="_blank" rel="noopener">
                <Icon name="patreon" />
                {h.patreon}
              </a>
            }
          />
        </motion.div>
      </div>
    </section>
  );
}
