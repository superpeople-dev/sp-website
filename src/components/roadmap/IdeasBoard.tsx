"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { FeedbackItem } from "reflet-sdk";
import { fill, localeHref } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import type { IdeaType } from "@/i18n/types";
import { categoryOf, typeOf, type Category, type TypeTag, type Viewer } from "@/lib/board";
import { ideaLimits, ideaTypes, mediaLimits } from "@/lib/site";
import { useConfirm } from "../ConfirmDialog";
import { Icon } from "../Icon";
import { AdminActions, useAdmin } from "./admin";
import { FieldCount } from "./FieldCount";
import { CategoryTag } from "./CategoryTag";
import { ItemDialog, type Opened } from "./ItemDialog";
import { ItemMenu } from "./ItemMenu";
import { useVote } from "./useVote";
import { signIn } from "./viewer";

type Sort = "top" | "new";
type Filter = IdeaType | "all";
type FormState = "idle" | "sending" | "pending" | "partial" | "limit" | "error";

const byVotes = (a: FeedbackItem, b: FeedbackItem) =>
  Number(b.isPinned) - Number(a.isPinned) || b.voteCount - a.voteCount || b.createdAt - a.createdAt;
const byDate = (a: FeedbackItem, b: FeedbackItem) => b.createdAt - a.createdAt;
const iconOf = (slug: IdeaType) => ideaTypes.find((type) => type.slug === slug)?.icon ?? "sparkle";
const isVideo = (type: string) => type.startsWith("video/");

async function upload(feedbackId: string, file: File) {
  const post = (body: object) =>
    fetch("/api/roadmap/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedbackId, ...body }),
    });
  const target = await post({ action: "url" });
  if (!target.ok) throw new Error(String(target.status));
  const { uploadUrl } = (await target.json()) as { uploadUrl: string };
  const stored = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
  if (!stored.ok) throw new Error(String(stored.status));
  const { storageId } = (await stored.json()) as { storageId: string };
  const saved = await post({ action: "save", storageId, mimeType: file.type, size: file.size, filename: file.name });
  if (!saved.ok) throw new Error(String(saved.status));
}

