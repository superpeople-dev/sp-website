"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { localeHref } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { consentCookie, parseChoice, type Choice } from "@/lib/consent";
import { Icon } from "./Icon";
import { ease } from "./motion";

// The data choice (lib/consent.ts): asked in a card in the corner of every page until the player
// answers Accept or Decline, in the site's own style; changed later from the privacy policy
// (ConsentStatus).

const changed = "sp:consent"; // the cookie was just written
const reopen = "sp:consent-ask"; // the privacy policy's button

const subscribe = (update: () => void) => {
  window.addEventListener(changed, update);
  return () => window.removeEventListener(changed, update);
};
const readChoice = () => parseChoice(document.cookie.match(new RegExp(`(?:^|; )${consentCookie}=([^;]*)`))?.[1]);
// Before the page runs in the browser nothing is known: nothing is shown.
const serverChoice = () => "unknown" as const;

function useChoice(): Choice | null | "unknown" {
  return useSyncExternalStore(subscribe, readChoice, serverChoice);
}

async function save(choice: Choice) {
  await fetch("/api/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ choice }),
  }).catch(() => null);
  window.dispatchEvent(new Event(changed));
}

export function Consent() {
  const { t, locale } = useI18n();
  const c = t.consent;
  const choice = useChoice();
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = asked || choice === null;

  useEffect(() => {
    const ask = () => setAsked(true);
    window.addEventListener(reopen, ask);
    return () => window.removeEventListener(reopen, ask);
  }, []);

  const answer = async (value: Choice) => {
    setBusy(true);
    await save(value);
    setBusy(false);
    setAsked(false);
  };

  if (choice === "unknown") return null;

  // A card in the bottom-left corner, over nothing else: the page stays usable behind it until
  // the player answers.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.section
          className="consent"
          role="region"
          aria-labelledby="consent-title"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25, ease }}
        >
          {/* The text scrolls on a small screen; the two answers always stay in view. */}
          <div className="consent__text">
            <div className="consent__head">
              <span className="consent__icon">
                <Icon name="shield" />
              </span>
              <h2 id="consent-title">{c.title}</h2>
            </div>
            <p>{c.body}</p>
            <ul className="consent__points">
              {c.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <p className="consent__decline">{c.declineNote}</p>
            <Link className="consent__more" href={localeHref(locale, "/privacy")}>
              {c.more}
            </Link>
          </div>
          <div className="consent__actions">
            <button type="button" className="btn" disabled={busy} onClick={() => void answer("declined")}>
              {c.decline}
            </button>
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void answer("accepted")}>
              {c.accept}
            </button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// On the privacy policy: the choice on this device, and a button to change it.
export function ConsentStatus() {
  const { t } = useI18n();
  const c = t.consent;
  const choice = useChoice();
  if (choice === "unknown") return null;
  const status = choice === "accepted" ? c.statusAccepted : choice === "declined" ? c.statusDeclined : c.statusNone;
  return (
    <div className="consent-status">
      <p>{status}</p>
      <button type="button" className="btn" onClick={() => window.dispatchEvent(new Event(reopen))}>
        <Icon name="shield" />
        {c.change}
      </button>
    </div>
  );
}
