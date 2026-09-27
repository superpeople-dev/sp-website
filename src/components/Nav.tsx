"use client";

import { motion, useMotionValue, useMotionValueEvent, useScroll, useSpring } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef, useState, type MouseEvent } from "react";
import logo from "@/assets/sp-logo.png";
import { localeHref, type PagePath } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { scrollToTop } from "@/lib/scroll";
import { repoUrl } from "@/lib/site";
import { Icon } from "./Icon";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileMenu, menuPages as pages } from "./MobileMenu";
import { ease } from "./motion";

export function Nav({ downloadUrl, page = "" }: { downloadUrl: string; page?: PagePath }) {
  const { locale, t } = useI18n();
  const { scrollY } = useScroll();
  const ratio = useMotionValue(0);
  const progress = useSpring(ratio, { stiffness: 220, damping: 32, restDelta: 0.001 });
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useMotionValueEvent(scrollY, "change", (y) => {
    setSolid(y > 24);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    ratio.set(max > 0 ? Math.min(y / max, 1) : 0);
  });

  const close = useCallback(() => setMenuOpen(false), []);

  const go = (e: MouseEvent<HTMLAnchorElement>, path: PagePath) => {
    close();
    if (path !== page) return;
    e.preventDefault();
    scrollToTop();
  };

  const underline = (
    <motion.span
      className="nav__underline"
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease, delay: 0.1 }}
    />
  );

  return (
    <header className={`nav${solid ? " nav--solid" : ""}`}>
      <motion.div className="nav__progress" style={{ scaleX: progress }} />
      <div className="wrap nav__inner">
        <Link className="nav__logo" href={localeHref(locale)} onClick={(e) => go(e, "")}>
          <Image src={logo} alt="SUPER PEOPLE" style={{ height: 28, width: "auto" }} preload />
          <span>{t.nav.tagline}</span>
        </Link>

        <nav className="nav__links" aria-label={t.nav.sections}>
          {pages.map(({ path, label, icon }) => (
            <Link
              key={label}
              href={localeHref(locale, path)}
              className={page === path ? "is-active" : undefined}
              aria-current={page === path ? "page" : undefined}
              onClick={(e) => go(e, path)}
            >
              <Icon name={icon} />
              {t.nav[label]}
              {page === path && underline}
            </Link>
          ))}
        </nav>

        <div className="nav__actions">
          <LanguageSwitcher />
          <a className="btn btn--sm gh" href={repoUrl} target="_blank" rel="noopener" aria-label={t.nav.githubLabel}>
            <Icon name="github" />
            <span className="gh__label">GitHub</span>
          </a>
          <a className="btn btn--primary btn--sm nav__download" href={downloadUrl} aria-label={t.hero.download}>
            <Icon name="download" />
            {t.nav.download}
          </a>
          <button
            ref={menuButton}
            type="button"
            className="nav__menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-haspopup="dialog"
            aria-label={t.nav.openMenu}
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" />
          </button>
        </div>
      </div>

      <MobileMenu
        open={menuOpen}
        page={page}
        downloadUrl={downloadUrl}
        onClose={close}
        onNavigate={go}
        returnFocus={menuButton}
      />
    </header>
  );
}
