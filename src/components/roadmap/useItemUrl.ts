"use client";

import { useEffect, useRef } from "react";

const param = "item";

// The page link for one item, to share: opening it opens that item's dialog.
export const itemUrl = (id: string) => {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set(param, id);
  return url.toString();
};

// Keeps ?item=<id> in the address bar while an item's dialog is open, so the address can be shared
// and opens the same item for whoever follows it. Opening pushes a history entry, so the back button
// (or back gesture on phones) closes the dialog. onUrl gets the id from the link, or null.
export function useItemUrl(openedId: string | null, onUrl: (id: string | null) => void) {
  const latest = useRef(onUrl);
  const pushed = useRef(false);
  const synced = useRef<string | null>(null);

  useEffect(() => {
    latest.current = onUrl;
  });

  useEffect(() => {
    const read = () => latest.current(new URLSearchParams(window.location.search).get(param));
    read();
    const onPop = () => {
      pushed.current = false;
      read();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    // Only when the open item changes (not on arrival, and not when React runs effects twice).
    if (synced.current === openedId) return;
    synced.current = openedId;
    const url = new URL(window.location.href);
    const current = url.searchParams.get(param);
    if (openedId && current !== openedId) {
      url.searchParams.set(param, openedId);
      window.history.pushState(null, "", url);
      pushed.current = true;
    } else if (!openedId && current) {
      if (pushed.current) {
        pushed.current = false;
        window.history.back();
      } else {
        url.searchParams.delete(param);
        window.history.replaceState(null, "", url);
      }
    }
  }, [openedId]);
}
