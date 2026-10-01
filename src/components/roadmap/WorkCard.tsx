"use client";

import type { DraggableSyntheticListeners } from "@dnd-kit/core";
import { useLayoutEffect, useRef, useState } from "react";
import type { FeedbackItem } from "reflet-sdk";
import { fill, localeInfo } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { categoryOf, doneAt, type Category, type VoteDirection } from "@/lib/board";
import { Icon } from "../Icon";
import type { useAdmin } from "./admin";
import { CategoryTag } from "./CategoryTag";
import { ItemMenu } from "./ItemMenu";
import { VoteControl } from "./VoteControl";

export type Drag = {
  ref: (element: HTMLElement | null) => void;
  listeners: DraggableSyntheticListeners;
  dragging: boolean;
};

export function WorkCard({
  item,
  categories,
  admin,
  onOpen,
  drag,
  overlay,
  onVote,
  voteDisabled,
}: {
  item: FeedbackItem;
  categories: Category[];
  admin: ReturnType<typeof useAdmin> | null;
  onOpen: (mode: "view" | "edit") => void;
  drag?: Drag;
  overlay?: boolean;
  onVote?: (direction: VoteDirection) => void;
  voteDisabled?: boolean;
}) {
  const { locale, t } = useI18n();
  const category = categoryOf(item, categories);
  const done = item.status === "completed";
  // When it was created, or once it is done, when it was completed.
  const date = new Intl.DateTimeFormat(localeInfo[locale].intl, { day: "numeric", month: "short", year: "numeric" }).format(
    done ? doneAt(item) : item.createdAt,
  );
  // A one-line title leaves its second line to the description (three lines instead of two).
  const title = useRef<HTMLSpanElement>(null);
  const [titleLines, setTitleLines] = useState(2);
  useLayoutEffect(() => {
    const element = title.current;
    if (!element) return;
    const measure = () => {
      const line = parseFloat(getComputedStyle(element).lineHeight) || 20;
      setTitleLines(element.getBoundingClientRect().height < line * 1.5 ? 1 : 2);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const classes = ["work", "card", drag && "is-draggable", drag?.dragging && "is-dragging", overlay && "work--overlay"];

  return (
    <li ref={drag?.ref} className={classes.filter(Boolean).join(" ")} {...drag?.listeners}>
      <div className="work__top">
        {item.status !== "completed" &&
          (overlay || onVote ? (
            <VoteControl item={item} className="votes--small" onVote={overlay ? undefined : onVote} disabled={voteDisabled} />
          ) : (
            <span className={`work__votes${item.hasVoted ? " is-voted" : ""}`}>
              <Icon name="up" />
              {item.voteCount}
            </span>
          ))}
        {category && <CategoryTag category={category} />}
        {admin && !overlay && <ItemMenu item={item} admin={admin} onEdit={() => onOpen("edit")} className="work__menu" />}
      </div>
      {/* The title, the description, the date and the comments, one after the other (no empty rows: a
          card is as tall as what it holds). A one-line title gives the description a third line. */}
      <div className="work__text">
        <h3>
          <button type="button" className="card__open" onClick={() => onOpen("view")} tabIndex={overlay ? -1 : undefined}>
            <span ref={title} className="work__title">
              {item.title}
            </span>
          </button>
        </h3>
        <p className="work__desc" style={{ WebkitLineClamp: titleLines === 1 ? 3 : 2 }}>
          {item.description}
        </p>
        <p className="work__date">{fill(done ? t.completed.completedOn : t.completed.createdOn, { date })}</p>
        {item.commentCount > 0 && (
          <p className="work__foot">
            <span className="work__comments">
              <Icon name="comment" />
              {item.commentCount}
            </span>
          </p>
        )}
      </div>
    </li>
  );
}
