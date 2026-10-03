"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

const leadingLocale = new RegExp(`^/(?:${locales.join("|")})(?=/|$)`);

// The page being read, in another language: everything after the language in its address (a news post,
// an item on the boards, a player on the leaderboard) and its query (?mode=...), so switching language
// stays on it. The query is read when a menu opens (refresh), since reading it while rendering would
// keep every page from being built ahead of time.
export function useLanguageLinks() {
  const pathname = usePathname() ?? "/";
  const [search, setSearch] = useState("");
  const rest = pathname.replace(leadingLocale, "");
  const hrefFor = (l: Locale) => `${l === defaultLocale ? rest || "/" : `/${l}${rest}`}${search}`;
  const refresh = useCallback(() => setSearch(window.location.search), []);
  return { hrefFor, refresh };
}
