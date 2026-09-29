"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import type { FeedbackItem, FeedbackStatus } from "reflet-sdk";
import { localeHref } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { doneAt, type BoardItem, type Category, type TypeTag, type Viewer } from "@/lib/board";
import { Icon } from "../Icon";
import { Reveal } from "../motion";
import { ItemDialog, type Opened } from "./ItemDialog";
import { AddTask } from "./AddTask";
import { useAdmin } from "./admin";
import { useVote } from "./useVote";
import { WorkCard } from "./WorkCard";
import { useItemUrl } from "./useItemUrl";

const recentDone = 6;

type CardProps = Omit<Parameters<typeof WorkCard>[0], "drag" | "overlay">;

function DropZone({ id, children }: { id: FeedbackStatus; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`plan__drop${isOver ? " is-over" : ""}`}>
      {children}
    </div>
  );
}

function DraggableCard(props: CardProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: props.item.id });
  return <WorkCard {...props} drag={{ ref: setNodeRef, listeners, dragging: isDragging }} />;
}

export function PlanBoard({
  initial,
  categories,
  types,
  viewer,
  authReady,
}: {
  initial: FeedbackItem[];
  categories: Category[];
  types: TypeTag[];
  viewer: Viewer | null;
  authReady: boolean;
}) {
  const { locale, t } = useI18n();
  const p = t.plan;
  const [items, setItems] = useState<BoardItem[]>(initial);
  const admin = useAdmin(setItems);
  const [opened, setOpened] = useState<Opened | null>(null);
  useItemUrl(opened?.id ?? null, (id) => setOpened(id && items.some((item) => item.id === id) ? { id, mode: "view" } : null));
  const [dragging, setDragging] = useState<string | null>(null);
  const justDropped = useRef(false);
  const current = opened ? (items.find((item) => item.id === opened.id) ?? null) : null;
  const moving = dragging ? (items.find((item) => item.id === dragging) ?? null) : null;
  const close = useCallback(() => setOpened(null), []);
  const setMode = useCallback((mode: Opened["mode"]) => setOpened((o) => o && { ...o, mode }), []);
  const patch = useCallback(
    (id: string, change: Partial<BoardItem>) =>
      setItems((list) => list.map((item) => (item.id === id ? { ...item, ...change } : item))),
    [],
  );
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  );
  const canDrag = viewer?.admin === true;
  const next = localeHref(locale, "/roadmap");
  const { vote, pending, prompt: signInPrompt } = useVote({ patch, viewer, authReady, next });
  const add = (item: FeedbackItem) => setItems((list) => [...list.filter((entry) => entry.id !== item.id), item]);

  const columns = useMemo(() => {
    const of = (status: FeedbackStatus) => items.filter((item) => item.status === status);
    const byVotes = (a: FeedbackItem, b: FeedbackItem) => b.voteCount - a.voteCount;
    const done = of("completed").sort((a, b) => doneAt(b) - doneAt(a));
    return [
      { key: "planned" as const, icon: "todo" as const, title: p.todo, items: of("planned").sort(byVotes), total: undefined },
      { key: "in_progress" as const, icon: "wrench" as const, title: p.doing, items: of("in_progress").sort(byVotes), total: undefined },
      { key: "completed" as const, icon: "done" as const, title: p.done, items: done.slice(0, recentDone), total: done.length },
    ];
  }, [items, p]);

  const open = (id: string, mode: Opened["mode"]) => {
    if (!justDropped.current) setOpened({ id, mode });
  };

  const onDragStart = ({ active }: DragStartEvent) => setDragging(String(active.id));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    justDropped.current = true;
    window.setTimeout(() => {
      justDropped.current = false;
    }, 0);
    const item = items.find((entry) => entry.id === active.id);
    if (item && over && over.id !== item.status) void admin.move(item, over.id as FeedbackStatus);
  };

  const board = (
    <div className="wrap plan">
      {columns.map((column, i) => {
        const body = (
          <>
            <p className="panel__title">
              <span className="plan__icon" aria-hidden="true">
                <Icon name={column.icon} />
              </span>
              {column.title}
              <span className="panel__count">{column.total ?? column.items.length}</span>
            </p>
            {column.items.length ? (
              <ul className="work-list">
                {column.items.map((item) => {
                  const props: CardProps = {
                    item,
                    categories,
                    admin: canDrag ? admin : null,
                    showDate: column.key === "completed",
                    onOpen: (mode) => open(item.id, mode),
                    onVote: authReady ? (direction) => void vote(item, direction) : undefined,
                    voteDisabled: pending.includes(item.id) || viewer?.banned,
                  };
                  return canDrag ? <DraggableCard key={item.id} {...props} /> : <WorkCard key={item.id} {...props} />;
                })}
              </ul>
            ) : (
              <p className="plan__empty">{p.empty}</p>
            )}
            {canDrag && <AddTask status={column.key} onAdded={add} />}
            {column.key === "completed" && (column.total ?? 0) > 0 && (
              <Link className="plan__more" href={localeHref(locale, "/completed")}>
                {p.seeAll}
                <Icon name="right" />
              </Link>
            )}
          </>
        );
        return (
          <Reveal key={column.key} className={`panel plan__col plan__col--${column.key}`} delay={0.08 * i}>
            {canDrag ? <DropZone id={column.key}>{body}</DropZone> : body}
          </Reveal>
        );
      })}
    </div>
  );

  return (
    <section className="flush">
      {canDrag ? (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          {board}
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
            {moving && (
              <ul className="work-list">
                <WorkCard
                  item={moving}
                  categories={categories}
                  admin={null}
                  showDate={moving.status === "completed"}
                  onOpen={() => undefined}
                  overlay
                />
              </ul>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        board
      )}
      <ItemDialog
        item={current}
        mode={opened?.mode ?? "view"}
        onMode={setMode}
        onClose={close}
        categories={categories}
        types={types}
        viewer={viewer}
        authReady={authReady}
        next={next}
        admin={admin}
        onPatch={patch}
        vote={(item, direction) => void vote(item, direction)}
        votePending={current ? pending.includes(current.id) : false}
      />
      {admin.dialog}
      {signInPrompt}
    </section>
  );
}
