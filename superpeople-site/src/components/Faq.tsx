"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useI18n } from "@/i18n/context";
import { Reveal, ease, inView, rise, stagger } from "./motion";

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
                      <p>{item.a}</p>
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
