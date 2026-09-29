"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type SyntheticEvent } from "react";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import { useI18n } from "@/i18n/context";
import { Icon, type IconName } from "../Icon";
import { ease } from "../motion";
import type { useAdmin } from "./admin";

const stop = (e: SyntheticEvent) => e.stopPropagation();
const items = (root: HTMLElement | null) => [...(root?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];

// manage: edit, move and delete (the "manage" permission). comments: turning the item's comments off
// or back on, only where the comments are loaded (the item's dialog).
export function ItemMenu({
  item,
  admin,
  onEdit,
  removeLabel,
  manage = true,
  comments,
  align = "right",
  className,
}: {
  item: FeedbackItem;
  admin: ReturnType<typeof useAdmin>;
  onEdit: () => void;
  removeLabel?: string;
  manage?: boolean;
  comments?: { off: boolean; onToggle: () => void };
  align?: "left" | "right";
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const busy = admin.busy === item.id;

  const destinations: { status: FeedbackStatus; label: string; icon: IconName }[] = [
    { status: "open", label: t.nav.ideas, icon: "bulb" },
    { status: "planned", label: t.plan.todo, icon: "todo" },
    { status: "in_progress", label: t.plan.doing, icon: "wrench" },
    { status: "completed", label: t.plan.done, icon: "done" },
  ];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    items(root.current)[0]?.focus();
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  const run = (action: () => unknown) => {
    setOpen(false);
    void action();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const list = items(root.current);
    const index = list.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? list.length - 1
          : (index + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
    list[next]?.focus();
  };

  return (
    <div
      ref={root}
      className={`item-menu${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
      onKeyDown={onKey}
      onMouseDown={stop}
      onTouchStart={stop}
    >
      <button
        ref={button}
        type="button"
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={t.board.more}
        title={t.board.more}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="more" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            className={`item-menu__pop item-menu__pop--${align}`}
            role="menu"
            aria-label={t.board.more}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease }}
          >
            {manage && (
              <>
                <button type="button" role="menuitem" onClick={() => run(onEdit)}>
                  <Icon name="edit" />
                  {t.board.edit}
                </button>
                <div className="item-menu__sep" role="separator" />
                <p className="item-menu__label" aria-hidden="true">
                  {t.board.moveTo}
                </p>
              </>
            )}
            {manage && destinations.map((destination) => {
              const current = item.status === destination.status;
              return (
                <button
                  key={destination.status}
                  type="button"
                  role="menuitem"
                  disabled={current}
                  aria-label={`${t.board.moveTo}: ${destination.label}`}
                  onClick={() => run(() => admin.move(item, destination.status))}
                >
                  <Icon name={destination.icon} />
                  {destination.label}
                  {current && <Icon name="check" className="item-menu__check" />}
                </button>
              );
            })}
            {comments && (
              <>
                {manage && <div className="item-menu__sep" role="separator" />}
                <button type="button" role="menuitem" onClick={() => run(comments.onToggle)}>
                  <Icon name={comments.off ? "comment" : "lock"} />
                  {comments.off ? t.board.commentsOn : t.board.commentsOff}
                </button>
              </>
            )}
            {manage && (
              <>
                <div className="item-menu__sep" role="separator" />
                <button type="button" role="menuitem" className="is-danger" onClick={() => run(() => admin.remove(item, removeLabel))}>
                  <Icon name="trash" />
                  {removeLabel ?? t.board.remove}
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
