"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import type { FeedbackItem } from "reflet-sdk";
import { fill, localeInfo } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import type { IdeaType } from "@/i18n/types";
import {
  can,
  categoryOf,
  doneAt,
  shownName,
  typeOf,
  type Author,
  type Category,
  type CommentView,
  type MediaView,
  type TypeTag,
  type Viewer,
  type VoteDirection,
  type Mention,
} from "@/lib/board";
import { mentionPattern } from "@/lib/mentions";
import { ideaLimits, ideaTypes, mediaLimits } from "@/lib/site";
import logo from "@/assets/sp-logo.png";
import { Avatar } from "../Avatar";
import { useConfirm } from "../ConfirmDialog";
import { Dropdown } from "../Dropdown";
import { Icon, type IconName } from "../Icon";
import { Modal } from "../Modal";
import { Toast } from "../Toast";
import type { EditValues, useAdmin } from "./admin";
import { CategoryTag, platformName } from "./CategoryTag";
import { FieldCount } from "./FieldCount";
import { ItemMenu } from "./ItemMenu";
import { MediaThumb, pickFiles, uploadMedia } from "./media";
import { pageUrl } from "./useItemUrl";
import { VoteControl } from "./VoteControl";
import { loginHref, signIn } from "./viewer";

export type Opened = { id: string; mode: "view" | "edit" };

type Thread = {
  status: "loading" | "ready" | "error";
  comments: CommentView[];
  author: Author | null;
  media: MediaView[];
  // Comments turned off by an admin: only admins who moderate comments can still post.
  off: boolean;
  // Who the item is assigned to (null: the whole team), and the admins it can be assigned to (only
  // for an admin who manages items).
  assignee: Author | null;
  staff: Author[] | null;
  // Who the viewer can @mention here (signed in only): the author, the commenters, the admins.
  mentions: Mention[];
};

// A comment's text with its @mentions highlighted.
function withMentions(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(mentionPattern)) {
    const at = (match.index ?? 0) + match[1].length;
    parts.push(text.slice(last, at), <span key={at} className="mention">@{match[2]}</span>);
    last = at + 1 + match[2].length;
  }
  parts.push(text.slice(last));
  return parts;
}

// The items on the roadmap have someone who works on them.
const roadmapStatuses: FeedbackItem["status"][] = ["planned", "in_progress", "completed"];

// The whole team, where an item isn't assigned to one admin: the logo in place of an avatar.
function TeamMark({ size = 28 }: { size?: number }) {
  return (
    <span className="team-mark" style={{ width: size, height: size }}>
      <Image src={logo} alt="" style={{ width: Math.round(size * 0.64), height: "auto" }} />
    </span>
  );
}

type Props = {
  item: FeedbackItem | null;
  mode: Opened["mode"];
  onMode: (mode: Opened["mode"]) => void;
  onClose: () => void;
  categories: Category[];
  types: TypeTag[];
  viewer: Viewer | null;
  authReady: boolean;
  next: string;
  admin: ReturnType<typeof useAdmin>;
  onPatch: (id: string, change: Partial<FeedbackItem>) => void;
  vote?: (item: FeedbackItem, direction: VoteDirection) => void;
  removeLabel?: string;
};

const iconOf = (slug: IdeaType) => ideaTypes.find((type) => type.slug === slug)?.icon ?? "sparkle";
const countAll = (comments: CommentView[]): number => comments.reduce((sum, c) => sum + 1 + countAll(c.replies), 0);
const prune = (comments: CommentView[], id: string): CommentView[] =>
  comments.filter((c) => c.id !== id).map((c) => ({ ...c, replies: prune(c.replies, id) }));

export function ItemDialog(props: Props) {
  return (
    <Modal open={props.item !== null} onClose={props.onClose} labelledBy="sheet-title">
      {props.item && <ItemBody key={props.item.id} {...props} item={props.item} />}
    </Modal>
  );
}

