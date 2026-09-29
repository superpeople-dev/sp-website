"use client";

import { useEffect, useRef } from "react";
import { itemPath } from "@/lib/board";

// The address of the page being looked at, to share: with an item's dialog open, that item's page.
export const pageUrl = () => window.location.origin + window.location.pathname;

// The item whose dialog is open has its own address, <base>/<id>/<slug> (base is the board's path,
// like /fr/bugs-and-ideas), so it can be shared and opens the same way for whoever follows it. Opening pushes
// that address, so the back button (or back gesture on phones) closes the dialog; closing goes back
// to the board's address. onUrl gets the item id after back/forward, or null.
export function useItemUrl(base: string, opened: { id: string; title: string } | null, onUrl: (id: string | null) => void) {
  const latest = useRef(onUrl);
  const pushed = useRef(false);
  // The page arrives with the address already right (an item page is rendered with its dialog open).
  const synced = useRef<string | null>(opened?.id ?? null);

  useEffect(() => {
    latest.current = onUrl;
  });

  useEffect(() => {
    const onPop = () => {
      pushed.current = false;
      const path = window.location.pathname;
      const id = path.startsWith(`${base}/`) ? path.slice(base.length + 1).split("/")[0] || null : null;
      synced.current = id;
      latest.current(id);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [base]);

  const id = opened?.id ?? null;
  const path = opened ? itemPath(base, opened) : base;
  useEffect(() => {
    // Only when the open item changes (not on arrival, and not when React runs effects twice).
    if (synced.current === id) return;
    synced.current = id;
    if (window.location.pathname === path) return;
    if (id) {
      window.history.pushState(null, "", path);
      pushed.current = true;
    } else if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", path);
    }
  }, [id, path]);
}
