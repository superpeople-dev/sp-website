"use client";

import { useRef, useState, type FormEvent } from "react";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import { useI18n } from "@/i18n/context";
import { ideaLimits } from "@/lib/site";
import { Icon } from "../Icon";
import { Toast } from "../Toast";
import { FieldCount } from "./FieldCount";

export function AddTask({ status, onAdded }: { status: FeedbackStatus; onAdded: (item: FeedbackItem) => void }) {
  const { t } = useI18n();
  const b = t.board;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [added, setAdded] = useState(false);
  const timer = useRef(0);

  const close = () => {
    setOpen(false);
    setTitle("");
    setState("idle");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = title.trim();
    if (value.length < 3 || state === "sending") return;
    setState("sending");
    const response = await fetch("/api/admin/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", title: value, status }),
    }).catch(() => null);
    if (!response?.ok) return setState("error");
    const { item } = (await response.json()) as { item: FeedbackItem };
    onAdded(item);
    setTitle("");
    setState("idle");
    window.clearTimeout(timer.current);
    setAdded(true);
    timer.current = window.setTimeout(() => setAdded(false), 2400);
  };

  const toast = <Toast show={added}>{b.toastAdded}</Toast>;

  if (!open) {
    return (
      <>
        <button type="button" className="add-task" onClick={() => setOpen(true)}>
          <Icon name="plus" />
          {b.addTask}
        </button>
        {toast}
      </>
    );
  }

  return (
    <form
      className="add-task__form"
      onSubmit={(e) => void submit(e)}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={b.taskPlaceholder}
        aria-label={b.taskPlaceholder}
        minLength={3}
        maxLength={ideaLimits.title}
        required
        autoFocus
      />
      <div className="add-task__actions">
        <FieldCount length={title.length} max={ideaLimits.title} />
        <button type="button" className="btn btn--sm" onClick={close}>
          {b.cancel}
        </button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={state === "sending" || title.trim().length < 3}>
          <Icon name="plus" />
          {b.add}
        </button>
      </div>
      {state === "error" && (
        <p className="add-task__error" role="status">
          {b.actionFailed}
        </p>
      )}
      {toast}
    </form>
  );
}
