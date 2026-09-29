"use client";

import { AnimatePresence, motion } from "motion/react";
import { Fragment, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n/context";
import { rich } from "@/lib/rich";
import { Reveal, ease, inView, rise, stagger } from "./motion";

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

// An answer: paragraphs split by a blank line, a block of "- " lines as a list, and ``` fences as
// commands to type (one per line).
function Answer({ text }: { text: string }) {
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

export function Faq() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq">
      <div className="wrap">
        <Reveal>
          <h2>{t.faq.title}</h2>
        </Reveal>
        <motion.div className="faq" {...inView} variants={stagger(0.06)}>
          {t.faq.items.map((item, i) => {
            const expanded = open === i;
            return (
              <motion.div key={i} className="faq__item" variants={rise}>
                <h3>
                  <button
                    type="button"
                    className="faq__q"
                    aria-expanded={expanded}
                    aria-controls={`faq-${i}`}
                    onClick={() => setOpen(expanded ? null : i)}
                  >
                    {item.q}
                    <motion.span className="faq__icon" animate={{ rotate: expanded ? 45 : 0 }} transition={{ duration: 0.25, ease }}>
                      +
                    </motion.span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      id={`faq-${i}`}
                      className="faq__a"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease }}
                    >
                      <div className="faq__text">
                        <Answer text={item.a} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
