import type { ReactNode } from "react";

// The text of a news post: a small Markdown subset, built as React elements (never raw HTML, so a post
// can't inject markup). Blocks: "## " and "### " headings, paragraphs, "- " or "* " lists, "1. " lists,
// "> " quotes and image lines "![caption](address)". Inline: **bold**, *italic*, [text](address).
// Addresses must be http(s) or start with "/"; anything else stays plain text.

const safeAddress = (url: string) => /^(https?:\/\/|\/(?!\/))/.test(url);

const inlinePattern = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const k = `${key}-${n++}`;
    if (match[1] !== undefined) out.push(<strong key={k}>{inline(match[1], k)}</strong>);
    else if (match[2] !== undefined) out.push(<em key={k}>{inline(match[2], k)}</em>);
    else if (safeAddress(match[4])) {
      const external = match[4].startsWith("http");
      out.push(
        <a key={k} href={match[4]} {...(external && { target: "_blank", rel: "noopener noreferrer" })}>
          {match[3]}
        </a>,
      );
    } else out.push(match[0]);
    last = at + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const imageLine = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const key = `b${i}`;
    if (!line) {
      i++;
      continue;
    }
    const image = imageLine.exec(line);
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={key}>{inline(line.slice(4), key)}</h3>);
      i++;
    } else if (line.startsWith("## ")) {
      blocks.push(<h2 key={key}>{inline(line.slice(3), key)}</h2>);
      i++;
    } else if (image) {
      if (safeAddress(image[2]))
        blocks.push(
          <figure key={key}>
            {/* eslint-disable-next-line @next/next/no-img-element -- an uploaded picture of any size, behind a redirect */}
            <img src={image[2]} alt={image[1]} loading="lazy" />
            {image[1] && <figcaption>{image[1]}</figcaption>}
          </figure>,
        );
      i++;
    } else if (/^[-*] /.test(line) || /^\d+\. /.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && (ordered ? /^\d+\. /.test(lines[i].trim()) : /^[-*] /.test(lines[i].trim()))) {
        const item = lines[i].trim().replace(ordered ? /^\d+\. / : /^[-*] /, "");
        items.push(<li key={`${key}-${items.length}`}>{inline(item, `${key}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
    } else if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) quote.push(lines[i++].trim().slice(2));
      blocks.push(<blockquote key={key}>{inline(quote.join(" "), key)}</blockquote>);
    } else {
      // The first line always belongs to the paragraph (a broken image line too), so the loop moves on.
      const para: string[] = [lines[i++].trim()];
      while (i < lines.length && lines[i].trim() && !/^(#{2,3} |[-*] |\d+\. |> |!\[)/.test(lines[i].trim())) para.push(lines[i++].trim());
      blocks.push(<p key={key}>{inline(para.join(" "), key)}</p>);
    }
  }
  return <div className={className ?? "prose"}>{blocks}</div>;
}
