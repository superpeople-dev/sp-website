"use client";

import { AnimatePresence, motion } from "motion/react";
import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./Icon";

const subscribe = () => () => {};

// A short confirmation at the bottom of the screen, above dialogs ("Link copied"). Screen readers
// announce it: the status region stays in the page and only its content comes and goes.
export function Toast({ show, icon = "check", children }: { show: boolean; icon?: IconName; children: ReactNode }) {
  const client = useSyncExternalStore(subscribe, () => true, () => false);
  if (!client) return null;
  return createPortal(
    <div className="toast-root" role="status" aria-live="polite">
      <AnimatePresence>
        {show && (
          <motion.div
            className="toast"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.22 }}
          >
            <Icon name={icon} />
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
