"use client";

import type { FeedbackItem } from "reflet-sdk";
import { fill } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { downvoted, type VoteDirection } from "@/lib/board";
import { Icon } from "../Icon";

// ⇧ score ⇩ in a pill like Reddit's, where the score is upvotes minus downvotes. Without onVote (a
// card being dragged) it only shows the same look.
export function VoteControl({
  item,
  onVote,
  disabled,
  className,
}: {
  item: FeedbackItem;
  onVote?: (direction: VoteDirection) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const r = t.ideas;
  const up = item.hasVoted;
  const down = downvoted(item);
  const classes = ["votes", up && "is-up", down && "is-down", className].filter(Boolean).join(" ");

  if (!onVote) {
    return (
      <span className={classes} aria-hidden="true">
        <span className="votes__up">
          <Icon name="vote" />
        </span>
        <b className="votes__count">{item.voteCount}</b>
        <span className="votes__down">
          <Icon name="vote" />
        </span>
      </span>
    );
  }

  return (
    <div className={classes} role="group" aria-label={t.board.votes}>
      <button
        type="button"
        className="votes__up"
        aria-pressed={up}
        aria-label={fill(up ? r.unvote : r.vote, { title: item.title })}
        disabled={disabled}
        onClick={() => onVote("up")}
      >
        <Icon name="vote" />
      </button>
      <b className="votes__count">{item.voteCount}</b>
      <button
        type="button"
        className="votes__down"
        aria-pressed={down}
        aria-label={fill(down ? r.undownvote : r.downvote, { title: item.title })}
        disabled={disabled}
        onClick={() => onVote("down")}
      >
        <Icon name="vote" />
      </button>
    </div>
  );
}
