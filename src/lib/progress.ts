import type { FeedbackItem } from "reflet-sdk";
import type { Dictionary } from "@/i18n/types";
import { doneAt } from "./board";
import { listByStatus, safely } from "./reflet";
import { openStatuses } from "./site";

export type ProgressRow = { id: string; title: string; status: "done" | "wip" | "next" };
export type ProgressLists = { done: ProgressRow[]; working: ProgressRow[]; doneTotal: number; wipTotal: number };

const maxRows = 8;
const byVotes = (a: FeedbackItem, b: FeedbackItem) => b.voteCount - a.voteCount;
const row = (item: FeedbackItem, status: ProgressRow["status"]): ProgressRow => ({ id: item.id, title: item.title, status });

// The home page's two panels, from the roadmap: the latest completed items, and what is in progress
// followed by the most upvoted planned items (Reflet's upvotes: the home page is built ahead of time,
// without the store's downvotes). Both get the same number of rows so they end up the same size.
// Null when the roadmap can't be read; the page then shows the dictionary's lists.
export async function getProgress(): Promise<ProgressLists | null> {
  const lists = await safely(() => Promise.all([listByStatus("completed"), listByStatus("in_progress"), listByStatus("planned")]));
  if (!lists) return null;
  const [completed, inProgress, planned] = lists;
  const done = [...completed].sort((a, b) => doneAt(b) - doneAt(a)).map((item) => row(item, "done"));
  const working = [
    ...[...inProgress].sort(byVotes).map((item) => row(item, "wip")),
    ...[...planned].sort(byVotes).map((item) => row(item, "next")),
  ];
  const rows = Math.min(maxRows, done.length, working.length);
  if (!rows) return null;
  return { done: done.slice(0, rows), working: working.slice(0, rows), doneTotal: completed.length, wipTotal: inProgress.length };
}

export function fallbackProgress(p: Dictionary["progress"]): ProgressLists {
  const rows = Math.min(maxRows, p.doneItems.length, p.openItems.length);
  const working = p.openItems.map((item, i): ProgressRow => ({ id: `open-${i}`, title: item.title, status: openStatuses[i] ?? "next" }));
  return {
    done: p.doneItems.slice(0, rows).map((title, i) => ({ id: `done-${i}`, title, status: "done" })),
    working: working.slice(0, rows),
    doneTotal: p.doneItems.length,
    wipTotal: working.filter((item) => item.status === "wip").length,
  };
}
