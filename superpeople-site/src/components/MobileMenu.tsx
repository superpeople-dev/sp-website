"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import logo from "@/assets/sp-logo.png";
import { localeHref, localeInfo, locales, type PagePath } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { repoUrl, site } from "@/lib/site";
import { Flag } from "./Flag";
import { Icon, type IconName } from "./Icon";
import { ease } from "./motion";

const subscribe = () => () => {};

export const menuPages = [
  { path: "", label: "home", hint: "homeHint", icon: "home" },
  { path: "/ideas", label: "ideas", hint: "ideasHint", icon: "bulb" },
  { path: "/roadmap", label: "roadmap", hint: "roadmapHint", icon: "board" },
  { path: "/completed", label: "completed", hint: "completedHint", icon: "done" },
] as const satisfies readonly { path: PagePath; label: string; hint: string; icon: IconName }[];

export function MobileMenu({
  open,
  page,
  downloadUrl,
  onClose,
  onNavigate,
  returnFocus,
}: {
  open: boolean;
  page: PagePath;
  downloadUrl: string;
  onClose: () => void;
  onNavigate: (e: MouseEvent<HTMLAnchorElement>, path: PagePath) => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const { locale, t } = useI18n();
  const panel = useRef<HTMLDivElement>(null);
  const client = useSyncExternalStore(subscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const button = returnFocus.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      button?.focus();
    };
  }, [open, onClose, returnFocus]);

  const trapFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panel.current) return;
    const items = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  if (!client) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="drawer-root">
          <motion.div
            className="drawer__backdrop"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
          <motion.div
            ref={panel}
            id="mobile-menu"
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t.nav.sections}
            onKeyDown={trapFocus}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40, mass: 0.9 }}
          >
            <div className="drawer__head">
              <Image src={logo} alt="SUPER PEOPLE" style={{ height: 24, width: "auto" }} />
              <button type="button" className="drawer__close" onClick={onClose} aria-label={t.nav.closeMenu} autoFocus>
                <Icon name="close" />
              </button>
            </div>

            <p className="drawer__label">{t.nav.sections}</p>
            <nav className="drawer__links" aria-label={t.nav.sections}>
              {menuPages.map(({ path, label, hint, icon }, i) => {
                const active = page === path;
                return (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: 28 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, ease, delay: 0.1 + 0.05 * i }}
                  >
                    <Link
                      href={localeHref(locale, path)}
                      className={`drawer__link${active ? " is-active" : ""}`}
                      aria-current={active ? "page" : undefined}
                      onClick={(e) => onNavigate(e, path)}
                    >
                      <span className="drawer__icon">
                        <Icon name={icon} />
                      </span>
                      <span className="drawer__text">
                        <b>{t.nav[label]}</b>
                        <small>{t.nav[hint]}</small>
                      </span>
                      <Icon name="right" className="drawer__chevron" />
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <motion.div
              className="drawer__actions"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease, delay: 0.32 }}
            >
              <a className="btn btn--primary" href={downloadUrl}>
                <Icon name="download" />
                {t.hero.download}
              </a>
              <a className="btn btn--discord" href={site.discord} target="_blank" rel="noopener">
                <Icon name="discord" />
                {t.hero.discord}
              </a>
            </motion.div>

            <div className="drawer__foot">
              <p className="drawer__label">{t.nav.language}</p>
              <div className="drawer__langs">
                {locales.map((l) => (
                  <Link
                    key={l}
                    href={localeHref(l, page)}
                    scroll={false}
                    hrefLang={localeInfo[l].hreflang}
                    className={l === locale ? "is-current" : undefined}
                    aria-current={l === locale ? "true" : undefined}
                    aria-label={localeInfo[l].name}
                    title={localeInfo[l].name}
                    onClick={onClose}
                  >
                    <Flag locale={l} />
                    <span>{localeInfo[l].short}</span>
                  </Link>
                ))}
              </div>
              <div className="drawer__legal">
                <Link href={localeHref(locale, "/terms")} onClick={onClose}>
                  {t.legal.terms}
                </Link>
                <Link href={localeHref(locale, "/privacy")} onClick={onClose}>
                  {t.legal.privacy}
                </Link>
                <a href={repoUrl} target="_blank" rel="noopener">
                  GitHub
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