// The name and @username to show, like "Gigeop @gigeop".
function names(author: Pick<Author, "name" | "username">) {
  return { name: shownName(author.name, author.username), user: author.username || null };
}

// The item's link (the page with ?item=<id>): the phone's share sheet on touch screens, copied on desktop.
function ShareButton({ item }: { item: FeedbackItem }) {
  const { t } = useI18n();
  const b = t.board;
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = pageUrl();
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: item.title, url }).catch(() => null);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(b.shareItem, url);
    }
  };
  return (
    <>
      <button
        type="button"
        className={`share-btn${copied ? " is-copied" : ""}`}
        onClick={() => void share()}
        aria-label={b.shareItem}
        title={b.shareItem}
      >
        <Icon name={copied ? "check" : "share"} />
        <span>{b.shareItem}</span>
      </button>
      <Toast show={copied}>{b.linkCopied}</Toast>
    </>
  );
}

function ItemBody({
  item,
  mode,
  onMode,
  onClose,
  categories,
  types,
  viewer,
  authReady,
  next,
  admin,
  onPatch,
  vote,
  removeLabel,
}: Props & { item: FeedbackItem }) {
  const { locale, t } = useI18n();
  const b = t.board;
  const r = t.ideas;
  const [ask, confirmDialog, askReason] = useConfirm();
  const [thread, setThread] = useState<Thread>({ status: "loading", comments: [], author: null, media: [], off: false, assignee: null, staff: null, mentions: [] });
  const [notice, setNotice] = useState({ show: false, text: "", icon: "check" as IconName });
  const [viewing, setViewing] = useState<MediaView | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [bannedIds, setBannedIds] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // Why the last comment wasn't posted.
  const [failed, setFailed] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(viewer?.banned ?? false);

  const format = useMemo(() => {
    const intl = localeInfo[locale].intl;
    return {
      day: new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric" }),
      stamp: new Intl.DateTimeFormat(intl, { dateStyle: "medium", timeStyle: "short" }),
    };
  }, [locale]);

  useEffect(() => {
    let live = true;
    fetch(`/api/roadmap/comments?feedbackId=${encodeURIComponent(item.id)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as {
          comments: CommentView[];
          author: Author | null;
          media?: MediaView[];
          off?: boolean;
          assignee?: Author | null;
          staff?: Author[];
          mentions?: Mention[];
        };
        if (!live) return;
        setThread({
          status: "ready",
          comments: data.comments,
          author: data.author,
          media: data.media ?? [],
          off: data.off === true,
          assignee: data.assignee ?? null,
          staff: data.staff ?? null,
          mentions: data.mentions ?? [],
        });
      })
      .catch(() => {
        if (live) setThread((current) => ({ ...current, status: "error" }));
      });
    return () => {
      live = false;
    };
  }, [item.id, attempt]);

  const flash = (text: string, icon: IconName = "check") => {
    setNotice({ show: true, text, icon });
    window.setTimeout(() => setNotice((current) => ({ ...current, show: false })), 2200);
  };

  const switchComments = async () => {
    const off = !thread.off;
    try {
      const response = await fetch("/api/roadmap/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId: item.id, off }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setThread((current) => ({ ...current, off }));
      flash(off ? b.commentsOffDone : b.commentsOnDone, off ? "lock" : "comment");
    } catch {
      flash(b.actionFailed, "close");
    }
  };

  const assign = async (id: string | null) => {
    const before = thread.assignee;
    const next = id ? (thread.staff?.find((member) => member.id === id) ?? null) : null;
    setThread((current) => ({ ...current, assignee: next }));
    try {
      const response = await fetch("/api/admin/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", feedbackId: item.id, assignee: id }),
      });
      if (!response.ok) throw new Error(String(response.status));
      flash(fill(b.toastAssigned, { name: next?.name ?? b.assignTeam }));
    } catch {
      setThread((current) => ({ ...current, assignee: before }));
      flash(b.actionFailed, "close");
    }
  };

  const retry = () => {
    setThread((current) => ({ ...current, status: "loading" }));
    setAttempt((n) => n + 1);
  };
  // Reads the comments and files again without the loading state (after new files were uploaded).
  const reload = () => setAttempt((n) => n + 1);

  const type = typeOf(item, types);
  const category = categoryOf(item, categories);
  const canManage = can(viewer, "manage");
  const canModerate = can(viewer, "comments");
  const inReview = item.status === "under_review";
  const count = thread.status === "ready" ? countAll(thread.comments) : item.commentCount;

  const canBan = (author: Author | null): author is Author & { id: string } =>
    Boolean(viewer?.canBan && author?.id && author.id !== viewer.id && !author.admin);

  const banAuthor = async (author: Author & { id: string }) => {
    const name = names(author).name;
    const reason = await askReason({
      title: fill(b.banTitle, { name }),
      body: b.banBody,
      confirm: b.banYes,
      cancel: b.cancel,
      icon: "ban",
      danger: true,
      reason: { label: b.banReason, placeholder: b.banReasonHint },
    });
    if (!reason) return;
    const response = await fetch("/api/admin/bans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ban", user: { ...author, name }, reason }),
    }).catch(() => null);
    if (!response?.ok) return window.alert(b.actionFailed);
    setBannedIds((ids) => [...ids, author.id]);
  };

  const removeComment = async (comment: CommentView) => {
    const ok = await ask({
      title: b.deleteCommentTitle,
      body: b.deleteCommentBody,
      confirm: b.deleteComment,
      cancel: b.cancel,
      icon: "trash",
      danger: true,
    });
    if (!ok) return;
    const response = await fetch("/api/roadmap/comments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedbackId: item.id, commentId: comment.id }),
    }).catch(() => null);
    if (!response?.ok) return window.alert(b.actionFailed);
    setThread((current) => ({ ...current, comments: prune(current.comments, comment.id) }));
    onPatch(item.id, { commentCount: Math.max(0, item.commentCount - 1 - countAll(comment.replies)) });
  };

  // @mentions: the word being typed at the caret after an @, and the people it matches.
  const textarea = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const [typing, setTyping] = useState<{ start: number; query: string } | null>(null);
  const [pick, setPick] = useState(0);
  const findMention = (field: HTMLTextAreaElement) => {
    const before = field.value.slice(0, field.selectionStart);
    const match = before.match(/(^|[^\w@.])@([a-z0-9_.]{0,32})$/i);
    setTyping(match ? { start: before.length - match[2].length - 1, query: match[2].toLowerCase() } : null);
    setPick(0);
  };
  const self = viewer?.username.toLowerCase();
  // Whose username or name starts with what is typed first, then whose name has it anywhere.
  const rank = (person: Mention, query: string) =>
    person.username.startsWith(query) || person.name.toLowerCase().startsWith(query) ? 0 : person.name.toLowerCase().includes(query) ? 1 : 2;
  const suggestions = typing
    ? thread.mentions
        .filter((person) => person.username !== self && rank(person, typing.query) < 2)
        .sort((a, b) => rank(a, typing.query) - rank(b, typing.query))
        .slice(0, 6)
    : [];
  const mention = (person: Mention) => {
    const field = textarea.current;
    if (!field || !typing) return;
    const text = `${draft.slice(0, typing.start)}@${person.username} ${draft.slice(field.selectionStart)}`;
    const caret = typing.start + person.username.length + 2;
    setDraft(text);
    setTyping(null);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(caret, caret);
    });
  };
  const onComposerKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setPick((n) => (n + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        mention(suggestions[Math.min(pick, suggestions.length - 1)]);
        return;
      }
      if (e.key === "Escape") {
        // Only the list closes, not the dialog (Modal listens on the document).
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        setTyping(null);
        return;
      }
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
  };

  const post = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (sending || !body) return;
    setSending(true);
    setFailed(null);
    try {
      const response = await fetch("/api/roadmap/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId: item.id, body }),
      });
      if (response.status === 401) return signIn(next);
      if (response.status === 403) {
        const { error } = (await response.json().catch(() => ({}))) as { error?: string };
        if (error === "off") return setThread((current) => ({ ...current, off: true }));
        if (error === "name") return setFailed(b.nameBlocked);
        return setBlocked(true);
      }
      if (response.status === 422) return setFailed(b.offensiveText);
      if (!response.ok) throw new Error(String(response.status));
      const { comment } = (await response.json()) as { comment: CommentView };
      setThread((current) => ({ ...current, comments: [...current.comments, comment] }));
      setDraft("");
      onPatch(item.id, { commentCount: item.commentCount + 1 });
    } catch {
      setFailed(b.commentFailed);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!viewing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setViewing(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewing]);

  const removeMedia = async (file: MediaView) => {
    const ok = await ask({
      title: b.deleteMediaTitle,
      body: b.deleteMediaBody,
      confirm: b.deleteMedia,
      cancel: b.cancel,
      icon: "trash",
      danger: true,
    });
    if (!ok) return;
    const response = await fetch("/api/admin/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId: file.id, feedbackId: item.id }),
    }).catch(() => null);
    if (!response?.ok) return flash(b.actionFailed, "close");
    setThread((current) => ({ ...current, media: current.media.filter((entry) => entry.id !== file.id) }));
    flash(b.toastDeleted, "trash");
  };

  // A banned person keeps their name, struck through and followed by "(banned)", with Discord's
  // default picture instead of theirs.
  const isBanned = (author: Author | null) => Boolean(author?.banned || (author?.id && bannedIds.includes(author.id)));
  const banned = ({ name, user }: { name: string; user?: string | null }) => (
    <>
      <b className="is-banned">
        <s>{name}</s>
      </b>
      {user && <span className="who__user">@{user}</span>}
      <span className="who__banned-tag">({t.admin.banned})</span>
    </>
  );

  const who = (author: Author | null) => {
    if (!author) return <span className="who__team">{b.team}</span>;
    const { name, user } = names(author);
    if (isBanned(author)) {
      return (
        <span className="who">
          <Avatar src={author.avatar} size={28} blank />
          {banned({ name, user })}
        </span>
      );
    }
    return (
      <span className="who">
        <Avatar src={author.avatar} size={28} />
        <b>{name}</b>
        {user && <span className="who__user">@{user}</span>}
        {author.admin && <span className="who__badge">{b.admin}</span>}
      </span>
    );
  };

  const banControl = (author: Author | null) => {
    if (!canBan(author)) return null;
    if (bannedIds.includes(author.id)) return <span className="who__banned">{b.banned}</span>;
    return (
      <button type="button" className="icon-btn icon-btn--danger" onClick={() => void banAuthor(author)} aria-label={b.ban} title={b.ban}>
        <Icon name="ban" />
      </button>
    );
  };

  const commentAuthor = (comment: CommentView) => (comment.author ? names(comment.author) : null);

  const renderComment = (comment: CommentView) => (
    <li key={comment.id} className="comment">
      <Avatar src={comment.author?.avatar} size={36} blank={isBanned(comment.author)} />
      <div className="comment__main">
        <div className="comment__head">
          {isBanned(comment.author) ? (
            banned(commentAuthor(comment) ?? { name: "" })
          ) : (
            <>
              <b>{commentAuthor(comment)?.name ?? b.team}</b>
              {commentAuthor(comment)?.user && <span className="comment__user">@{commentAuthor(comment)?.user}</span>}
              {comment.author?.admin && <span className="who__badge">{b.admin}</span>}
            </>
          )}
          <time dateTime={new Date(comment.createdAt).toISOString()}>{format.stamp.format(comment.createdAt)}</time>
          {(comment.mine || canModerate || viewer?.canBan) && (
            <span className="comment__tools">
              {banControl(comment.author)}
              {(comment.mine || canModerate) && (
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => void removeComment(comment)}
                  aria-label={b.deleteComment}
                  title={b.deleteComment}
                >
                  <Icon name="trash" />
                </button>
              )}
            </span>
          )}
        </div>
        <p className="comment__body">{withMentions(comment.body)}</p>
        {comment.replies.length > 0 && <ul className="comment__replies">{comment.replies.map(renderComment)}</ul>}
      </div>
    </li>
  );

  const onRoadmap = roadmapStatuses.includes(item.status);
  // Who is assigned: an admin (without the admin badge: they all are), or the whole team.
  const assigneeView = (assignee: Author | null) =>
    assignee ? (
      who({ ...assignee, admin: false })
    ) : (
      <span className="who">
        <TeamMark />
        <b>{b.assignTeam}</b>
      </span>
    );
  const assigned =
    thread.status === "loading" ? (
      <span className="skel skel--who" aria-hidden="true" />
    ) : canManage && thread.staff ? (
      <Dropdown
        label={b.assignedTo}
        buttonLabel={`${b.assignedTo}: ${thread.assignee?.name ?? b.assignTeam}`}
        options={[
          { key: "team", label: b.assignTeam, media: <TeamMark size={22} /> },
          ...thread.staff.map((member) => ({ key: member.id ?? member.name, label: member.name, media: <Avatar src={member.avatar} size={22} /> })),
        ]}
        value={thread.assignee?.id ?? "team"}
        onChange={(key) => void assign(key === "team" ? null : key)}
        className="assignee"
        buttonClass="assignee__btn"
      >
        {assigneeView(thread.assignee)}
        <Icon name="chevron" className="assignee__chevron" />
      </Dropdown>
    ) : (
      assigneeView(thread.assignee)
    );

  const facts = (
    <dl className="sheet__facts">
      <div className={`sheet__fact ${onRoadmap ? "sheet__fact--half" : "sheet__fact--wide"}`}>
        <dt>{b.postedBy}</dt>
        <dd>
          {thread.status === "loading" ? (
            <span className="skel skel--who" aria-hidden="true" />
          ) : (
            <span className="sheet__author">
              {who(thread.author ?? (item.author?.name ? { name: item.author.name, avatar: item.author.avatar } : null))}
              {banControl(thread.author)}
            </span>
          )}
        </dd>
      </div>
      {onRoadmap && (
        <div className="sheet__fact sheet__fact--half">
          <dt>{b.assignedTo}</dt>
          <dd>{assigned}</dd>
        </div>
      )}
      <div className="sheet__fact">
        <dt>{b.posted}</dt>
        <dd>
          <time dateTime={new Date(item.createdAt).toISOString()}>{format.day.format(item.createdAt)}</time>
        </dd>
      </div>
      <div className="sheet__fact">
        <dt>{b.updated}</dt>
        <dd>
          <time dateTime={new Date(item.updatedAt).toISOString()}>{format.day.format(item.updatedAt)}</time>
        </dd>
      </div>
      {item.status === "completed" && (
        <div className="sheet__fact">
          <dt>{b.completedAt}</dt>
          <dd>
            <time dateTime={new Date(doneAt(item)).toISOString()}>{format.day.format(doneAt(item))}</time>
          </dd>
        </div>
      )}
    </dl>
  );

  const votes =
    item.status === "completed" ? null : vote && !inReview ? (
      <VoteControl
        item={item}
        onVote={(direction) => vote(item, direction)}
        disabled={!authReady || viewer?.banned}
      />
    ) : (
      <span className="sheet__votes" title={b.votes}>
        <Icon name="up" />
        {item.voteCount}
      </span>
    );

  const composer = () => {
    if (!authReady) return null;
    const closed = thread.off && (
      <p className="thread__closed" role="status">
        <Icon name="lock" />
        {canModerate ? b.commentsOffAdmin : b.commentsOffNotice}
      </p>
    );
    if (closed && !canModerate) return closed;
    if (!viewer) {
      return (
        <div className="thread__signin">
          <p>{b.commentSignIn}</p>
          <a className="btn btn--discord btn--sm" href={loginHref(next)}>
            <Icon name="discord" />
            {b.signIn}
          </a>
        </div>
      );
    }
    if (blocked) {
      return (
        <p className="thread__banned" role="status">
          <Icon name="ban" />
          {b.bannedNotice}
        </p>
      );
    }
    if (viewer.nameBlocked) {
      return (
        <p className="thread__banned" role="status">
          <Icon name="ban" />
          {b.nameBlocked}
        </p>
      );
    }
    return (
      <>
        {closed}
        <form className="composer" onSubmit={(e) => void post(e)}>
          <Avatar src={viewer.avatar} size={36} />
          <div className="composer__main">
            <div className="composer__field">
              <textarea
                ref={textarea}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  findMention(e.target);
                }}
                onKeyDown={onComposerKey}
                onKeyUp={(e) => {
                  if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) findMention(e.currentTarget);
                }}
                onClick={(e) => findMention(e.currentTarget)}
                onBlur={() => setTyping(null)}
                placeholder={b.commentPlaceholder}
                aria-label={b.commentPlaceholder}
                aria-autocomplete="list"
                aria-controls={suggestions.length ? listId : undefined}
                aria-activedescendant={suggestions.length ? `${listId}-${Math.min(pick, suggestions.length - 1)}` : undefined}
                rows={3}
                maxLength={ideaLimits.comment}
                required
              />
              {suggestions.length > 0 && (
                <ul id={listId} className="mention-list" role="listbox" aria-label={b.mentionList}>
                  {suggestions.map((person, i) => (
                    <li
                      key={person.username}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === Math.min(pick, suggestions.length - 1)}
                      className={i === Math.min(pick, suggestions.length - 1) ? "is-active" : undefined}
                      // Chosen before the textarea loses focus (which closes the list).
                      onMouseDown={(e) => {
                        e.preventDefault();
                        mention(person);
                      }}
                      onMouseEnter={() => setPick(i)}
                    >
                      <Avatar src={person.avatar} size={24} />
                      <b>{person.name}</b>
                      <span className="mention-list__user">@{person.username}</span>
                      {person.admin && <span className="who__badge">{b.admin}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="composer__foot">
              {failed ? (
                <span className="composer__error" role="status">
                  {failed}
                </span>
              ) : (
                <span className="composer__count">
                  {draft.length}/{ideaLimits.comment}
                </span>
              )}
              <button type="submit" className="btn btn--primary btn--sm" disabled={sending || !draft.trim()}>
                <Icon name="send" />
                {sending ? b.commentPosting : b.commentPost}
              </button>
            </div>
          </div>
        </form>
      </>
    );
  };

  return (
    <>
      <div className="sheet__bar sheet__bar--item">
        <div className="sheet__chips">
          {votes}
          <span className="sheet__tags">
            <span className={`sheet__status sheet__status--${item.status}`}>{b.status[item.status]}</span>
            {types.length > 0 && (
              <span className={`idea__type idea__type--${type}`}>
                <Icon name={iconOf(type)} />
                {r.types[type]}
              </span>
            )}
            {category && <CategoryTag category={category} />}
          </span>
        </div>
        <div className="sheet__actions">
          {mode === "view" && <ShareButton item={item} />}
          {mode === "view" && (canManage || (canModerate && thread.status === "ready")) && (
            <ItemMenu
              item={item}
              admin={admin}
              onEdit={() => onMode("edit")}
              removeLabel={removeLabel}
              manage={canManage}
              comments={thread.status === "ready" ? { off: thread.off, onToggle: () => void switchComments() } : undefined}
            />
          )}
          <button type="button" className="icon-btn" onClick={onClose} aria-label={b.close} title={b.close}>
            <Icon name="close" />
          </button>
        </div>
      </div>

      <div className="sheet__body">
        {canManage && mode === "edit" ? (
          <EditForm
            item={item}
            categories={categories}
            types={types}
            admin={admin}
            media={thread.media}
            onRemoveMedia={removeMedia}
            onMediaAdded={reload}
            onDone={() => onMode("view")}
          />
        ) : (
          <>
            <h2 id="sheet-title" className="sheet__title">
              {item.title}
            </h2>
            <p className={`sheet__desc${item.description ? "" : " is-empty"}`}>{item.description || b.noDetails}</p>
            {thread.media.length > 0 && (
              <ul className="media-grid">
                {thread.media.map((file) => (
                  <li key={file.id}>
                    {file.type.startsWith("video/") ? (
                      <video src={file.url} controls playsInline preload="metadata" />
                    ) : (
                      <button
                        type="button"
                        className="media-grid__open"
                        onClick={() => setViewing(file)}
                        aria-label={fill(b.openMedia, { name: file.name })}
                      >
                        <Image src={file.url} alt="" width={480} height={300} unoptimized />
                      </button>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger media-grid__delete"
                        onClick={() => void removeMedia(file)}
                        aria-label={b.deleteMedia}
                        title={b.deleteMedia}
                      >
                        <Icon name="trash" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {facts}

            <section className="thread" aria-labelledby="thread-title">
              <h3 id="thread-title" className="thread__title">
                {b.commentsTitle}
                <span className="panel__count">{count}</span>
              </h3>
              {/* While loading: one placeholder per comment the item has (3 at most), or straight away
                  the note that there are none, so the dialog keeps its size when they arrive. */}
              {thread.status === "loading" &&
                (item.commentCount > 0 ? (
                  <ul className="thread__list" aria-busy="true">
                    {Array.from({ length: Math.min(item.commentCount, 3) }, (_, n) => (
                      <li key={n} className="comment">
                        <span className="skel skel--avatar" />
                        <div className="comment__main">
                          <span className="skel skel--line" style={{ width: "34%" }} />
                          <span className="skel skel--line" style={{ width: n === 1 ? "52%" : "76%" }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="thread__empty">{b.commentsEmpty}</p>
                ))}
              {thread.status === "error" && (
                <p className="thread__note" role="status">
                  {b.commentsError}
                  <button type="button" onClick={retry}>
                    {b.retry}
                  </button>
                </p>
              )}
              {thread.status === "ready" &&
                (thread.comments.length ? (
                  <ul className="thread__list">{thread.comments.map(renderComment)}</ul>
                ) : (
                  <p className="thread__empty">{b.commentsEmpty}</p>
                ))}
              {composer()}
            </section>
          </>
        )}
      </div>
      {viewing && (
        <div className="lightbox" role="presentation" onClick={() => setViewing(null)}>
          <Image src={viewing.url} alt={viewing.name} width={1600} height={1000} unoptimized />
          <button type="button" className="icon-btn lightbox__close" aria-label={b.close} title={b.close} autoFocus>
            <Icon name="close" />
          </button>
        </div>
      )}
      {confirmDialog}
      <Toast show={notice.show} icon={notice.icon}>
        {notice.text}
      </Toast>
    </>
  );
}

// Editing an item (admins): title, details, its images and videos, type and category. Files are
// removed at once (after a confirmation); new ones are uploaded when the form is saved.
function EditForm({
  item,
  categories,
  types,
  admin,
  media,
  onRemoveMedia,
  onMediaAdded,
  onDone,
}: {
  item: FeedbackItem;
  categories: Category[];
  types: TypeTag[];
  admin: ReturnType<typeof useAdmin>;
  media: MediaView[];
  onRemoveMedia: (file: MediaView) => Promise<void>;
  onMediaAdded: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const b = t.board;
  const r = t.ideas;
  const [values, setValues] = useState<EditValues>(() => ({
    title: item.title,
    description: item.description,
    typeId: types.find((type) => item.tags.some((tag) => tag.id === type.id))?.id ?? "",
    categoryId: categoryOf(item, categories)?.id ?? "",
  }));
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);
  const busy = admin.busy === item.id || progress !== null;
  const room = mediaLimits.files - media.length - files.length;
  const set = (key: keyof EditValues) => (value: string) => setValues((current) => ({ ...current, [key]: value }));

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const { picked, error } = pickFiles(list, room, r);
    setFileError(error);
    setFiles([...files, ...picked]);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(await admin.edit(item, values, categories, types))) return;
    if (files.length) {
      let failed = 0;
      for (const [index, file] of files.entries()) {
        setProgress({ current: index + 1, total: files.length });
        await uploadMedia(item.id, file).catch(() => failed++);
      }
      setProgress(null);
      setFiles([]);
      onMediaAdded();
      if (failed) return setFileError(b.mediaUploadFailed);
    }
    onDone();
  };

  return (
    <form className="sheet-form" onSubmit={(e) => void save(e)}>
      <h2 id="sheet-title" className="sheet__title">
        {b.editTitle}
      </h2>
      <label>
        <span className="field-label">
          {r.titleLabel}
          <FieldCount length={values.title.length} max={Math.max(ideaLimits.title, item.title.length)} />
        </span>
        <input
          value={values.title}
          onChange={(e) => set("title")(e.target.value)}
          minLength={3}
          maxLength={Math.max(ideaLimits.title, item.title.length)}
          required
        />
      </label>
      <label>
        <span className="field-label">
          {r.detailsLabel}
          <FieldCount length={values.description.length} max={ideaLimits.description} />
        </span>
        <textarea
          value={values.description}
          onChange={(e) => set("description")(e.target.value)}
          rows={7}
          maxLength={ideaLimits.description}
        />
      </label>
      <div className="idea-form__media">
        <span className="idea-form__label">{r.mediaLabel}</span>
        {media.length + files.length > 0 && (
          <ul className="media-picks">
            {media.map((file) => (
              <li key={file.id}>
                <MediaThumb url={file.url} type={file.type} />
                <button
                  type="button"
                  aria-label={fill(r.mediaRemove, { name: file.name })}
                  title={fill(r.mediaRemove, { name: file.name })}
                  disabled={busy}
                  onClick={() => void onRemoveMedia(file)}
                >
                  <Icon name="close" />
                </button>
              </li>
            ))}
            {previews.map(({ file, url }, index) => (
              <li key={url}>
                <MediaThumb url={url} type={file.type} />
                <button
                  type="button"
                  aria-label={fill(r.mediaRemove, { name: file.name })}
                  title={fill(r.mediaRemove, { name: file.name })}
                  disabled={busy}
                  onClick={() => setFiles((list) => list.filter((_, i) => i !== index))}
                >
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {room > 0 && (
          <label className="media-add">
            <input
              type="file"
              multiple
              accept={mediaLimits.types.join(",")}
              disabled={busy}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Icon name="attach" />
            {r.mediaAdd}
            <span className="media-add__count">
              {media.length + files.length}/{mediaLimits.files}
            </span>
          </label>
        )}
        <p className={`idea-form__hint${fileError ? " is-error" : ""}`} role={fileError ? "status" : undefined}>
          {fileError ?? fill(r.mediaHint, { count: String(mediaLimits.files) })}
        </p>
      </div>
      <div className="sheet-form__row">
        {types.length > 0 && (
          <label>
            <span>{r.typeLabel}</span>
            <select value={values.typeId} onChange={(e) => set("typeId")(e.target.value)}>
              <option value="">{r.types.other}</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {r.types[type.slug]}
                </option>
              ))}
            </select>
          </label>
        )}
        {categories.length > 0 && (
          <label>
            <span>{b.category}</span>
            <select value={values.categoryId} onChange={(e) => set("categoryId")(e.target.value)}>
              <option value="">{b.noCategory}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {platformName(category.name, t.ideas)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="sheet-form__actions">
        <button type="button" className="btn" onClick={onDone} disabled={busy}>
          {b.cancel}
        </button>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          <Icon name="check" />
          {progress ? fill(r.uploading, { current: String(progress.current), total: String(progress.total) }) : busy ? b.saving : b.save}
        </button>
      </div>
    </form>
  );
}
