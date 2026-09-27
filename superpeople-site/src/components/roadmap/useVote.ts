"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FeedbackItem } from "reflet-sdk";
import type { Viewer } from "@/lib/board";
import { signIn } from "./viewer";

export function useVote({
  patch,
  viewer,
  authReady,
  next,
}: {
  patch: (id: string, change: Partial<FeedbackItem>) => void;
  viewer: Viewer | null;
  authReady: boolean;
  next: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string[]>([]);

  const vote = async (item: FeedbackItem) => {
    if (!authReady || pending.includes(item.id) || viewer?.banned) return;
    const before = { hasVoted: item.hasVoted, voteCount: item.voteCount };
    if (viewer) patch(item.id, { hasVoted: !item.hasVoted, voteCount: item.voteCount + (item.hasVoted ? -1 : 1) });
    setPending((ids) => [...ids, item.id]);
    try {
      const response = await fetch("/api/roadmap/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId: item.id }),
      });
      if (response.status === 401) {
        patch(item.id, before);
        return signIn(next);
      }
      if (!response.ok) throw new Error(String(response.status));
      const result = (await response.json()) as { voteCount: number; voted: boolean };
      patch(item.id, { hasVoted: result.voted, voteCount: result.voteCount });
      if (!viewer) router.refresh();
    } catch {
      patch(item.id, before);
    } finally {
      setPending((ids) => ids.filter((id) => id !== item.id));
    }
  };

  return { vote, pending };
}
