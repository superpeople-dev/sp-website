import type { FeedbackTag } from "reflet-sdk";
import type { IdeaType } from "@/i18n/types";
import { ideaTypes } from "./site";

// What an item is, from its type tag, in the Discord posts (app/api/webhooks/reflet, lib/discord.ts):
// how a post names it (as a post, and as a roadmap task), what its completion is called, who posted
// it, and its colour on the site.
export type Kind = { type: string; name: string; task: string; done: string; by: string; color: number };
export const kinds: Record<IdeaType, Kind> = {
  "bug-report": { type: "Bug report", name: "bug report", task: "bug fix", done: "Bug fixed", by: "Reported by", color: 0xff8a80 },
  "feature-request": {
    type: "Feature request",
    name: "feature request",
    task: "feature",
    done: "Feature request completed",
    by: "Suggested by",
    color: 0x8fb0ff,
  },
  enhancement: { type: "Improvement", name: "improvement idea", task: "improvement", done: "Improvement completed", by: "Suggested by", color: 0x3ddc84 },
  question: { type: "Question", name: "question", task: "question", done: "Question answered", by: "Asked by", color: 0xf0b719 },
  other: { type: "Other", name: "idea", task: "task", done: "Completed", by: "Posted by", color: 0x9ca3af },
};
export const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// The type is the tag whose slug (or name, "Bug Report" -> bug-report) is one of lib/site.ts ideaTypes;
// the other tags are the platforms (Launcher, Game, ...).
const typeSlugs: readonly string[] = ideaTypes.map((type) => type.slug);
const tagSlug = (tag: FeedbackTag) => (tag as FeedbackTag & { slug?: string }).slug ?? tag.name.trim().toLowerCase().replace(/\s+/g, "-");
export function typeAndPlatforms(tags: FeedbackTag[]) {
  const typeTag = tags.find((tag) => typeSlugs.includes(tagSlug(tag)));
  const type = (typeTag ? tagSlug(typeTag) : "other") as IdeaType;
  return { type, kind: kinds[type], platforms: tags.filter((tag) => tag !== typeTag).map((tag) => tag.name) };
}
