"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { FeedbackItem } from "reflet-sdk";
import { fill, localeHref } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import type { IdeaType } from "@/i18n/types";
import { can, categoryOf, typeOf, type BoardItem, type Category, type TypeTag, type Viewer } from "@/lib/board";
import { ideaLimits, ideaTypes, mediaLimits } from "@/lib/site";
import { useConfirm } from "../ConfirmDialog";
import { Dropdown, type DropdownOption } from "../Dropdown";
import { Icon } from "../Icon";
import { Modal } from "../Modal";
import { SelectPicker, type PickOption } from "../SelectPicker";
import { Reveal } from "../motion";
import { AdminActions, useAdmin } from "./admin";
import { FieldCount } from "./FieldCount";
import { CategoryTag, categoryIcon } from "./CategoryTag";
import { ItemDialog, type Opened } from "./ItemDialog";
import { ItemMenu } from "./ItemMenu";
import { MediaThumb, pickFiles, uploadMedia } from "./media";
import { useVote } from "./useVote";
import { VoteControl } from "./VoteControl";
import { signIn } from "./viewer";
import { useItemUrl } from "./useItemUrl";

type Sort = "top" | "new";
type TypeFilter = IdeaType | "all";
// A category id, "other" (none) or "all".
type PlatformFilter = string;
type FormState = "idle" | "sending" | "pending" | "partial" | "limit" | "error" | "offensive" | "name";

const byVotes = (a: FeedbackItem, b: FeedbackItem) =>
  Number(b.isPinned) - Number(a.isPinned) || b.voteCount - a.voteCount || b.createdAt - a.createdAt;
