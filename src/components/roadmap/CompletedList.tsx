"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import type { FeedbackItem } from "reflet-sdk";
import { localeHref } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { can, categoryOf, doneAt, type BoardItem, type Category, type TypeTag, type Viewer } from "@/lib/board";
import { Icon } from "../Icon";
import { Reveal } from "../motion";
import { ItemDialog, type Opened } from "./ItemDialog";
import { useAdmin } from "./admin";
import { categoryIcon, platformName } from "./CategoryTag";
import { WorkCard } from "./WorkCard";
import { useItemUrl } from "./useItemUrl";

export function CompletedList({
  initial,
  categories,
  types,
  viewer,
  authReady,
  openId,
}: {
  initial: FeedbackItem[];
  categories: Category[];
  types: TypeTag[];
  viewer: Viewer | null;
  authReady: boolean;
  openId?: string;
}) {
  const { locale, t } = useI18n();
  const [items, setItems] = useState<BoardItem[]>(initial);
  const admin = useAdmin(setItems);
  // Opened on arrival when this is an item's page (/completed/<id>/<slug>).
  const [opened, setOpened] = useState<Opened | null>(openId ? { id: openId, mode: "view" } : null);
  const current = opened ? (items.find((item) => item.id === opened.id) ?? null) : null;
  useItemUrl(localeHref(locale, "/completed"), current, (id) =>
    setOpened(id && items.some((item) => item.id === id) ? { id, mode: "view" } : null),
  );
  const close = useCallback(() => setOpened(null), []);
  const setMode = useCallback((mode: Opened["mode"]) => setOpened((o) => o && { ...o, mode }), []);
  const patch = useCallback(
    (id: string, change: Partial<BoardItem>) =>
      setItems((list) => list.map((item) => (item.id === id ? { ...item, ...change } : item))),
    [],
  );

  const groups = useMemo(() => {
    const done = items.filter((item) => item.status === "completed").sort((a, b) => doneAt(b) - doneAt(a));
    const map = new Map<string, { category: Category | null; items: FeedbackItem[] }>();
    for (const item of done) {
      const category = categoryOf(item, categories);
      const key = category?.id ?? "";
      if (!map.has(key)) map.set(key, { category, items: [] });
      map.get(key)?.items.push(item);
    }
    const order = (key: string) => {
      const index = categories.findIndex((c) => c.id === key);
      return index === -1 ? (key ? categories.length : categories.length + 1) : index;
    };
    return [...map.entries()].sort(([a], [b]) => order(a) - order(b)).map(([, group]) => group);
  }, [items, categories]);

  if (!groups.length) {
    return (
      <section className="flush">
        <div className="wrap">
          <p className="ideas__empty">{t.completed.empty}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flush">
      <div className="wrap done-groups">
        {groups.map((group, i) => (
          <Reveal key={group.category?.id ?? "other"} className="done-group" delay={Math.min(0.06 * i, 0.3)} y={16}>
            <h2 className="done-group__title">
              <span className="done-group__icon" style={{ "--cat": group.category?.color ?? "var(--muted)" } as CSSProperties}>
                <Icon name={group.category ? categoryIcon(group.category.name) : "other"} />
              </span>
              {group.category ? platformName(group.category.name, t.ideas) : t.completed.other}
              <span className="panel__count">{group.items.length}</span>
            </h2>
            <ul className="work-list work-list--grid">
              {group.items.map((item) => (
                <WorkCard
                  key={item.id}
                  item={item}
                  categories={categories}
                  admin={can(viewer, "manage") ? admin : null}
                  onOpen={(mode) => setOpened({ id: item.id, mode })}
                />
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
      <ItemDialog
        item={current}
        mode={opened?.mode ?? "view"}
        onMode={setMode}
        onClose={close}
        categories={categories}
        types={types}
        viewer={viewer}
        authReady={authReady}
        next={localeHref(locale, "/completed")}
        admin={admin}
        onPatch={patch}
      />
      {admin.dialog}
    </section>
  );
}
