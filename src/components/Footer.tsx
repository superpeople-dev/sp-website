import Image from "next/image";
import Link from "next/link";
import logo from "@/assets/sp-logo.png";
import { localeHref, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { repoUrl, site } from "@/lib/site";
import { Icon } from "./Icon";

export function Footer({ t, locale }: { t: Dictionary; locale: Locale }) {
  return (
    <footer className="footer">
      <div className="wrap">
        <Image src={logo} alt="" style={{ height: 22, width: "auto" }} />
        <p>{t.footer.disclaimer}</p>
        <nav className="footer__links" aria-label={t.nav.sections}>
          <Link href={localeHref(locale, "/faq")}>{t.faq.short}</Link>
          <Link href={localeHref(locale, "/terms")}>{t.legal.terms}</Link>
          <Link href={localeHref(locale, "/privacy")}>{t.legal.privacy}</Link>
          <a className="footer__social" href={site.discord} target="_blank" rel="noopener">
            <Icon name="discord" />
            Discord
          </a>
          <a className="footer__social" href={site.patreon} target="_blank" rel="noopener">
            <Icon name="patreon" />
            Patreon
          </a>
          <a className="footer__social" href={repoUrl} target="_blank" rel="noopener" aria-label={t.nav.githubLabel}>
            <Icon name="github" />
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