const byDate = (a: FeedbackItem, b: FeedbackItem) => b.createdAt - a.createdAt;
const iconOf = (slug: IdeaType) => ideaTypes.find((type) => type.slug === slug)?.icon ?? "sparkle";
// The platforms (Reflet's categories) in the idea form, in this order; any other category after them.
const platformOrder = ["launcher", "game", "website", "servers"];
const platformRank = (category: Category) => {
  const rank = platformOrder.indexOf(category.name.toLowerCase());
  return rank < 0 ? platformOrder.length : rank;
};
// Lower case and without accents, so "equipe" finds "Équipe".
const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function IdeasBoard({
  initial,
  categories,
  types,
  viewer,
  authReady,
  pendingMine,
  openId,
}: {
  initial: FeedbackItem[];
  categories: Category[];
  types: TypeTag[];
  viewer: Viewer | null;
  authReady: boolean;
  pendingMine: number;
  openId?: string;
}) {
  const { locale, t } = useI18n();
  const r = t.ideas;
  const [items, setItems] = useState<BoardItem[]>(initial);
  const [sort, setSort] = useState<Sort>("top");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [query, setQuery] = useState("");
  // Neither has a default: the poster picks both (the form opens their list when one is left empty).
  const [kind, setKind] = useState<IdeaType | null>(null);
  // A category id, or "other" (none).
  const [platform, setPlatform] = useState<string | null>(null);
  const [picking, setPicking] = useState<"type" | "platform" | null>(null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [form, setForm] = useState<FormState>("idle");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [mine, setMine] = useState(pendingMine);
  const [composing, setComposing] = useState(false);
  const atLimit = !viewer?.admin && mine >= ideaLimits.pending;
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  const [ask, dialog] = useConfirm();
  const admin = useAdmin(setItems);
  // Opened on arrival when this is an item's page (/bugs-and-ideas/<id>/<slug>).
  const [opened, setOpened] = useState<Opened | null>(openId ? { id: openId, mode: "view" } : null);
  const current = opened ? (items.find((item) => item.id === opened.id) ?? null) : null;
  useItemUrl(localeHref(locale, "/bugs-and-ideas"), current, (id) =>
    setOpened(id && items.some((item) => item.id === id) ? { id, mode: "view" } : null),
  );
  const close = useCallback(() => setOpened(null), []);
  const closeForm = useCallback(() => setComposing(false), []);
  const unsaved = form !== "sending" && (title.trim() !== "" || details.trim() !== "" || files.length > 0);
  const unsavedRef = useRef(unsaved);
  useEffect(() => {
    unsavedRef.current = unsaved;
  }, [unsaved]);
  const dismissForm = useCallback(() => {
    if (!unsavedRef.current) return setComposing(false);
    void ask({ title: r.closeTitle, body: r.closeBody, confirm: t.board.close, cancel: t.board.cancel, icon: "close" }).then(
      (ok) => ok && setComposing(false),
    );
  }, [ask, r, t]);
  const setMode = useCallback((mode: Opened["mode"]) => setOpened((o) => o && { ...o, mode }), []);
  const next = localeHref(locale, "/bugs-and-ideas");
  const available = ideaTypes.filter((type) => type.slug === "other" || types.some((tag) => tag.slug === type.slug));
  const platformName = (name: string) => {
    const key = name.toLowerCase();
    return key in r.platforms ? r.platforms[key as keyof typeof r.platforms] : name;
  };
  const platforms: PickOption<string>[] = [
    ...[...categories]
      .sort((a, b) => platformRank(a) - platformRank(b))
      .map((category) => ({ key: category.id, label: platformName(category.name), icon: categoryIcon(category.name) })),
    { key: "other", label: r.platforms.other, icon: "other" },
  ];
  const typeFilters: DropdownOption<TypeFilter>[] = [
    { key: "all", label: r.filterAll, icon: "tag" },
    ...available.map((type) => ({ key: type.slug, label: r.types[type.slug], icon: type.icon })),
  ];
  const platformFilters: DropdownOption<PlatformFilter>[] = [{ key: "all", label: r.filterAll, icon: "layers" }, ...platforms];
  const typeShown = typeFilters.find((option) => option.key === typeFilter) ?? typeFilters[0];
  const platformShown = platformFilters.find((option) => option.key === platformFilter) ?? platformFilters[0];

  const open = useMemo(() => items.filter((item) => item.status === "open"), [items]);
  const visible = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    return open
      .filter(
        (item) =>
          (typeFilter === "all" || typeOf(item, types) === typeFilter) &&
          (platformFilter === "all" || (categoryOf(item, categories)?.id ?? "other") === platformFilter) &&
          words.every((word) => plain(`${item.title} ${item.description}`).includes(word)),
      )
      .sort(sort === "top" ? byVotes : byDate);
  }, [open, sort, typeFilter, platformFilter, query, types, categories]);
  const review = useMemo(() => items.filter((item) => item.status === "under_review").sort(byDate), [items]);

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const { picked, error } = pickFiles(list, mediaLimits.files - files.length, r);
    setFileError(error);
    setFiles([...files, ...picked]);
  };

  const patch = useCallback(
    (id: string, change: Partial<BoardItem>) =>
      setItems((list) => list.map((item) => (item.id === id ? { ...item, ...change } : item))),
    [],
  );
  const { vote, pending, prompt: signInPrompt } = useVote({ patch, viewer, authReady, next });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form === "sending" || atLimit) return;
    // The type and the platform are required: the first one left empty opens its list.
    if (available.length > 1 && !kind) return setPicking("type");
    if (platforms.length > 1 && !platform) return setPicking("platform");
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
        body: JSON.stringify({ title, description: details, type: kind ?? available[0]?.slug, platform: platform ?? "other" }),
      });
      if (response.status === 401) return signIn(next);
      if (response.status === 403 || response.status === 422) {
        const { error } = (await response.json().catch(() => ({}))) as { error?: string };
        if (error === "offensive" || error === "name") return setForm(error);
        throw new Error(String(response.status));
      }
      if (response.status === 429) {
        setMine(ideaLimits.pending);
        return setForm("limit");
      }
      if (!response.ok) throw new Error(String(response.status));
      const { feedbackId } = (await response.json()) as { feedbackId: string };
      let failed = 0;
      for (const [index, file] of files.entries()) {
        setProgress({ current: index + 1, total: files.length });
        await uploadMedia(feedbackId, file).catch(() => failed++);
      }
      setProgress(null);
      setForm(failed ? "partial" : "pending");
      setComposing(false);
      setTitle("");
      setDetails("");
      setKind(null);
      setPlatform(null);
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
        <VoteControl
          item={item}
          onVote={(direction) => void vote(item, direction)}
          disabled={!authReady || inReview || viewer?.banned}
        />
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
            {item.author?.name &&
              ((item as BoardItem).authorBanned ? (
                <span className="idea__author is-banned">
                  <s>{item.author.name}</s> ({t.admin.banned})
                </span>
              ) : (
                <span className="idea__author">{item.author.name}</span>
              ))}
          </div>
          {can(viewer, "review") && inReview && (
            <AdminActions
              item={item}
              admin={admin}
              steps={[{ status: "open", label: r.approve, icon: "check" }]}
              rejectLabel={r.reject}
            />
          )}
        </div>
        {can(viewer, "manage") && (
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

  const sentNotes: Partial<Record<FormState, string>> = { pending: r.pending, partial: r.mediaFailed };
  const sent = sentNotes[form] ?? null;
  const sending = form === "sending";
  const canPost = viewer && !viewer.banned && !viewer.nameBlocked;
  const formErrors: Partial<Record<FormState, string>> = { error: r.error, offensive: t.board.offensiveText, name: t.board.nameBlocked };
  const formError = formErrors[form] ?? null;
  const openForm = () => {
    if (sent) setForm("idle");
    setComposing(true);
  };

  return (
    <section id="ideas" className="flush">
      <div className="wrap">
        {viewer?.banned && (
          <p className="thread__banned ideas__banned" role="status">
            <Icon name="ban" />
            {t.board.bannedNotice}
          </p>
        )}
        {viewer?.nameBlocked && !viewer.banned && (
          <p className="thread__banned ideas__banned" role="status">
            <Icon name="ban" />
            {t.board.nameBlocked}
          </p>
        )}

        {can(viewer, "review") && review.length > 0 && (
          <Reveal className="review" y={16}>
            <p className="panel__title review__title">
              <span className="review__icon" aria-hidden="true">
                <Icon name="clock" />
              </span>
              {r.reviewTitle}
              <span className="panel__count">{review.length}</span>
            </p>
            <ul className="idea-list">{review.map((item) => card(item, true))}</ul>
          </Reveal>
        )}

        {canPost && (
          <Reveal className="ideas__top" y={16}>
            <button type="button" className="btn btn--primary btn--sm ideas__suggest" onClick={openForm}>
              <Icon name="plus" />
              {r.formTitle}
            </button>
          </Reveal>
        )}

        {/* Desktop: the type and platform filters, the sort, then the search on the right, on one row.
            Phone: the two filters on one row, the sort and the search under them. */}
        <Reveal className="ideas__bar" y={16}>
          {(available.length > 1 || platforms.length > 1) && (
            <div className="ideas__filters">
              {available.length > 1 && (
                <Dropdown
                  label={r.typeLabel}
                  buttonLabel={`${r.typeLabel}: ${typeShown.label}`}
                  options={typeFilters}
                  value={typeFilter}
                  onChange={setTypeFilter}
                  className="ideas__filter"
                  buttonClass={`ideas__filter-btn${typeFilter === "all" ? "" : " is-active"}`}
                >
                  <Icon name={typeShown.icon} />
                  <span>{typeFilter === "all" ? r.typeLabel : typeShown.label}</span>
                  <Icon name="chevron" className="ideas__chevron" />
                </Dropdown>
              )}
              {platforms.length > 1 && (
                <Dropdown
                  label={r.platformLabel}
                  buttonLabel={`${r.platformLabel}: ${platformShown.label}`}
                  options={platformFilters}
                  value={platformFilter}
                  onChange={setPlatformFilter}
                  className="ideas__filter"
                  buttonClass={`ideas__filter-btn${platformFilter === "all" ? "" : " is-active"}`}
                >
                  <Icon name={platformShown.icon} />
                  <span>{platformFilter === "all" ? r.platformLabel : platformShown.label}</span>
                  <Icon name="chevron" className="ideas__chevron" />
                </Dropdown>
              )}
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
          <label className="ideas__search">
            <Icon name="search" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={r.search} aria-label={r.search} />
          </label>
        </Reveal>

        {sent && (
          <p className={`ideas__sent${form === "partial" ? " is-error" : ""}`} role="status">
            <Icon name={form === "partial" ? "attach" : "check"} />
            {sent}
          </p>
        )}

        <Reveal delay={0.08} y={16}>
          {visible.length ? (
            <ul className="idea-list">{visible.map((item) => card(item, false))}</ul>
          ) : (
            <p className="ideas__empty">{open.length ? r.noMatch : r.empty}</p>
          )}
        </Reveal>
      </div>
      {canPost && (
        <Modal open={composing} onClose={dismissForm} labelledBy="idea-form-title" className="sheet--narrow">
          <div className="sheet__bar">
            <h2 id="idea-form-title" className="sheet__heading">
              <Icon name="bulb" />
              {r.formTitle}
            </h2>
            <div className="sheet__actions">
              <button
                type="button"
                className="icon-btn"
                onClick={closeForm}
                aria-label={t.board.close}
                title={t.board.close}
                data-autofocus={atLimit || undefined}
              >
                <Icon name="close" />
              </button>
            </div>
          </div>
          <div className="sheet__body">
            <form className="idea-form" onSubmit={(e) => void submit(e)}>
              {formError && (
                <p className="idea-form__note is-error" role="status">
                  {formError}
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
                <SelectPicker
                  label={r.typeLabel}
                  options={available.map((type) => ({ key: type.slug, label: r.types[type.slug], icon: type.icon }))}
                  value={kind}
                  onChange={setKind}
                  placeholder={r.typePlaceholder}
                  open={picking === "type"}
                  onOpen={(open) => setPicking(open ? "type" : null)}
                />
              )}
              {platforms.length > 1 && (
                <SelectPicker
                  label={r.platformLabel}
                  options={platforms}
                  value={platform}
                  onChange={setPlatform}
                  placeholder={r.platformPlaceholder}
                  open={picking === "platform"}
                  onOpen={(open) => setPicking(open ? "platform" : null)}
                />
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
                  data-autofocus={!atLimit || undefined}
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
                        <MediaThumb url={url} type={file.type} />
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
          </div>
        </Modal>
      )}
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
        vote={(item, direction) => void vote(item, direction)}
        votePending={current ? pending.includes(current.id) : false}
        removeLabel={current?.status === "under_review" ? r.reject : undefined}
      />
      {dialog}
      {admin.dialog}
      {signInPrompt}
    </section>
  );
}
