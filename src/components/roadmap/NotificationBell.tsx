"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
// The list opens under it and marks everything as seen; each notification opens its item.
export function NotificationBell() {
  const { locale, t } = useI18n();
  const b = t.board;
  const [notices, setNotices] = useState<Notice[]>([]);
  const [seen, setSeen] = useState(0);
  // What was new when the list was opened stays marked while it is open.
  const [since, setSince] = useState(0);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
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
      {open && (
        <div className="bell__panel" role="dialog" aria-label={b.notifications}>
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
        </div>
      )}
    </div>
  );
}