export function IdeasBoard({
  initial,
  categories,
  types,
  viewer,
  authReady,
  pendingMine,
}: {
  initial: FeedbackItem[];
  categories: Category[];
  types: TypeTag[];
  viewer: Viewer | null;
  authReady: boolean;
  pendingMine: number;
}) {
  const { locale, t } = useI18n();
  const r = t.ideas;
  const [items, setItems] = useState(initial);
  const [sort, setSort] = useState<Sort>("top");
  const [filter, setFilter] = useState<Filter>("all");
  const [kind, setKind] = useState<IdeaType | null>(types.find((type) => type.slug === "feature-request")?.slug ?? types[0]?.slug ?? null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [form, setForm] = useState<FormState>("idle");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [mine, setMine] = useState(pendingMine);
  const atLimit = !viewer?.admin && mine >= ideaLimits.pending;
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  const [ask, dialog] = useConfirm();
  const admin = useAdmin(setItems);
  const [opened, setOpened] = useState<Opened | null>(null);
  const current = opened ? (items.find((item) => item.id === opened.id) ?? null) : null;
  const close = useCallback(() => setOpened(null), []);
  const setMode = useCallback((mode: Opened["mode"]) => setOpened((o) => o && { ...o, mode }), []);
  const next = localeHref(locale, "/ideas");
  const available = ideaTypes.filter((type) => type.slug === "other" || types.some((tag) => tag.slug === type.slug));

  const visible = useMemo(
    () =>
      items
        .filter((item) => item.status === "open" && (filter === "all" || typeOf(item, types) === filter))
        .sort(sort === "top" ? byVotes : byDate),
    [items, sort, filter, types],
  );
  const review = useMemo(() => items.filter((item) => item.status === "under_review").sort(byDate), [items]);

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFileError(null);
    const picked = [...files];
    for (const file of Array.from(list)) {
      if (picked.length >= mediaLimits.files) break;
      if (!mediaLimits.types.includes(file.type)) {
        setFileError(fill(r.mediaType, { name: file.name }));
        continue;
      }
      if (file.size > (isVideo(file.type) ? mediaLimits.video : mediaLimits.image)) {
        setFileError(fill(r.mediaTooBig, { name: file.name }));
        continue;
      }
      picked.push(file);
    }
    setFiles(picked);
  };

  const patch = useCallback(
    (id: string, change: Partial<FeedbackItem>) =>
      setItems((list) => list.map((item) => (item.id === id ? { ...item, ...change } : item))),
    [],
  );
  const { vote, pending } = useVote({ patch, viewer, authReady, next });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form === "sending" || atLimit) return;
    const ok = await ask({
      title: r.confirmTitle,
      body: r.confirmBody,
      confirm: r.confirmYes,
      cancel: t.board.cancel,
      icon: "send",
    });
    if (!ok) return;
    setForm("sending");
    try {
      const response = await fetch("/api/roadmap/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: details, type: kind }),
      });
      if (response.status === 401) return signIn(next);
      if (response.status === 429) {
        setMine(ideaLimits.pending);
        return setForm("limit");
      }
      if (!response.ok) throw new Error(String(response.status));
      const { feedbackId } = (await response.json()) as { feedbackId: string };
      let failed = 0;
      for (const [index, file] of files.entries()) {
        setProgress({ current: index + 1, total: files.length });
        await upload(feedbackId, file).catch(() => failed++);
      }
      setProgress(null);
      setForm(failed ? "partial" : "pending");
      setTitle("");
      setDetails("");
      setFiles([]);
      setFileError(null);
      if (!viewer?.admin) setMine((count) => count + 1);
    } catch {
      setProgress(null);
      setForm("error");
    }
  };

  const typeBadge = (item: FeedbackItem) => {
    const type = typeOf(item, types);
    return (
      <span className={`idea__type idea__type--${type}`}>
        <Icon name={iconOf(type)} />
        {r.types[type]}
      </span>
    );
  };

  const card = (item: FeedbackItem, inReview: boolean) => {
    const category = categoryOf(item, categories);
    return (
      <li key={item.id} className={`idea card${inReview ? " idea--review" : ""}`}>
        <button
          type="button"
          className={`vote${item.hasVoted ? " is-voted" : ""}`}
          aria-pressed={item.hasVoted}
          aria-label={fill(item.hasVoted ? r.unvote : r.vote, { title: item.title })}
          disabled={!authReady || inReview || viewer?.banned}
          onClick={() => void vote(item)}
        >
          <Icon name="up" />
          <b>{item.voteCount}</b>
        </button>
        <div className="idea__body">
          <h3>
            <button type="button" className="card__open" onClick={() => setOpened({ id: item.id, mode: "view" })}>
              {item.title}
            </button>
          </h3>
          {item.description && <p>{item.description}</p>}
          <div className="idea__meta">
            {typeBadge(item)}
            {category && <CategoryTag category={category} />}
            {item.commentCount > 0 && (
              <span className="idea__comments" title={r.comments}>
                <Icon name="comment" />
                {item.commentCount}
              </span>
            )}
            {item.author?.name && <span className="idea__author">{item.author.name}</span>}
          </div>
          {viewer?.admin && inReview && (
            <AdminActions
              item={item}
              admin={admin}
              steps={[{ status: "open", label: r.approve, icon: "check" }]}
              rejectLabel={r.reject}
            />
          )}
        </div>
        {viewer?.admin && (
          <ItemMenu
            className="idea__tools"
            item={item}
            admin={admin}
            onEdit={() => setOpened({ id: item.id, mode: "edit" })}
            removeLabel={inReview ? r.reject : undefined}
          />
        )}
      </li>
    );
  };

  const notes: Partial<Record<FormState, string>> = { pending: r.pending, partial: r.mediaFailed, error: r.error };
  const note = notes[form] ?? null;
  const sending = form === "sending";

  return (
    <section id="ideas" className="flush">
      <div className={`wrap ideas${viewer ? "" : " ideas--solo"}`}>
        <div className="ideas__main">
          {viewer?.admin && review.length > 0 && (
            <div className="review">
              <p className="panel__title review__title">
                <span className="review__icon" aria-hidden="true">
                  <Icon name="clock" />
                </span>
                {r.reviewTitle}
                <span className="panel__count">{review.length}</span>
              </p>
              <ul className="idea-list">{review.map((item) => card(item, true))}</ul>
            </div>
          )}

          <div className="ideas__bar">
            {available.length > 1 && (
              <div className="ideas__filters" role="group" aria-label={r.typeLabel}>
                {(["all", ...available.map((type) => type.slug)] as Filter[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={filter === key ? "is-active" : undefined}
                    aria-pressed={filter === key}
                    onClick={() => setFilter(key)}
                  >
                    {key !== "all" && <Icon name={iconOf(key)} />}
                    {key === "all" ? r.filterAll : r.types[key]}
                  </button>
                ))}
              </div>
            )}
            <div className="ideas__sort" role="group">
              {(["top", "new"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={sort === key ? "is-active" : undefined}
                  aria-pressed={sort === key}
                  onClick={() => setSort(key)}
                >
                  {key === "top" ? r.sortTop : r.sortNew}
                </button>
              ))}
            </div>
          </div>

          {visible.length ? (
            <ul className="idea-list">{visible.map((item) => card(item, false))}</ul>
          ) : (
            <p className="ideas__empty">{r.empty}</p>
          )}
        </div>

        {viewer?.banned && (
          <aside className="ideas__side">
            <p className="panel thread__banned" role="status">
              <Icon name="ban" />
              {t.board.bannedNotice}
            </p>
          </aside>
        )}
        {viewer && !viewer.banned && (
          <aside className="ideas__side">
            <form className="panel idea-form" onSubmit={(e) => void submit(e)}>
              <p className="panel__title">{r.formTitle}</p>
              {note && (
                <p className={`idea-form__note${form === "error" || form === "partial" ? " is-error" : ""}`} role="status">
                  {note}
                </p>
              )}
              {atLimit && (
                <p className="idea-form__limit" role="status">
                  <Icon name="clock" />
                  {fill(r.limitReached, { count: String(ideaLimits.pending) })}
                </p>
              )}
              <fieldset className="idea-form__fields" disabled={atLimit || sending}>
              {available.length > 1 && (
                <fieldset className="idea-form__types">
                  <legend>{r.typeLabel}</legend>
                  {available.map((type) => (
                    <label key={type.slug} className={kind === type.slug ? "is-active" : undefined}>
                      <input
                        type="radio"
                        name="type"
                        value={type.slug}
                        checked={kind === type.slug}
                        onChange={() => setKind(type.slug)}
                      />
                      <Icon name={type.icon} />
                      {r.types[type.slug]}
                    </label>
                  ))}
                </fieldset>
              )}
              <label>
                <span className="field-label">
                  {r.titleLabel}
                  <FieldCount length={title.length} max={ideaLimits.title} />
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={r.titlePlaceholder}
                  minLength={3}
                  maxLength={ideaLimits.title}
                  required
                />
              </label>
              <label>
                <span className="field-label">
                  {r.detailsLabel}
                  <FieldCount length={details.length} max={ideaLimits.description} />
                </span>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder={r.detailsPlaceholder}
                  rows={5}
                  maxLength={ideaLimits.description}
                />
              </label>
              <div className="idea-form__media">
                <span className="idea-form__label">{r.mediaLabel}</span>
                {previews.length > 0 && (
                  <ul className="media-picks">
                    {previews.map(({ file, url }, index) => (
                      <li key={url}>
                        {isVideo(file.type) ? (
                          <>
                            <video src={url} muted playsInline preload="metadata" />
                            <span className="media-picks__play" aria-hidden="true">
                              <Icon name="play" />
                            </span>
                          </>
                        ) : (
                          <Image src={url} alt="" width={160} height={120} unoptimized />
                        )}
                        <button
                          type="button"
                          aria-label={fill(r.mediaRemove, { name: file.name })}
                          title={fill(r.mediaRemove, { name: file.name })}
                          onClick={() => setFiles((list) => list.filter((_, i) => i !== index))}
                        >
                          <Icon name="close" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {files.length < mediaLimits.files && (
                  <label className="media-add">
                    <input
                      type="file"
                      multiple
                      accept={mediaLimits.types.join(",")}
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <Icon name="attach" />
                    {r.mediaAdd}
                    <span className="media-add__count">
                      {files.length}/{mediaLimits.files}
                    </span>
                  </label>
                )}
                <p className={`idea-form__hint${fileError ? " is-error" : ""}`} role={fileError ? "status" : undefined}>
                  {fileError ?? fill(r.mediaHint, { count: String(mediaLimits.files) })}
                </p>
              </div>
              <button type="submit" className="btn btn--primary" disabled={atLimit || sending}>
                <Icon name="send" />
                {progress ? fill(r.uploading, { current: String(progress.current), total: String(progress.total) }) : sending ? r.submitting : r.submit}
              </button>
              </fieldset>
            </form>
          </aside>
        )}
      </div>
      <ItemDialog
        item={current}
        mode={opened?.mode ?? "view"}
        onMode={setMode}
        onClose={close}
        categories={categories}
        types={types}
        viewer={viewer}
        authReady={authReady}
        next={next}
        admin={admin}
        onPatch={patch}
        vote={(item) => void vote(item)}
        votePending={current ? pending.includes(current.id) : false}
        removeLabel={current?.status === "under_review" ? r.reject : undefined}
      />
      {dialog}
      {admin.dialog}
    </section>
  );
}
