"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./Icon";
import { ease } from "./motion";

type Request = {
  title: string;
  body?: string;
  confirm: string;
  cancel: string;
  icon?: IconName;
  danger?: boolean;
  discord?: boolean;
  resolve: (value: boolean) => void;
};

export type ConfirmOptions = Omit<Request, "resolve">;

const subscribe = () => () => {};

function Dialog({ request, onClose }: { request: Request | null; onClose: (value: boolean) => void }) {
  const client = useSyncExternalStore(subscribe, () => true, () => false);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [request, onClose]);

  if (!client) return null;

  return createPortal(
    <AnimatePresence>
      {request && (
        <div className="confirm-root">
          <motion.div
            className="confirm__backdrop"
            onClick={() => onClose(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className="confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={request.body ? "confirm-body" : undefined}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease }}
          >
            {request.icon && (
              <span className={`confirm__icon${request.danger ? " is-danger" : ""}${request.discord ? " is-discord" : ""}`}>
                <Icon name={request.icon} />
              </span>
            )}
            <h2 id="confirm-title">{request.title}</h2>
            {request.body && <p id="confirm-body">{request.body}</p>}
            <div className="confirm__actions">
              <button type="button" className="btn" onClick={() => onClose(false)}>
                {request.cancel}
              </button>
              <button
                type="button"
                className={`btn ${request.danger ? "btn--danger" : request.discord ? "btn--discord" : "btn--primary"}`}
                onClick={() => onClose(true)}
                autoFocus
              >
                {request.discord && <Icon name="discord" />}
                {request.confirm}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const id = useId();
  const [request, setRequest] = useState<Request | null>(null);
  const ask = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ ...options, resolve })), []);
  const close = useCallback(
    (value: boolean) =>
      setRequest((current) => {
        current?.resolve(value);
        return null;
      }),
    [],
  );
  return [ask, <Dialog key={id} request={request} onClose={close} />];
}
