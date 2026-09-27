"use client";

import type { DraggableSyntheticListeners } from "@dnd-kit/core";
import type { FeedbackItem } from "reflet-sdk";
import { fill, localeInfo } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { categoryOf, doneAt, type Category } from "@/lib/board";
import { Icon } from "../Icon";
import type { useAdmin } from "./admin";
import { CategoryTag } from "./CategoryTag";
import { ItemMenu } from "./ItemMenu";

export type Drag = {
  ref: (element: HTMLElement | null) => void;
  listeners: DraggableSyntheticListeners;
  dragging: boolean;
};

export function WorkCard({
  item,
  categories,
  admin,
  showDate,
  onOpen,
  drag,
  overlay,
}: {
  item: FeedbackItem;
  categories: Category[];
  admin: ReturnType<typeof useAdmin> | null;
  showDate?: boolean;
  onOpen: (mode: "view" | "edit") => void;
  drag?: Drag;
  overlay?: boolean;
}) {
  const { locale, t } = useI18n();
  const category = categoryOf(item, categories);
  const date = new Intl.DateTimeFormat(localeInfo[locale].intl, { day: "numeric", month: "short", year: "numeric" }).format(
    doneAt(item),
  );
  const classes = ["work", "card", drag && "is-draggable", drag?.dragging && "is-dragging", overlay && "work--overlay"];

  return (
    <li ref={drag?.ref} className={classes.filter(Boolean).join(" ")} {...drag?.listeners}>
      <div className="work__top">
        <span className="work__votes">
          <Icon name="up" />
          {item.voteCount}
        </span>
        {category && <CategoryTag category={category} />}
        {admin && !overlay && <ItemMenu item={item} admin={admin} onEdit={() => onOpen("edit")} className="work__menu" />}
      </div>
      <h3>
        <button type="button" className="card__open" onClick={() => onOpen("view")} tabIndex={overlay ? -1 : undefined}>
          {item.title}
        </button>
      </h3>
      {item.description && <p className="work__desc">{item.description}</p>}
      {showDate && <p className="work__date">{fill(t.completed.completedOn, { date })}</p>}
      {item.commentCount > 0 && (
        <p className="work__comments">
          <Icon name="comment" />
          {item.commentCount}
        </p>
      )}
    </li>
  );
}
