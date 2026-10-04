"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { localeHref } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { boardOf, itemPath, type Notice } from "@/lib/board";
import { Avatar } from "../Avatar";
import { Icon } from "../Icon";
import { RelativeTime } from "../RelativeTime";

// Looked at again every minute and a half while the page is in front, and when it comes back.
const refresh = 90_000;

// A translated sentence with {placeholders} filled with elements (the names in bold).
function fillNodes(text: string, values: Record<string, ReactNode>) {
  return text.split(/(\{\w+\})/).map((part, i) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1];
    return <Fragment key={i}>{key && key in values ? values[key] : part}</Fragment>;
  });
}

// The bell in the account bar: an admin assigned you a task, or someone mentioned you in a comment.
// The list opens under it and marks everything as seen; each notification opens its item. The list is
// drawn on <body> and placed under the bell (on phones: under the account bar, as wide as it), so the
// page head never has to be lifted over the board for it: its art reaches down over the board's filters.
export function NotificationBell() {
  const { locale, t } = useI18n();
  const b = t.board;
  const [notices, setNotices] = useState<Notice[]>([]);
  const [seen, setSeen] = useState(0);
  // What was new when the list was opened stays marked while it is open.
  const [since, setSince] = useState(0);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const data = (await response.json()) as { notices: Notice[]; seen: number };
    setNotices(data.notices);
    setSeen(data.seen);
  }, []);

  useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible") void load();
    };
    again();
    const timer = window.setInterval(again, refresh);
    window.addEventListener("focus", again);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", again);
    };
  }, [load]);

  // Under the bell, and with it while the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!open) return;
    const follow = () => {
      const bell = button.current?.getBoundingClientRect();
      if (!bell) return;
      const bar = root.current?.closest(".account-bar")?.getBoundingClientRect();
      if (bar && window.matchMedia("(max-width: 700px)").matches) setPlace({ top: bar.bottom + 8, left: bar.left, width: bar.width });
      else setPlace({ top: bell.bottom + 8, right: document.documentElement.clientWidth - bell.right });
    };
    follow();
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    return () => {
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // The list is not inside the bell any more: Tab goes into it from there.
    panel.current?.focus({ preventScroll: true });
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!root.current?.contains(target) && !panel.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = notices.filter((notice) => notice.at > seen).length;

  const toggle = () => {
    if (open) return setOpen(false);
    setSince(seen);
    setOpen(true);
    if (unread) {
      setSeen(Date.now());
      void fetch("/api/notifications", { method: "POST" }).catch(() => null);
    }
  };

  return (
    <div ref={root} className="account-bar__bell">
      <button
        ref={button}
        type="button"
        className="btn btn--sm bell__btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread ? `${b.notifications} (${unread})` : b.notifications}
        title={b.notifications}
        onClick={toggle}
      >
        <Icon name="bell" />
        {unread > 0 && <span className="bell__count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open &&
        createPortal(
          <div ref={panel} className="bell__panel" role="dialog" aria-label={b.notifications} tabIndex={-1} style={place}>
            <p className="bell__title">{b.notifications}</p>
            {notices.length ? (
              notices.map((notice) => (
                <a
                  key={notice.id}
                  className={`notice${notice.at > since ? " is-new" : ""}`}
                  href={itemPath(localeHref(locale, boardOf(notice.item.status ?? "open")), notice.item)}
                >
                  <Avatar src={notice.actor.avatar} size={32} />
                  <span className="notice__main">
                    <span className="notice__text">
                      {fillNodes(notice.type === "assigned" ? b.noticeAssigned : b.noticeMention, {
                        actor: <b>{notice.actor.name}</b>,
                        item: <b>{notice.item.title}</b>,
                      })}
                    </span>
                    {notice.text && <span className="notice__quote">{notice.text}</span>}
                    <RelativeTime iso={new Date(notice.at).toISOString()} locale={locale} />
                  </span>
                </a>
              ))
            ) : (
              <p className="bell__empty">{b.noticesEmpty}</p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
