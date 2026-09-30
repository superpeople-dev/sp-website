import type { Mention } from "./board";
import type { StaffMember } from "./staff";
import type { Profile } from "./store";

// @mentions in comments. Who can be mentioned on an item: the person who posted it, everyone who
// commented on it, and the admins. A mention is their Discord username (a-z, 0-9, _ and .), and on
// Discord the new comment's post pings them (lib/discord.ts); nobody else can be pinged that way.

export const mentionPattern = /(^|[^\w@.])@([a-z0-9_.]{2,32})/gi;
export const maxPings = 5;

// The usernames a text mentions, lower case, each once.
export function mentionedUsernames(text: string) {
  return [...new Set([...text.matchAll(mentionPattern)].map((match) => match[2].toLowerCase()))];
}

type Person = Mention & { id: string };

// The item's author first, then the commenters (latest first), then the admins; each username once.
export function mentionable(author: Profile | undefined, commenters: (Profile | undefined)[], staff: StaffMember[]): Person[] {
  const people = new Map<string, Person>();
  const add = (person: { id: string; name: string; username?: string; avatar?: string }, admin: boolean) => {
    const username = person.username?.toLowerCase();
    if (!username || people.has(username)) return;
    people.set(username, { id: person.id, name: person.name, username, avatar: person.avatar, admin });
  };
  const admins = new Set(staff.map((member) => member.id));
  if (author) add(author, admins.has(author.id));
  for (const profile of [...commenters].reverse()) if (profile) add(profile, admins.has(profile.id));
  for (const member of staff) add(member, true);
  return [...people.values()];
}
