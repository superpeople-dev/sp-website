import Image from "next/image";
import Link from "next/link";
import logo from "@/assets/sp-logo.png";
import { localeHref, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { site } from "@/lib/site";
import { Icon } from "./Icon";

export function Footer({ t, locale }: { t: Dictionary; locale: Locale }) {
  return (
    <footer className="footer">
      <div className="wrap">
        <Image src={logo} alt="" style={{ height: 22, width: "auto" }} />
        <p>{t.footer.disclaimer}</p>
        <nav className="footer__links" aria-label={t.nav.sections}>
          <Link href={localeHref(locale, "/terms")}>{t.legal.terms}</Link>
          <Link href={localeHref(locale, "/privacy")}>{t.legal.privacy}</Link>
          <a className="footer__discord" href={site.discord} target="_blank" rel="noopener">
            <Icon name="discord" />
            Discord
          </a>
        </nav>
      </div>
    </footer>
  );
}
