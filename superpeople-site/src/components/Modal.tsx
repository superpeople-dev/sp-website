"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ease } from "./motion";

const subscribe = () => () => {};
const focusable = "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])";

export function Modal({
  open,
  onClose,
  labelledBy,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const client = useSyncExternalStore(subscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current)?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".confirm-root, .item-menu.is-open, .lightbox")) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, [open, onClose]);

  const trapFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panel.current) return;
    const items = panel.current.querySelectorAll<HTMLElement>(focusable);
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  if (!client) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="sheet-root">
          <motion.div
            className="sheet__backdrop"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            ref={panel}
            className={`sheet${className ? ` ${className}` : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            onKeyDown={trapFocus}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: 0.28, ease }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
