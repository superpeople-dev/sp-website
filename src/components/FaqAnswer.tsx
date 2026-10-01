import { Fragment, type ReactNode } from "react";
import { rich } from "@/lib/rich";

// A FAQ answer, as the home page's questions (Faq) and the FAQ page (FaqList) show it.

const link = /(https?:\/\/[^\s)]+)/g;

// **bold** and `code` (lib/rich.tsx), and web addresses as links.
const inline = (text: string): ReactNode =>
  text.split(link).map((part, i) =>
    i % 2 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part.replace(/^https?:\/\//, "")}
      </a>
    ) : (
      <Fragment key={i}>{rich(part)}</Fragment>
    ),
  );

// Paragraphs split by a blank line, a block of "- " lines as a list, and ``` fences as commands to
// type (one per line).
export function Answer({ text }: { text: string }) {
  return text.split(/\n{2,}/).map((block, i) => {
    if (block.startsWith("```")) {
      return (
        <pre key={i} className="faq__code">
          <code>{block.replace(/^```\n?|\n?```$/g, "")}</code>
        </pre>
      );
    }
    const lines = block.split("\n");
    if (lines.every((line) => line.startsWith("- "))) {
      return (
        <ul key={i}>
          {lines.map((line, j) => (
            <li key={j}>{inline(line.slice(2))}</li>
          ))}
        </ul>
      );
    }
    return <p key={i}>{inline(block)}</p>;
  });
}
