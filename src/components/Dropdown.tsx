"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type SyntheticEvent } from "react";
import { Icon, type IconName } from "./Icon";
import { ease } from "./motion";

export type DropdownOption<K extends string> = { key: K; label: string; icon: IconName };

const stop = (e: SyntheticEvent) => e.stopPropagation();
const choices = (root: HTMLElement | null) => [...(root?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];

// A button that lists its options right under it, like a select (the idea form's type and platform,
// the ideas' filters). The parent draws the button's inside and names it (labelledBy or buttonLabel);
// label names the list. It may also hold the open state, to open
// the list itself (a required choice left empty).
export function Dropdown<K extends string>({
  label,
  options,
  value,
  onChange,
  children,
  className,
  buttonClass,
  labelledBy,
  buttonLabel,
  align = "left",
  open: openProp,
  onOpen,
}: {
  label: string;
  options: DropdownOption<K>[];
  value: K | null;
  onChange: (key: K) => void;
  children: ReactNode;
  className?: string;
  buttonClass: string;
  labelledBy?: string;
  buttonLabel?: string;
  align?: "left" | "right";
  open?: boolean;
  onOpen?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpen?.(next);
  };
  const setOpenRef = useRef(setOpen);
  useEffect(() => {
    setOpenRef.current = setOpen;
  });

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpenRef.current(false);
    };
    document.addEventListener("pointerdown", onPointer);
    const list = choices(root.current);
    (list.find((option) => option.getAttribute("aria-selected") === "true") ?? list[0])?.focus({ preventScroll: true });
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) {
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && e.target === button.current) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      // Only the list closes, not a dialog it is in (Modal listens on the document).
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      close();
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const list = choices(root.current);
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
      className={`dropdown${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
      onKeyDown={onKey}
      onMouseDown={stop}
      onTouchStart={stop}
    >
      <button
        ref={button}
        type="button"
        className={buttonClass}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-labelledby={labelledBy}
        aria-label={buttonLabel}
        onClick={() => setOpen(!open)}
      >
        {children}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            className={`dropdown__list dropdown__list--${align}`}
            role="listbox"
            aria-label={label}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease }}
          >
            {options.map((option) => (
              <button
                key={option.key}
                type="button"
                role="option"
                aria-selected={option.key === value}
                className={option.key === value ? "is-active" : undefined}
                onClick={() => {
                  onChange(option.key);
                  close();
                }}
              >
                <Icon name={option.icon} />
                <span>{option.label}</span>
                {option.key === value && <Icon name="check" className="dropdown__check" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
