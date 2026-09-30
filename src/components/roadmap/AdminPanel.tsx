"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { fill, localeHref, localeInfo } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import {
  allPermissions,
  boardOf,
  can,
  eventRanges,
  itemPath,
  shownName,
  type ActivityEvent,
  type EventRange,
  type EventType,
  type Permission,
  type Viewer,
} from "@/lib/board";
import type { Block } from "@/lib/downloads";
import type { StaffMember } from "@/lib/staff";
import type { Ban } from "@/lib/store";
import { Avatar } from "../Avatar";
import { useConfirm } from "../ConfirmDialog";
import { Icon, type IconName } from "../Icon";
import { Modal } from "../Modal";

type Pending = { id: string; title: string; createdAt: number; author: string | null };
type Overview = { pending: Pending[] | null; bans: Ban[] | null; downloadBlocks?: Block[] | null; staff: StaffMember[] };
type Tab = "review" | "bans" | "admins" | "activity" | "api";
const tabIcons: Record<Tab, IconName> = { review: "clock", bans: "ban", admins: "shield", activity: "activity", api: "code" };

const post = (url: string, body: object) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);

export function AdminPanel({ viewer }: { viewer: Viewer }) {
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
      <button
        type="button"
        className="btn btn--sm account-bar__admin"
        onClick={() => setOpen(true)}
        aria-label={t.board.adminPanel}
        title={t.board.adminPanel}
      >
        <Icon name="shield" />
        <span className="account-bar__admin-label">{t.board.adminPanel}</span>
      </button>
      <Modal open={open} onClose={close} labelledBy="admin-title" className="sheet--admin">
        <AdminBody
          viewer={viewer}
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
  viewer,
  onClose,
  onLeave,
  onChange,
}: {
  viewer: Viewer;
  onClose: () => void;
  onLeave: (event: MouseEvent<HTMLAnchorElement>) => void;
  onChange: () => void;
}) {
  const { locale, t } = useI18n();
  const b = t.board;
  const a = t.admin;
  const [ask, confirmDialog] = useConfirm();
  const [data, setData] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>(can(viewer, "review") ? "review" : "admins");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);
  const day = useMemo(
    () => new Intl.DateTimeFormat(localeInfo[locale].intl, { day: "numeric", month: "short", year: "numeric" }),
    [locale],
  );
  const moment = useMemo(
    () => new Intl.DateTimeFormat(localeInfo[locale].intl, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
    [locale],
  );
  const gigabytes = useMemo(
    () => new Intl.NumberFormat(localeInfo[locale].intl, { style: "unit", unit: "gigabyte", maximumFractionDigits: 0 }),
    [locale],
  );

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/overview", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return false;
    setData((await response.json()) as Overview);
    return true;
  }, []);

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
    const response = await post("/api/admin/bans", { action: "unban", user: { id: ban.id, name: ban.name } });
    setBusy(null);
    if (!response?.ok) return window.alert(b.actionFailed);
    drop("bans", ban.id);
  };

  const unblock = async (block: Block) => {
    setBusy(block.account);
    const response = await post("/api/admin/downloads", { action: "unblock", account: block.account });
    setBusy(null);
    if (!response?.ok) return window.alert(b.actionFailed);
    setData((current) => current && { ...current, downloadBlocks: current.downloadBlocks?.filter((entry) => entry.account !== block.account) ?? null });
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    ...(can(viewer, "review") ? [{ key: "review" as const, label: b.tabReview, count: data?.pending?.length }] : []),
    ...(can(viewer, "bans") && data?.bans !== null ? [{ key: "bans" as const, label: b.bansOpen, count: data ? (data.bans?.length ?? 0) + (data.downloadBlocks?.length ?? 0) : undefined }] : []),
    { key: "admins", label: b.tabAdmins, count: data?.staff.length },
    ...(can(viewer, "activity") ? [{ key: "activity" as const, label: a.tabActivity }] : []),
    ...(can(viewer, "api") ? [{ key: "api" as const, label: a.tabApi }] : []),
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
              <span>{[item.author, day.format(item.createdAt)].filter(Boolean).join(" - ")}</span>
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

  // Download limits: players stopped from downloading the game for a day (lib/downloads.ts).
  const blocks = () =>
    data?.downloadBlocks?.length ? (
      <>
        <h3 className="bans__heading">{b.downloadBlocks}</h3>
        <ul className="bans">
          {data.downloadBlocks.map((block) => (
            <li key={block.account} className="bans__row">
              <span className="admin-review__icon" aria-hidden="true">
                <Icon name="clock" />
              </span>
              <div className="bans__who">
                <b>{block.name}</b>
                <span>{fill(b.downloadBlocked, { amount: gigabytes.format(block.bytes / 1e9), date: moment.format(block.until) })}</span>
              </div>
              <button type="button" className="btn btn--sm" disabled={busy === block.account} onClick={() => void unblock(block)}>
                {b.unblock}
              </button>
            </li>
          ))}
        </ul>
      </>
    ) : null;

  const bans = () =>
    data?.bans?.length ? (
      <ul className="bans">
        {data.bans.map((ban) => (
          <li key={ban.id} className="bans__row">
            <Avatar src={ban.avatar} size={36} />
            <div className="bans__who">
              <b>
                {shownName(ban.name, ban.username)}
                {ban.username && <span className="who__user">@{ban.username}</span>}
              </b>
              <span>{fill(b.bannedOn, { date: day.format(ban.at), name: ban.by })}</span>
              {ban.reason && <q className="bans__reason">{ban.reason}</q>}
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

  const staff = () => (
    <>
      {viewer.owner && (
        <button type="button" className="btn btn--sm staff__add" onClick={() => setEditing("new")}>
          <Icon name="plus" />
          {a.add}
        </button>
      )}
      <ul className="staff">
        {data?.staff.map((member) => (
          <li key={member.id} className="staff__card">
            <Avatar src={member.avatar} size={40} />
            <div className="staff__who">
              <span className="staff__name">
                <b>{shownName(member.name, member.username)}</b>
                {member.username && <span className="who__user">@{member.username}</span>}
              </span>
              <span className="staff__perms">
                {member.owner ? (
                  <span className="staff__owner">{a.owner}</span>
                ) : member.permissions.length ? (
                  member.permissions.map((permission) => <span key={permission}>{a.permissions[permission].label}</span>)
                ) : (
                  <span className="staff__none">{a.noPermissions}</span>
                )}
              </span>
            </div>
            {viewer.owner && !member.owner && (
              <button
                type="button"
                className="icon-btn staff__menu"
                onClick={() => setEditing(member)}
                aria-label={fill(a.options, { name: member.name })}
                title={fill(a.options, { name: member.name })}
              >
                <Icon name="more" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {viewer.owner && (
        <StaffDialog
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            onChange();
            await load();
          }}
        />
      )}
    </>
  );

  return (
    <>
      <div className="sheet__bar">
        <h2 id="admin-title" className="sheet__heading">
          <Icon name="shield" />
          {b.adminPanel}
        </h2>
        <div className="sheet__actions">
          <button type="button" className="icon-btn" onClick={onClose} aria-label={b.close} title={b.close}>
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
            <Icon name={tabIcons[entry.key]} />
            {entry.label}
            {entry.count !== undefined && <span className="panel__count">{entry.count}</span>}
          </button>
        ))}
      </div>
      <div className="sheet__body" role="tabpanel" id="admin-panel" aria-labelledby={`admin-tab-${tab}`}>
        {tab === "activity" ? (
          <ActivityLog />
        ) : tab === "api" ? (
          <ApiKeys />
        ) : failed ? (
          <p className="thread__note">{b.actionFailed}</p>
        ) : !data ? (
          skeleton
        ) : tab === "review" ? (
          review()
        ) : tab === "bans" ? (
          <>
            {bans()}
            {blocks()}
          </>
        ) : (
          staff()
        )}
        {tab === "review" && (
          <Link className="plan__more" href={localeHref(locale, "/bugs-and-ideas")} onClick={onLeave}>
            {b.openIdeas}
            <Icon name="right" />
          </Link>
        )}
      </div>
      {confirmDialog}
    </>
  );
}

// Owners: add an admin or change one's permissions, or remove them.
function StaffDialog({
  member,
  onClose,
  onSaved,
}: {
  member: StaffMember | "new" | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useI18n();
  const a = t.admin;
  const b = t.board;
  const [ask, confirmDialog] = useConfirm();
  const adding = member === "new";
  const current = member && member !== "new" ? member : null;
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Permission[]>(allPermissions);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<StaffMember | "new" | null>(null);

  // Starts from the admin being opened (or empty for a new one) each time the dialog opens.
  if (member !== shown) {
    setShown(member);
    setId(current?.id ?? "");
    setName(current?.name ?? "");
    setPicked(current ? current.permissions : allPermissions);
  }

  const toggle = (permission: Permission) =>
    setPicked((list) => (list.includes(permission) ? list.filter((entry) => entry !== permission) : [...list, permission]));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    const response = await post("/api/admin/staff", { action: "save", id: id.trim(), name: name.trim(), permissions: picked });
    setBusy(false);
    if (!response?.ok) return window.alert(b.actionFailed);
    await onSaved();
  };

  const remove = async () => {
    if (!current) return;
    const ok = await ask({
      title: fill(a.removeTitle, { name: current.name }),
      body: a.removeBody,
      confirm: a.remove,
      cancel: b.cancel,
      icon: "trash",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const response = await post("/api/admin/staff", { action: "remove", id: current.id, name: current.name });
    setBusy(false);
    if (!response?.ok) return window.alert(b.actionFailed);
    await onSaved();
  };

  return (
    <Modal open={member !== null} onClose={onClose} labelledBy="staff-title" className="sheet--narrow">
      <div className="sheet__bar">
        <h2 id="staff-title" className="sheet__heading">
          {current && <Avatar src={current.avatar} size={28} />}
          {current ? fill(a.manageTitle, { name: current.name }) : a.addTitle}
        </h2>
        <div className="sheet__actions">
          <button type="button" className="icon-btn" onClick={onClose} aria-label={b.close} title={b.close}>
            <Icon name="close" />
          </button>
        </div>
      </div>
      <div className="sheet__body">
        <form className="sheet-form staff-form" onSubmit={(event) => void save(event)}>
          {adding && (
            <>
              <label>
                <span>{a.discordId}</span>
                <input
                  value={id}
                  onChange={(event) => setId(event.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  pattern="\d{5,32}"
                  required
                  data-autofocus
                />
                <small>{a.discordIdHint}</small>
              </label>
              <label>
                <span>{a.name}</span>
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required />
              </label>
            </>
          )}
          <fieldset className="perm-list">
            {allPermissions.map((permission) => (
              <label key={permission} className="perm">
                <input type="checkbox" checked={picked.includes(permission)} onChange={() => toggle(permission)} />
                <span>
                  <b>{a.permissions[permission].label}</b>
                  <small>{a.permissions[permission].hint}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="sheet-form__actions">
            {current && (
              <button type="button" className="btn btn--sm staff__remove" disabled={busy} onClick={() => void remove()}>
                <Icon name="trash" />
                {a.remove}
              </button>
            )}
            <button type="submit" className="btn btn--sm btn--primary" disabled={busy}>
              <Icon name="check" />
              {adding ? a.add : a.save}
            </button>
          </div>
        </form>
      </div>
      {confirmDialog}
    </Modal>
  );
}

const eventIcon = (type: EventType): IconName =>
  type.startsWith("comment")
    ? "comment"
    : type.startsWith("staff")
      ? "shield"
      : type.startsWith("user")
        ? "ban"
        : type === "media.deleted"
          ? "attach"
          : type.startsWith("idea")
            ? "bulb"
            : "board";

// Everything that happened in the community: a period, a search, newest first.
function ActivityLog() {
  const { locale, t } = useI18n();
  const a = t.admin;
  const [range, setRange] = useState<EventRange>("7d");
  const [search, setSearch] = useState("");
  // now: when the list was fetched, for "5 minutes ago".
  const [result, setResult] = useState<{ events: ActivityEvent[]; total: number; now: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const intl = localeInfo[locale].intl;
  const ago = useMemo(() => new Intl.RelativeTimeFormat(intl, { numeric: "auto" }), [intl]);
  const date = useMemo(() => new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), [intl]);

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/admin/events?range=${range}&q=${encodeURIComponent(search.trim())}`, { cache: "no-store" }).catch(
        () => null,
      );
      if (!live) return;
      if (!response?.ok) return setFailed(true);
      setFailed(false);
      const found = (await response.json()) as { events: ActivityEvent[]; total: number };
      setResult({ ...found, now: Date.now() });
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [range, search]);

  const when = (at: number, now: number) => {
    const minutes = Math.round((now - at) / 60000);
    if (minutes < 60) return ago.format(-minutes, "minute");
    if (minutes < 24 * 60) return ago.format(-Math.round(minutes / 60), "hour");
    return date.format(at);
  };

  const sentence = (event: ActivityEvent) => {
    const parts: Record<string, ReactNode> = {
      actor: <b>{event.actor.name}</b>,
      user: <b>{event.user?.name ?? "?"}</b>,
      to: <b>{event.to ? t.board.status[event.to] : ""}</b>,
      item: event.item ? (
        event.type.endsWith(".deleted") && !event.type.startsWith("comment") && !event.type.startsWith("media") ? (
          <b>{event.item.title}</b>
        ) : (
          <Link href={itemPath(localeHref(locale, boardOf(event.item.status ?? "open")), event.item)}>{event.item.title}</Link>
        )
      ) : (
        <b>?</b>
      ),
    };
    return a.events[event.type].split(/(\{\w+\})/).map((piece, i) => {
      const key = piece.match(/^\{(\w+)\}$/)?.[1];
      return key && key in parts ? <span key={i}>{parts[key]}</span> : piece;
    });
  };

  return (
    <div className="activity">
      <div className="activity__filters">
        <label className="activity__search">
          <Icon name="search" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={a.search} aria-label={a.search} />
        </label>
        <div className="ideas__sort" role="group" aria-label={a.tabActivity}>
          {eventRanges.map((key) => (
            <button key={key} type="button" className={range === key ? "is-active" : undefined} aria-pressed={range === key} onClick={() => setRange(key)}>
              {a.ranges[key]}
            </button>
          ))}
        </div>
      </div>
      {failed ? (
        <p className="thread__note">{t.board.actionFailed}</p>
      ) : !result ? (
        <p className="thread__empty" aria-busy="true">
          …
        </p>
      ) : !result.events.length ? (
        <p className="thread__empty">{a.empty}</p>
      ) : (
        <>
          <ul className="activity__list">
            {result.events.map((event) => (
              <li key={event.id} className={`activity__row activity__row--${event.type.replace(".", "-")}`}>
                <span className="activity__icon" aria-hidden="true">
                  <Icon name={eventIcon(event.type)} />
                </span>
                <div className="activity__main">
                  <p>{sentence(event)}</p>
                  {event.via && (
                    <span className="activity__via">
                      <Icon name="code" />
                      {fill(a.apiVia, { name: event.via })}
                    </span>
                  )}
                  {event.text && <blockquote>{event.text}</blockquote>}
                  {event.permissions && (
                    <span className="staff__perms">
                      {event.permissions.length ? (
                        event.permissions.map((permission) => <span key={permission}>{a.permissions[permission].label}</span>)
                      ) : (
                        <span className="staff__none">{a.noPermissions}</span>
                      )}
                    </span>
                  )}
                </div>
                <time dateTime={new Date(event.at).toISOString()}>{when(event.at, result.now)}</time>
              </li>
            ))}
          </ul>
          {result.total > result.events.length && (
            <p className="activity__more">{fill(a.more, { shown: String(result.events.length), total: String(result.total) })}</p>
          )}
        </>
      )}
    </div>
  );
}

type ApiKey = { id: string; name: string; createdAt: number; lastUsedAt: number | null };

// What an admin pastes to their agent after saving a key (step 3 of the API tab). English: agents
// read the English docs it points to (sp-docs/CLAUDE.md section 10, sp-docs/docs/ROADMAP-API.md).
const agentPrompt =
  "Save this to your permanent memory (for Claude Code: my user memory, ~/.claude/CLAUDE.md), so it applies to every SUPER PEOPLE repo: " +
  "at the end of each task, once its pull request is open, record what it did on the superpeople.dev roadmap. " +
  "Follow sp-docs/CLAUDE.md section 10 and sp-docs/docs/ROADMAP-API.md (sp-docs is next to the other repos): " +
  "use `node sp-docs/tools/roadmap.mjs` to find the matching item and mark it done with the PR link, or add a new completed task if it's not there. " +
  "Only use the documented /api/dev endpoints. Never print, commit or ask for the API key. If no key is set up, skip it and tell me. " +
  "Now check that my key works: `node sp-docs/tools/roadmap.mjs whoami`.";

type System = "windows" | "unix";

// A command in pieces, each coloured by what it is (CSS .tok--*); joined, they are the command.
type Token = [kind: "cmd" | "param" | "str" | "var" | "num" | "op" | "path" | "key" | "plain", text: string];

// Pasted in a terminal on the PC where the agents run: saves the key where sp-docs/tools/roadmap.mjs
// looks for it (~/.sp-roadmap-key; on Linux and macOS readable by that user only).
const saveTokens = (system: System, key: string): Token[] =>
  system === "windows"
    ? [
        ["cmd", "Set-Content"], ["plain", " "], ["param", "-Path"], ["plain", " "],
        ["str", '"'], ["var", "$env:USERPROFILE"], ["str", '\\.sp-roadmap-key"'], ["plain", " "],
        ["param", "-Value"], ["plain", " "], ["str", '"'], ["key", key], ["str", '"'], ["plain", " "],
        ["param", "-NoNewline"],
      ]
    : [
        ["op", "("], ["cmd", "umask"], ["plain", " "], ["num", "077"], ["plain", " "], ["op", "&&"], ["plain", " "],
        ["cmd", "printf"], ["plain", " "], ["str", "'%s\\n'"], ["plain", " "], ["str", "'"], ["key", key], ["str", "'"], ["plain", " "],
        ["op", ">"], ["plain", " "], ["path", "~/.sp-roadmap-key"], ["op", ")"],
      ];

const textOf = (tokens: Token[]) => tokens.map(([, text]) => text).join("");
const colored = (tokens: Token[]) =>
  tokens.map(([kind, text], i) => (kind === "plain" ? text : <span key={i} className={`tok tok--${kind}`}>{text}</span>));
// The agent's text: its `commands` coloured, the rest plain.
const withCode = (text: string) =>
  text.split(/(`[^`]+`)/).map((part, i) => (part.startsWith("`") ? <span key={i} className="tok tok--cmd">{part}</span> : part));

// The admin's own API keys for the developer API (lib/apikeys.ts), set up in three steps: name a key,
// save it on the PC where the agents run (a command with the key in it: the key is shown only then),
// and paste a text to the agent so it records every pull request on the roadmap. Below, their keys,
// each can be revoked.
function ApiKeys() {
  const { locale, t } = useI18n();
  const a = t.admin;
  const b = t.board;
  const [ask, confirmDialog] = useConfirm();
  const [data, setData] = useState<{ keys: ApiKey[]; allowed: boolean; max: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null);
  // What was copied from the steps: the save command, the key alone, the agent's text.
  const [copied, setCopied] = useState<Set<string>>(() => new Set());
  const [system, setSystem] = useState<System>(() => (typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent) ? "windows" : "unix"));
  const [problem, setProblem] = useState<string | null>(null);
  const day = useMemo(() => new Intl.DateTimeFormat(localeInfo[locale].intl, { day: "numeric", month: "short", year: "numeric" }), [locale]);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/keys", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const found = (await response.json()) as { keys: ApiKey[]; allowed: boolean; max: number };
        if (live) setData(found);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    const response = await post("/api/admin/keys", { action: "create", name });
    setBusy(false);
    const answer = response ? ((await response.json().catch(() => ({}))) as { key?: string; view?: ApiKey; error?: string }) : {};
    if (!response?.ok || !answer.key || !answer.view) {
      return setProblem(answer.error === "role" ? a.apiRole : answer.error === "limit" ? fill(a.apiLimit, { max: String(data?.max ?? 10) }) : b.actionFailed);
    }
    const view = answer.view;
    setCreated({ key: answer.key, name: view.name });
    setCopied(new Set());
    setName("");
    setData((current) => current && { ...current, keys: [view, ...current.keys] });
  };

  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text).catch(() => null);
    setCopied((current) => new Set(current).add(id));
  };


  const revoke = async (key: ApiKey) => {
    const ok = await ask({
      title: fill(a.apiRevokeTitle, { name: key.name }),
      body: a.apiRevokeBody,
      confirm: a.apiRevoke,
      cancel: b.cancel,
      icon: "trash",
      danger: true,
    });
    if (!ok) return;
    const response = await post("/api/admin/keys", { action: "revoke", id: key.id });
    if (!response?.ok) return window.alert(b.actionFailed);
    setData((current) => current && { ...current, keys: current.keys.filter((entry) => entry.id !== key.id) });
    if (created?.name === key.name) setCreated(null);
  };

  if (failed) return <p className="thread__note">{b.actionFailed}</p>;
  if (!data) return <p className="thread__empty" aria-busy="true">…</p>;

  const saved = copied.has("command") || copied.has("key");
  const stepClass = (state: "waiting" | "active" | "done") => `apisteps__step is-${state}`;
  const copyButton = (id: string, text: string, primary = false) => (
    <button type="button" className={`btn btn--sm${primary && !copied.has(id) ? " btn--primary" : ""}`} onClick={() => void copy(id, text)}>
      <Icon name={copied.has(id) ? "check" : "code"} />
      {copied.has(id) ? a.apiCopied : a.apiCopy}
    </button>
  );

  return (
    <div className="apikeys">
      <p className="apikeys__lead">
        {a.apiLead}{" "}
        <a href="https://github.com/superpeople-dev/sp-docs/blob/main/docs/ROADMAP-API.md" target="_blank" rel="noopener noreferrer">
          {a.apiDocs}
        </a>
      </p>
      {data.allowed ? (
        <ol className="apisteps">
          <li className={stepClass(created ? "done" : "active")}>
            <span className="apisteps__num" aria-hidden="true">
              {created ? <Icon name="check" /> : 1}
            </span>
            <div className="apisteps__body">
              <h3>{a.apiStep1}</h3>
              {created ? (
                <p className="apisteps__hint">{fill(a.apiStep1Done, { name: created.name })}</p>
              ) : (
                <>
                  <p className="apisteps__hint">{a.apiStep1Hint}</p>
                  <form className="apikeys__form" onSubmit={(event) => void create(event)}>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={40}
                      placeholder={a.apiNamePlaceholder}
                      aria-label={a.apiName}
                      required
                    />
                    <button type="submit" className="btn btn--sm btn--primary" disabled={busy || !name.trim()}>
                      <Icon name="plus" />
                      {a.apiCreate}
                    </button>
                  </form>
                  {problem && <p className="thread__note">{problem}</p>}
                </>
              )}
            </div>
          </li>
          <li className={stepClass(!created ? "waiting" : saved ? "done" : "active")}>
            <span className="apisteps__num" aria-hidden="true">
              {created && saved ? <Icon name="check" /> : 2}
            </span>
            <div className="apisteps__body">
              <h3>{a.apiStep2}</h3>
              {created && (
                <>
                  <p className="apisteps__hint">{a.apiStep2Hint}</p>
                  <div className="ideas__sort apisteps__system" role="group" aria-label={a.apiStep2}>
                    {(["windows", "unix"] as const).map((key) => (
                      <button key={key} type="button" className={system === key ? "is-active" : undefined} aria-pressed={system === key} onClick={() => setSystem(key)}>
                        <Icon name={key === "windows" ? "windows" : "linux"} />
                        {key === "windows" ? a.apiWindows : a.apiUnix}
                      </button>
                    ))}
                  </div>
                  <div className="apikeys__secret">
                    <code>{colored(saveTokens(system, created.key))}</code>
                    {copyButton("command", textOf(saveTokens(system, created.key)), true)}
                  </div>
                  <button type="button" className="apisteps__keyonly" onClick={() => void copy("key", created.key)}>
                    {copied.has("key") ? a.apiCopied : a.apiCopyKey}
                  </button>
                </>
              )}
            </div>
          </li>
          <li className={stepClass(!created || !saved ? "waiting" : copied.has("agent") ? "done" : "active")}>
            <span className="apisteps__num" aria-hidden="true">
              {created && copied.has("agent") ? <Icon name="check" /> : 3}
            </span>
            <div className="apisteps__body">
              <h3>{a.apiStep3}</h3>
              {created && saved && (
                <>
                  <p className="apisteps__hint">{a.apiStep3Hint}</p>
                  <div className="apikeys__secret apisteps__agent">
                    <code>{withCode(agentPrompt)}</code>
                    {copyButton("agent", agentPrompt, saved)}
                  </div>
                  <div className="apisteps__actions">
                    <button type="button" className={`btn btn--sm${copied.has("agent") ? " btn--primary" : ""}`} onClick={() => setCreated(null)}>
                      <Icon name="check" />
                      {a.apiDone}
                    </button>
                  </div>
                </>
              )}
            </div>
          </li>
        </ol>
      ) : (
        <p className="thread__note">{a.apiRole}</p>
      )}
      {data.keys.length ? (
        <ul className="bans apikeys__list">
          {data.keys.map((key) => (
            <li key={key.id} className="bans__row">
              <span className="activity__icon" aria-hidden="true">
                <Icon name="lock" />
              </span>
              <div className="bans__who">
                <b>{key.name}</b>
                <span>
                  {fill(a.apiCreated, { date: day.format(key.createdAt) })} - {key.lastUsedAt ? fill(a.apiUsed, { date: day.format(key.lastUsedAt) }) : a.apiNeverUsed}
                </span>
              </div>
              <button type="button" className="btn btn--sm admin-review__reject" onClick={() => void revoke(key)}>
                {a.apiRevoke}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="thread__empty">{a.apiEmpty}</p>
      )}
      {confirmDialog}
    </div>
  );
}
