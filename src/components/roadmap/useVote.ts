"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FeedbackItem } from "reflet-sdk";
import { useI18n } from "@/i18n/context";
import { downvoted, type BoardItem, type VoteDirection, type Viewer } from "@/lib/board";
import { useConfirm } from "../ConfirmDialog";
import { signIn } from "./viewer";

export function useVote({
  patch,
  viewer,
  authReady,
  next,
}: {
  patch: (id: string, change: Partial<BoardItem>) => void;
  viewer: Viewer | null;
  authReady: boolean;
  next: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [ask, prompt] = useConfirm();
  const [pending, setPending] = useState<string[]>([]);

  const offerSignIn = () =>
    void ask({
      title: t.board.connectTitle,
      body: t.board.connectBody,
      confirm: t.board.signIn,
      cancel: t.board.cancel,
      icon: "discord",
      discord: true,
    }).then((ok) => ok && signIn(next));

  // Up and down are exclusive: voting one way takes back a vote the other way; the same way again
  // takes the vote back. The score is shown at once and corrected by the server's answer.
  const vote = async (item: FeedbackItem, direction: VoteDirection = "up") => {
    if (!authReady || pending.includes(item.id) || viewer?.banned) return;
    const up = item.hasVoted;
    const down = downvoted(item);
    const before = { hasVoted: up, hasDownvoted: down, voteCount: item.voteCount };
    if (viewer) {
      const nextUp = direction === "up" && !up;
      const nextDown = direction === "down" && !down;
      const score = (nextUp ? 1 : 0) - (nextDown ? 1 : 0) - ((up ? 1 : 0) - (down ? 1 : 0));
      patch(item.id, { hasVoted: nextUp, hasDownvoted: nextDown, voteCount: item.voteCount + score });
    }
    setPending((ids) => [...ids, item.id]);
    try {
      const response = await fetch("/api/roadmap/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId: item.id, direction }),
      });
      if (response.status === 401) {
        patch(item.id, before);
        return offerSignIn();
      }
      if (!response.ok) throw new Error(String(response.status));
      const result = (await response.json()) as { voteCount: number; voted: boolean; downvoted: boolean };
      patch(item.id, { hasVoted: result.voted, hasDownvoted: result.downvoted, voteCount: result.voteCount });
      if (!viewer) router.refresh();
    } catch {
      patch(item.id, before);
    } finally {
      setPending((ids) => ids.filter((id) => id !== item.id));
    }
  };

  return { vote, pending, prompt };
}
