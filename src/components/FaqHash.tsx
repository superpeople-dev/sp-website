"use client";

import { useEffect } from "react";

// The FAQ page: a link to one question (/faq#q3) opens it, on arrival and when the address changes.
export function FaqHash() {
  useEffect(() => {
    const open = () => {
      const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
      if (target instanceof HTMLDetailsElement) {
        target.open = true;
        target.scrollIntoView({ block: "start" });
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
