"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { FeedbackItem } from "reflet-sdk";
import { fill, localeInfo } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import type { IdeaType } from "@/i18n/types";
import {
  categoryOf,
  doneAt,
  typeOf,
  type Author,
  type Category,
  type CommentView,
  type MediaView,
  type TypeTag,
  type Viewer,
} from "@/lib/board";
import { ideaLimits, ideaTypes } from "@/lib/site";
import { useConfirm } from "../ConfirmDialog";
import { Icon } from "../Icon";
import { Modal } from "../Modal";
import type { EditValues, useAdmin } from "./admin";
import { CategoryTag } from "./CategoryTag";
import { ItemMenu } from "./ItemMenu";
import { loginHref, signIn } from "./viewer";

export type Opened = { id: string; mode: "view" | "edit" };

type Thread = {
  status: "loading" | "ready" | "error";
  comments: CommentView[];
  author: Author | null;
  media: MediaView[];
};

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
  vote?: (item: FeedbackItem) => void;
  votePending?: boolean;
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

function Avatar({ author, size = 36 }: { author: Pick<Author, "name" | "avatar">; size?: number }) {
  if (author.avatar) {
    return <Image className="avatar" src={author.avatar} alt="" width={size} height={size} unoptimized />;
  }
  return (
    <span className="avatar avatar--blank" style={{ width: size, height: size }} aria-hidden="true">
      {author.name.slice(0, 1).toUpperCase()}
    </span>
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
  votePending,
  removeLabel,
}: Props & { item: FeedbackItem }) {
  const { locale, t } = useI18n();
  const b = t.board;
  const r = t.ideas;
  const [ask, confirmDialog] = useConfirm();
  const [thread, setThread] = useState<Thread>({ status: "loading", comments: [], author: null, media: [] });
  const [viewing, setViewing] = useState<MediaView | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [bannedIds, setBannedIds] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
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
        const data = (await response.json()) as { comments: CommentView[]; author: Author | null; media?: MediaView[] };
        if (live) setThread({ status: "ready", comments: data.comments, author: data.author, media: data.media ?? [] });
      })
      .catch(() => {
        if (live) setThread((current) => ({ ...current, status: "error" }));
      });
    return () => {
      live = false;
    };
  }, [item.id, attempt]);

  const retry = () => {
    setThread((current) => ({ ...current, status: "loading" }));
    setAttempt((n) => n + 1);
  };

  const type = typeOf(item, types);
  const category = categoryOf(item, categories);
  const isAdmin = viewer?.admin === true;
  const inReview = item.status === "under_review";
  const count = thread.status === "ready" ? countAll(thread.comments) : item.commentCount;

  const canBan = (author: Author | null): author is Author & { id: string } =>
    Boolean(viewer?.canBan && author?.id && author.id !== viewer.id && !author.admin);

  const banAuthor = async (author: Author & { id: string }) => {
    const ok = await ask({
      title: fill(b.banTitle, { name: author.name }),
      body: b.banBody,
      confirm: b.banYes,
      cancel: b.cancel,
      icon: "ban",
      danger: true,
    });
    if (!ok) return;
    const response = await fetch("/api/admin/bans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ban", user: author }),
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
    const response = await fetch("/api/admin/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId: comment.id }),
    }).catch(() => null);
    if (!response?.ok) return window.alert(b.actionFailed);
    setThread((current) => ({ ...current, comments: prune(current.comments, comment.id) }));
    onPatch(item.id, { commentCount: Math.max(0, item.commentCount - 1 - countAll(comment.replies)) });
  };

  const post = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (sending || !body) return;
    setSending(true);
    setFailed(false);
    try {
      const response = await fetch("/api/roadmap/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId: item.id, body }),
      });
      if (response.status === 401) return signIn(next);
      if (response.status === 403) return setBlocked(true);
      if (!response.ok) throw new Error(String(response.status));
      const { comment } = (await response.json()) as { comment: CommentView };
      setThread((current) => ({ ...current, comments: [...current.comments, comment] }));
      setDraft("");
      onPatch(item.id, { commentCount: item.commentCount + 1 });
    } catch {
      setFailed(true);
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
      body: JSON.stringify({ mediaId: file.id }),
    }).catch(() => null);
    if (!response?.ok) return window.alert(b.actionFailed);
    setThread((current) => ({ ...current, media: current.media.filter((entry) => entry.id !== file.id) }));
  };

  const who = (author: Author | null) => {
    if (!author) return <span className="who__team">{b.team}</span>;
    return (
      <span className="who">
        <Avatar author={author} size={28} />
        <b>{author.name}</b>
        {author.username && author.username !== author.name && <span className="who__user">@{author.username}</span>}
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

  const renderComment = (comment: CommentView) => (
    <li key={comment.id} className="comment">
      <Avatar author={comment.author ?? { name: "?" }} />
      <div className="comment__main">
        <div className="comment__head">
          <b>{comment.author?.name ?? b.team}</b>
          {comment.author?.username && comment.author.username !== comment.author.name && (
            <span className="comment__user">@{comment.author.username}</span>
          )}
          {comment.author?.admin && <span className="who__badge">{b.admin}</span>}
          <time dateTime={new Date(comment.createdAt).toISOString()}>{format.stamp.format(comment.createdAt)}</time>
          {isAdmin && (
            <span className="comment__tools">
              {banControl(comment.author)}
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                onClick={() => void removeComment(comment)}
                aria-label={b.deleteComment}
                title={b.deleteComment}
              >
                <Icon name="trash" />
              </button>
            </span>
          )}
        </div>
        <p className="comment__body">{comment.body}</p>
        {comment.replies.length > 0 && <ul className="comment__replies">{comment.replies.map(renderComment)}</ul>}
      </div>
    </li>
  );

  const facts = (
    <dl className="sheet__facts">
      <div className="sheet__fact sheet__fact--wide">
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
      <div className="sheet__fact">
        <dt>{b.votes}</dt>
        <dd>
          {vote && !inReview ? (
            <button
              type="button"
              className={`sheet__vote${item.hasVoted ? " is-voted" : ""}`}
              aria-pressed={item.hasVoted}
              aria-label={fill(item.hasVoted ? r.unvote : r.vote, { title: item.title })}
              disabled={!authReady || votePending || viewer?.banned}
              onClick={() => vote(item)}
            >
              <Icon name="up" />
              {item.voteCount}
            </button>
          ) : (
            <span className="sheet__votes">
              <Icon name="up" />
              {item.voteCount}
            </span>
          )}
        </dd>
      </div>
    </dl>
  );

  const composer = () => {
    if (!authReady) return null;
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
    return (
      <form className="composer" onSubmit={(e) => void post(e)}>
        <Avatar author={viewer} />
        <div className="composer__main">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
            }}
            placeholder={b.commentPlaceholder}
            aria-label={b.commentPlaceholder}
            rows={3}
            maxLength={ideaLimits.comment}
            required
          />
          <div className="composer__foot">
            {failed ? (
              <span className="composer__error" role="status">
                {b.commentFailed}
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
    );
  };

  return (
    <>
      <div className="sheet__bar">
        <div className="sheet__chips">
          <span className={`sheet__status sheet__status--${item.status}`}>{b.status[item.status]}</span>
          {types.length > 0 && (
            <span className={`idea__type idea__type--${type}`}>
              <Icon name={iconOf(type)} />
              {r.types[type]}
            </span>
          )}
          {category && <CategoryTag category={category} />}
        </div>
        <div className="sheet__actions">
          {isAdmin && mode === "view" && (
            <ItemMenu item={item} admin={admin} onEdit={() => onMode("edit")} removeLabel={removeLabel} />
          )}
          <button type="button" className="icon-btn" onClick={onClose} aria-label={b.close} title={b.close} data-autofocus>
            <Icon name="close" />
          </button>
        </div>
      </div>

      <div className="sheet__body">
        {isAdmin && mode === "edit" ? (
          <EditForm item={item} categories={categories} types={types} admin={admin} onDone={() => onMode("view")} />
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
                    {isAdmin && (
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
              {thread.status === "loading" && (
                <ul className="thread__list" aria-busy="true">
                  {[0, 1, 2].map((n) => (
                    <li key={n} className="comment">
                      <span className="skel skel--avatar" />
                      <div className="comment__main">
                        <span className="skel skel--line" style={{ width: "34%" }} />
                        <span className="skel skel--line" />
                        <span className="skel skel--line" style={{ width: n === 1 ? "52%" : "76%" }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
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
    </>
  );
}

function EditForm({
  item,
  categories,
  types,
  admin,
  onDone,
}: {
  item: FeedbackItem;
  categories: Category[];
  types: TypeTag[];
  admin: ReturnType<typeof useAdmin>;
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
  const busy = admin.busy === item.id;
  const set = (key: keyof EditValues) => (value: string) => setValues((current) => ({ ...current, [key]: value }));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await admin.edit(item, values, categories, types)) onDone();
  };

  return (
    <form className="sheet-form" onSubmit={(e) => void save(e)}>
      <h2 id="sheet-title" className="sheet__title">
        {b.editTitle}
      </h2>
      <label>
        <span>{r.titleLabel}</span>
        <input
          value={values.title}
          onChange={(e) => set("title")(e.target.value)}
          minLength={3}
          maxLength={ideaLimits.title}
          required
        />
      </label>
      <label>
        <span>{r.detailsLabel}</span>
        <textarea
          value={values.description}
          onChange={(e) => set("description")(e.target.value)}
          rows={7}
          maxLength={ideaLimits.description}
        />
      </label>
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
                  {category.name}
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
          {busy ? b.saving : b.save}
        </button>
      </div>
    </form>
  );
}
