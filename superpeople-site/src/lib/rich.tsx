import { Fragment, type ReactNode } from "react";

export function rich(text: string): ReactNode {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter(Boolean)
    .map((part, i) => {
      if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
      return <Fragment key={i}>{part}</Fragment>;
    });
}

export const plain = (text: string) => text.replace(/\*\*|`/g, "");
