"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { fill, localeHref, localeInfo } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import type { Ban } from "@/lib/store";
import { useConfirm } from "../ConfirmDialog";
import { Icon } from "../Icon";
import { Modal } from "../Modal";

type Pending = { id: string; title: string; createdAt: number; author: string | null };
type Overview = { pending: Pending[] | null; bans: Ban[] | null; admins: string[] };
type Tab = "review" | "bans" | "admins";

const post = (url: string, body: object) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);

export function AdminPanel() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const changed = useRef(false);
  const close = useCallback(() => {
    setOpen(false);
    if (changed.current) window.location.reload();
  }, []);
  const leave = (event: MouseEvent<HTMLAnchorElement>) => {
    setOpen(false);
    if (!changed.current) return;
    event.preventDefault();
    window.location.assign(event.currentTarget.href);
  };

  return (
    <>
      <button type="button" className="btn btn--sm account-bar__admin" onClick={() => setOpen(true)}>
        <Icon name="shield" />
        {t.board.adminPanel}
      </button>
      <Modal open={open} onClose={close} labelledBy="admin-title" className="sheet--admin">
        <AdminBody
          onClose={close}
          onLeave={leave}
          onChange={() => {
            changed.current = true;
          }}
        />
      </Modal>
    </>
  );
}

function AdminBody({
  onClose,
  onLeave,
  onChange,
}: {
  onClose: () => void;
  onLeave: (event: MouseEvent<HTMLAnchorElement>) => void;
  onChange: () => void;
}) {
  const { locale, t } = useI18n();
  const b = t.board;
  const [ask, confirmDialog] = useConfirm();
  const [data, setData] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("review");
  const [busy, setBusy] = useState<string | null>(null);
  const day = useMemo(
    () => new Intl.DateTimeFormat(localeInfo[locale].intl, { day: "numeric", month: "short", year: "numeric" }),
    [locale],
  );

  useEffect(() => {
    let live = true;
    fetch("/api/admin/overview", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const overview = (await response.json()) as Overview;
        if (live) setData(overview);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const drop = (key: "pending" | "bans", id: string) =>
    setData((current) => current && { ...current, [key]: current[key]?.filter((entry) => entry.id !== id) ?? null });

  const approve = async (item: Pending) => {
    setBusy(item.id);
    const response = await post("/api/admin/feedback", { feedbackId: item.id, action: "status", status: "open" });
    setBusy(null);
    if (!response?.ok) return window.alert(b.actionFailed);
    drop("pending", item.id);
    onChange();
  };

  const reject = async (item: Pending) => {
    const ok = await ask({
      title: b.removeTitle,
      body: fill(b.confirmRemove, { title: item.title }),
      confirm: t.ideas.reject,
      cancel: b.cancel,
      icon: "trash",
      danger: true,
    });
    if (!ok) return;
    setBusy(item.id);
    const response = await post("/api/admin/feedback", { feedbackId: item.id, action: "delete" });
    setBusy(null);
    if (!response?.ok) return window.alert(b.actionFailed);
    drop("pending", item.id);
    onChange();
  };

  const unban = async (ban: Ban) => {
    setBusy(ban.id);
    const response = await post("/api/admin/bans", { action: "unban", user: { id: ban.id } });
    setBusy(null);
    if (!response?.ok) return window.alert(b.actionFailed);
    drop("bans", ban.id);
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "review", label: b.tabReview, count: data?.pending?.length },
    ...(data?.bans !== null ? [{ key: "bans" as const, label: b.bansOpen, count: data?.bans?.length }] : []),
    { key: "admins", label: b.tabAdmins, count: data?.admins.length },
  ];

  const skeleton = (
    <ul className="bans" aria-busy="true">
      {[0, 1, 2].map((n) => (
        <li key={n} className="bans__row">
          <span className="skel skel--avatar" />
          <div className="bans__who">
            <span className="skel skel--line" style={{ width: "55%" }} />
            <span className="skel skel--line" style={{ width: "35%" }} />
          </div>
        </li>
      ))}
    </ul>
  );

  const review = () => {
    if (data?.pending === null) return <p className="thread__note">{b.actionFailed}</p>;
    if (!data?.pending.length) return <p className="thread__empty">{b.reviewEmpty}</p>;
    return (
      <ul className="bans">
        {data.pending.map((item) => (
          <li key={item.id} className="bans__row admin-review">
            <span className="admin-review__icon" aria-hidden="true">
              <Icon name="clock" />
            </span>
            <div className="bans__who">
              <b>{item.title}</b>
              <span>{[item.author, day.format(item.createdAt)].filter(Boolean).join(" · ")}</span>
            </div>
            <div className="admin-review__actions">
              <button type="button" className="btn btn--sm" disabled={busy === item.id} onClick={() => void approve(item)}>
                <Icon name="check" />
                {t.ideas.approve}
              </button>
              <button
                type="button"
                className="btn btn--sm admin-review__reject"
                disabled={busy === item.id}
                onClick={() => void reject(item)}
              >
                <Icon name="close" />
                {t.ideas.reject}
              </button>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  const bans = () =>
    data?.bans?.length ? (
      <ul className="bans">
        {data.bans.map((ban) => (
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
    );

  const adminList = () => (
    <ul className="admin-names">
      {data?.admins.map((name) => (
        <li key={name}>
          <span className="avatar avatar--blank" style={{ width: 32, height: 32 }} aria-hidden="true">
            {name.slice(0, 1).toUpperCase()}
          </span>
          {name}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <div className="sheet__bar">
        <h2 id="admin-title" className="sheet__heading">
          <Icon name="shield" />
          {b.adminPanel}
        </h2>
        <div className="sheet__actions">
          <button type="button" className="icon-btn" onClick={onClose} aria-label={b.close} title={b.close} data-autofocus>
            <Icon name="close" />
          </button>
        </div>
      </div>
      <div className="admin-tabs" role="tablist" aria-label={b.adminPanel}>
        {tabs.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            id={`admin-tab-${entry.key}`}
            aria-selected={tab === entry.key}
            aria-controls="admin-panel"
            className={tab === entry.key ? "is-active" : undefined}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
            {entry.count !== undefined && <span className="panel__count">{entry.count}</span>}
          </button>
        ))}
      </div>
      <div className="sheet__body" role="tabpanel" id="admin-panel" aria-labelledby={`admin-tab-${tab}`}>
        {failed ? (
          <p className="thread__note">{b.actionFailed}</p>
        ) : !data ? (
          skeleton
        ) : tab === "review" ? (
          review()
        ) : tab === "bans" ? (
          bans()
        ) : (
          adminList()
        )}
        {tab === "review" && (
          <Link className="plan__more" href={localeHref(locale, "/ideas")} onClick={onLeave}>
            {b.openIdeas}
            <Icon name="right" />
          </Link>
        )}
      </div>
      {confirmDialog}
    </>
  );
}
