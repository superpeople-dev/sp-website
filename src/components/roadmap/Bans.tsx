"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fill, localeInfo } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import type { Ban } from "@/lib/store";
import { Icon } from "../Icon";
import { Modal } from "../Modal";

type State = { status: "loading" | "ready" | "error"; bans: Ban[] };

export function BansButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button type="button" className="account-bar__out" onClick={() => setOpen(true)}>
        <Icon name="ban" />
        {t.board.bansOpen}
      </button>
      <Modal open={open} onClose={close} labelledBy="bans-title" className="sheet--narrow">
        <BanList onClose={close} />
      </Modal>
    </>
  );
}

function BanList({ onClose }: { onClose: () => void }) {
  const { locale, t } = useI18n();
  const b = t.board;
  const [state, setState] = useState<State>({ status: "loading", bans: [] });
  const [busy, setBusy] = useState<string | null>(null);
  const day = useMemo(
    () => new Intl.DateTimeFormat(localeInfo[locale].intl, { day: "numeric", month: "short", year: "numeric" }),
    [locale],
  );

  useEffect(() => {
    let live = true;
    fetch("/api/admin/bans", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const { bans } = (await response.json()) as { bans: Ban[] };
        if (live) setState({ status: "ready", bans });
      })
      .catch(() => {
        if (live) setState({ status: "error", bans: [] });
      });
    return () => {
      live = false;
    };
  }, []);

  const unban = async (ban: Ban) => {
    setBusy(ban.id);
    const response = await fetch("/api/admin/bans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unban", user: { id: ban.id } }),
    }).catch(() => null);
    setBusy(null);
    if (!response?.ok) return window.alert(b.actionFailed);
    setState((current) => ({ ...current, bans: current.bans.filter((entry) => entry.id !== ban.id) }));
  };

  return (
    <>
      <div className="sheet__bar">
        <h2 id="bans-title" className="sheet__heading">
          <Icon name="ban" />
          {b.bansTitle}
        </h2>
        <div className="sheet__actions">
          <button type="button" className="icon-btn" onClick={onClose} aria-label={b.close} title={b.close} data-autofocus>
            <Icon name="close" />
          </button>
        </div>
      </div>
      <div className="sheet__body">
        {state.status === "loading" && (
          <ul className="bans" aria-busy="true">
            {[0, 1].map((n) => (
              <li key={n} className="bans__row">
                <span className="skel skel--avatar" />
                <div className="bans__who">
                  <span className="skel skel--line" style={{ width: "45%" }} />
                  <span className="skel skel--line" style={{ width: "70%" }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {state.status === "error" && <p className="thread__note">{b.actionFailed}</p>}
        {state.status === "ready" &&
          (state.bans.length ? (
            <ul className="bans">
              {state.bans.map((ban) => (
                <li key={ban.id} className="bans__row">
                  {ban.avatar ? (
                    <Image className="avatar" src={ban.avatar} alt="" width={36} height={36} unoptimized />
                  ) : (
                    <span className="avatar avatar--blank" style={{ width: 36, height: 36 }} aria-hidden="true">
                      {ban.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="bans__who">
                    <b>
                      {ban.name}
                      {ban.username && ban.username !== ban.name && <span className="who__user">@{ban.username}</span>}
                    </b>
                    <span>{fill(b.bannedOn, { date: day.format(ban.at), name: ban.by })}</span>
                  </div>
                  <button type="button" className="btn btn--sm" disabled={busy === ban.id} onClick={() => void unban(ban)}>
                    {b.unban}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="thread__empty">{b.bansEmpty}</p>
          ))}
      </div>
    </>
  );
}
