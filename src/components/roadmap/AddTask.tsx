"use client";

import { useCallback, useRef, useState } from "react";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import { useI18n } from "@/i18n/context";
import type { Category, TypeTag } from "@/lib/board";
import { Icon, type IconName } from "../Icon";
import { Toast } from "../Toast";
import { IdeaForm, type Created, type IdeaFields } from "./IdeaForm";

const columnIcon: Partial<Record<FeedbackStatus, IconName>> = { planned: "todo", in_progress: "wrench", completed: "done" };

// A roadmap column's "Add task": the same form as a new idea on Bugs & Ideas (type, platform, title,
// details, images), and the task goes straight into this column.
export function AddTask({
  status,
  categories,
  types,
  onAdded,
}: {
  status: FeedbackStatus;
  categories: Category[];
  types: TypeTag[];
  onAdded: (item: FeedbackItem) => void;
}) {
  const { t } = useI18n();
  const b = t.board;
  const [open, setOpen] = useState(false);
  // Shown for a moment after adding: "partial" when some files did not upload.
  const [toast, setToast] = useState<"added" | "partial" | null>(null);
  const created = useRef<FeedbackItem | null>(null);
  const timer = useRef(0);
  const close = useCallback(() => setOpen(false), []);

  const create = async (fields: IdeaFields): Promise<Created> => {
    const response = await fetch("/api/admin/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", status, ...fields }),
    });
    if (!response.ok) return { error: "error" };
    const { item } = (await response.json()) as { item: FeedbackItem };
    created.current = item;
    return { feedbackId: item.id };
  };

  const added = (_: string, failedUploads: number) => {
    if (created.current) onAdded(created.current);
    setOpen(false);
    window.clearTimeout(timer.current);
    setToast(failedUploads ? "partial" : "added");
    timer.current = window.setTimeout(() => setToast(null), 2400);
  };

  return (
    <>
      <button type="button" className="add-task" onClick={() => setOpen(true)}>
        <Icon name="plus" />
        {b.addTask}
      </button>
      <IdeaForm
        open={open}
        onClose={close}
        categories={categories}
        types={types}
        heading={b.addTask}
        icon={columnIcon[status] ?? "plus"}
        submit={b.addTask}
        submitIcon="plus"
        closeText={{ title: b.taskCloseTitle, body: b.taskCloseBody }}
        create={create}
        onCreated={added}
      />
      <Toast show={toast !== null} icon={toast === "partial" ? "attach" : "check"}>
        {toast === "partial" ? b.mediaUploadFailed : b.toastAdded}
      </Toast>
    </>
  );
}
