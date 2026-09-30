"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { locales } from "@/i18n/config";

// The page a path is on, without its language: its first segment. An item's own address (its dialog
// open over the board, /completed/<id>/<slug>) is on the board's page, so opening or closing the
// dialog never scrolls the page.
const pageOf = (pathname: string) => {
  const parts = pathname.split("/").filter(Boolean);
  if ((locales as readonly string[]).includes(parts[0])) parts.shift();
  return `/${parts[0] ?? ""}`;
};

export function ScrollReset() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  const popped = useRef(false);

  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const samePage = pageOf(previous.current) === pageOf(pathname);
    previous.current = pathname;
    if (popped.current) {
      popped.current = false;
      return;
    }
    if (samePage || window.location.hash) return;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
