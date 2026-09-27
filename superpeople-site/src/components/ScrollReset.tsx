"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { locales } from "@/i18n/config";

const pageOf = (pathname: string) => {
  const [, first, ...rest] = pathname.split("/");
  return (locales as readonly string[]).includes(first) ? `/${rest.join("/")}` : pathname;
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
