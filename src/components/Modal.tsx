"use client";

import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useTransform, type PanInfo } from "motion/react";
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ease } from "./motion";

const subscribe = () => () => {};
const focusable = "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])";

// On phones the dialog is a bottom sheet (globals.css, max-width: 600px) that can be pulled down to
// close it: from the grabber line at its top or the bar under it, not from their buttons and never
// from the scrolling body, so dragging and scrolling cannot fight.
const phoneQuery = "(max-width: 600px)";
const subscribePhone = (change: () => void) => {
  const media = window.matchMedia(phoneQuery);
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
};
const isPhone = () => window.matchMedia(phoneQuery).matches;
const grabZone = ".sheet__grab, .sheet__bar";
const DISMISS_PX = 140; // pulled further than this (or a third of the sheet), it closes...
const DISMISS_SPEED = 600; // ...or flicked down faster than this, in px/s
const interactive = "button, a, input, textarea, select, label, [role='button'], [contenteditable='true']";
const sheetEase = [0.32, 0.72, 0, 1] as const;

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
  const openRef = useRef(open);
  const client = useSyncExternalStore(subscribe, () => true, () => false);
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  const drag = useDragControls();
  const y = useMotionValue<number | string>(0);
  // The backdrop fades with the sheet as it is pulled down.
  const shade = useTransform(y, (v) => {
    const height = panel.current?.offsetHeight || window.innerHeight;
    const px = typeof v === "number" ? v : v.endsWith("%") ? (parseFloat(v) / 100) * height : parseFloat(v) || 0;
    return Math.min(1, Math.max(0, 1 - px / height));
  });

  useEffect(() => {
    openRef.current = open;
  }, [open]);

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

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!phone || !panel.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    const target = e.target as HTMLElement;
    const zone = target.closest(grabZone);
    if (!zone || !panel.current.contains(zone) || target.closest(interactive)) return;
    drag.start(e);
  };

  const settle = () => animate(y, 0, { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] });

  const endDrag = (_: unknown, info: PanInfo) => {
    const height = panel.current?.offsetHeight ?? 0;
    if (info.offset.y <= Math.min(DISMISS_PX, height * 0.35) && info.velocity.y <= DISMISS_SPEED) return settle();
    // Closing slides the sheet on from where the finger left it. A parent may refuse (the idea form
    // asks first when something was typed): then it goes back up.
    onClose();
    window.setTimeout(() => openRef.current && settle(), 120);
  };

  if (!client) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="sheet-root">
          <motion.div
            className="sheet__veil"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: phone ? 0.3 : 0.2 }}
          >
            <motion.div className="sheet__backdrop" style={phone ? { opacity: shade } : undefined} />
          </motion.div>
          <motion.div
            ref={panel}
            className={`sheet${className ? ` ${className}` : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            onKeyDown={trapFocus}
            onPointerDown={startDrag}
            style={{ y }}
            drag={phone ? "y" : false}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={0}
            dragMomentum={false}
            onDragEnd={endDrag}
            initial={phone ? { y: "100%" } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={phone ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={phone ? { y: "100%" } : { opacity: 0, y: 12, scale: 0.99 }}
            transition={phone ? { duration: 0.32, ease: sheetEase } : { duration: 0.28, ease }}
          >
            <div className="sheet__grab" aria-hidden="true" />
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
