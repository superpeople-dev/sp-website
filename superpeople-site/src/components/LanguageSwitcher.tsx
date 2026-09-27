"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { localeHref, localeInfo, locales, pagePaths, type PagePath } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { Flag } from "./Flag";
import { Icon } from "./Icon";
import { ease } from "./motion";

export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const page: PagePath = pagePaths.find((p) => p && pathname.endsWith(p)) ?? "";
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lang" ref={root}>
      <button
        type="button"
        className="btn btn--sm lang__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t.nav.language}: ${localeInfo[locale].name}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Flag locale={locale} />
        <span>{localeInfo[locale].short}</span>
        <Icon name="chevron" className="lang__chevron" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            className="lang__menu"
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease }}
          >
            {locales.map((l) => (
              <li key={l} role="none">
                <Link
                  role="menuitem"
                  href={localeHref(l, page)}
                  scroll={false}
                  hrefLang={localeInfo[l].hreflang}
                  lang={localeInfo[l].htmlLang}
                  aria-current={l === locale ? "true" : undefined}
                  className={l === locale ? "is-current" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className="lang__name">
                    <Flag locale={l} />
                    {localeInfo[l].name}
                  </span>
                  {l === locale && <Icon name="check" />}
                </Link>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
