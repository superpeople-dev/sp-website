"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import { fill } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import type { Category, TypeTag } from "@/lib/board";
import { useConfirm } from "../ConfirmDialog";
import { Icon, type IconName } from "../Icon";
import { Toast } from "../Toast";

export type Step = { status: FeedbackStatus; label: string; icon: IconName };
export type EditValues = { title: string; description: string; typeId: string; categoryId: string };

export function useAdmin(setItems: Dispatch<SetStateAction<FeedbackItem[]>>) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [ask, dialog] = useConfirm();
  const [notice, setNotice] = useState({ show: false, text: "", icon: "check" as IconName });
  const timer = useRef(0);
  const flash = (text: string, icon: IconName = "check") => {
    window.clearTimeout(timer.current);
    setNotice({ show: true, text, icon });
    timer.current = window.setTimeout(() => setNotice((current) => ({ ...current, show: false })), 2400);
  };
  const b = t.board;
  const places: Partial<Record<FeedbackStatus, string>> = {
    open: t.nav.ideas,
    planned: t.plan.todo,
    in_progress: t.plan.doing,
    completed: t.plan.done,
  };

  // done: the toast once it worked.
  const send = async (item: FeedbackItem, body: object, apply: (list: FeedbackItem[]) => FeedbackItem[], done: string) => {
    setBusy(item.id);
    try {
      const response = await fetch("/api/admin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId: item.id, ...body }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setItems(apply);
      flash(done);
      return true;
    } catch {
      flash(b.actionFailed, "close");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const update = (id: string, change: Partial<FeedbackItem>) => (list: FeedbackItem[]) =>
    list.map((i) => (i.id === id ? { ...i, ...change } : i));

  return {
    busy,
    dialog: (
      <>
        {dialog}
        <Toast show={notice.show} icon={notice.icon}>
          {notice.text}
        </Toast>
      </>
    ),
    move: async (item: FeedbackItem, status: FeedbackStatus) => {
      if (item.status === status) return true;
      setItems(update(item.id, { status, completedAt: status === "completed" ? Date.now() : item.completedAt }));
      const approved = item.status === "under_review" && status === "open";
      const done = approved ? b.toastApproved : fill(b.toastMoved, { place: places[status] ?? status });
      const ok = await send(item, { action: "status", status }, (list) => list, done);
      if (!ok) setItems(update(item.id, { status: item.status, completedAt: item.completedAt }));
      return ok;
    },
    remove: async (item: FeedbackItem, label = t.board.remove) => {
      const ok = await ask({
        title: t.board.removeTitle,
        body: fill(t.board.confirmRemove, { title: item.title }),
        confirm: label,
        cancel: t.board.cancel,
        icon: "trash",
        danger: true,
      });
      const done = item.status === "under_review" ? b.toastRejected : b.toastDeleted;
      return ok && send(item, { action: "delete" }, (list) => list.filter((i) => i.id !== item.id), done);
    },
    edit: (item: FeedbackItem, values: EditValues, categories: Category[], types: TypeTag[]) => {
      const managed = new Set([...categories, ...types].map((tag) => tag.id));
      const type = types.find((tag) => tag.id === values.typeId);
      const category = categories.find((tag) => tag.id === values.categoryId);
      const tags = [
        ...item.tags.filter((tag) => !managed.has(tag.id)),
        ...(type ? [{ id: type.id, name: type.slug, color: "" }] : []),
        ...(category ? [category] : []),
      ];
      return send(
        item,
        { action: "edit", ...values },
        update(item.id, { title: values.title.trim(), description: values.description.trim(), tags, updatedAt: Date.now() }),
        b.toastSaved,
      );
    },
  };
}

export function AdminActions({
  item,
  admin,
  steps,
  rejectLabel,
}: {
  item: FeedbackItem;
  admin: ReturnType<typeof useAdmin>;
  steps: Step[];
  rejectLabel?: string;
}) {
  const busy = admin.busy === item.id;
  if (!steps.length && !rejectLabel) return null;

  return (
    <div className="admin-actions" aria-busy={busy}>
      {steps.map((step) => (
        <button key={step.status} type="button" disabled={busy} onClick={() => void admin.move(item, step.status)}>
          <Icon name={step.icon} />
          {step.label}
        </button>
      ))}
      {rejectLabel && (
        <button type="button" className="admin-actions__reject" disabled={busy} onClick={() => void admin.remove(item, rejectLabel)}>
          <Icon name="close" />
          {rejectLabel}
        </button>
      )}
    </div>
  );
}
