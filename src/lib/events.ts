import { after } from "next/server";
import { eventRanges, type ActivityEvent, type EventRange } from "./board";
import { announce } from "./discord";
import type { SessionUser } from "./session";
import { readEvents, saveEvent } from "./store";

// The admins' activity log: everything that happens in the community on the site (ideas posted,
// approved, moved or deleted, comments posted or deleted with their text, bans, admin changes).
// Votes are not in it: there would be too many.

type NewEvent = Omit<ActivityEvent, "id" | "at" | "actor">;

// Adds a line to the log, and posts it on Discord (lib/discord.ts) once the response is sent. Never
// fails the action it records.
export async function logEvent(actor: Pick<SessionUser, "id" | "name" | "avatar">, event: NewEvent) {
  const entry: ActivityEvent = {
    id: crypto.randomUUID(),
    at: Date.now(),
    actor: { id: actor.id, name: actor.name, avatar: actor.avatar },
    ...event,
  };
  await saveEvent(entry);
  after(() => announce(entry));
}

export { eventRanges, type EventRange };

const day = 24 * 60 * 60 * 1000;
const spans: Record<EventRange, number> = { "24h": day, "7d": 7 * day, "30d": 30 * day, all: Number.POSITIVE_INFINITY };

// The events of a period, newest first, whose text has every word of the search (people's names,
// titles, comment text, event type).
export async function findEvents(range: EventRange, search: string, limit = 300) {
  const since = Date.now() - spans[range];
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (await readEvents()).filter((event) => {
    if (event.at < since) return false;
    if (!words.length) return true;
    const text = [event.type, event.actor.name, event.item?.title, event.user?.name, event.text, event.to]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });
  return { events: matches.slice(0, limit), total: matches.length };
}
