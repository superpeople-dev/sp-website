import type { ReactNode } from "react";
import { mentionPattern } from "@/lib/mentions";

// The text of a post or a comment: its web addresses become links (a new tab, and marked as user
// content for search engines), and in comments its @mentions are highlighted.

const urlPattern = /https?:\/\/[^\s<>"'`]+/gi;
// What ends a sentence rather than the address ("see https://example.com."); a ")" stays when the
// address opened one itself (like Wikipedia's).
const endsSentence = /[.,;:!?'"\]}]$/;

function trimAddress(url: string) {
  let end = url;
  for (;;) {
    if (endsSentence.test(end)) end = end.slice(0, -1);
    else if (end.endsWith(")") && (end.match(/\(/g)?.length ?? 0) < (end.match(/\)/g)?.length ?? 0)) end = end.slice(0, -1);
    else return end;
  }
}

function withMentions(text: string, key: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(mentionPattern)) {
    const at = (match.index ?? 0) + match[1].length;
    parts.push(text.slice(last, at), <span key={`${key}@${at}`} className="mention">@{match[2]}</span>);
    last = at + 1 + match[2].length;
  }
  parts.push(text.slice(last));
  return parts;
}

export function richText(text: string, { mentions = false } = {}): ReactNode[] {
  const plain = (part: string, key: string) => (mentions ? withMentions(part, key) : [part]);
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(urlPattern)) {
    const start = match.index ?? 0;
    const url = trimAddress(match[0]);
    try {
      new URL(url);
    } catch {
      continue;
    }
    parts.push(...plain(text.slice(last, start), `t${start}`));
    parts.push(
      <a key={`u${start}`} className="rich-link" href={url} target="_blank" rel="noopener noreferrer nofollow ugc">
        {url}
      </a>,
    );
    last = start + url.length;
  }
  parts.push(...plain(text.slice(last), "end"));
  return parts;
}
