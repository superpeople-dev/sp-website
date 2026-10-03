"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/context";
import { Icon } from "./Icon";
import { Toast } from "./Toast";

// A link to share: the phone's share sheet on touch screens, copied on desktop. url is read on the click,
// so it is the address at that moment (an open item or player card is in it).
export function ShareButton({ title, url }: { title: string; url: () => string }) {
  const { t } = useI18n();
  const b = t.board;
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const link = url();
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title, url: link }).catch(() => null);
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(b.shareItem, link);
    }
  };
  return (
    <>
      <button type="button" className={`share-btn${copied ? " is-copied" : ""}`} onClick={() => void share()} aria-label={b.shareItem} title={b.shareItem}>
        <Icon name={copied ? "check" : "share"} />
        <span>{b.shareItem}</span>
      </button>
      <Toast show={copied}>{b.linkCopied}</Toast>
    </>
  );
}
