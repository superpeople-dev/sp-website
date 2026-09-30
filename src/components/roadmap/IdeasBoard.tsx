"use client";

import { useCallback, useMemo, useState } from "react";
import type { FeedbackItem } from "reflet-sdk";
import { fill, localeHref } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import type { IdeaType } from "@/i18n/types";
import { can, categoryOf, typeOf, type BoardItem, type Category, type TypeTag, type Viewer } from "@/lib/board";
import { ideaLimits, ideaTypes } from "@/lib/site";
import { Dropdown, type DropdownOption } from "../Dropdown";
import { Icon } from "../Icon";
import { Reveal } from "../motion";
import { AdminActions, useAdmin } from "./admin";
import { CategoryTag } from "./CategoryTag";
import { IdeaForm, platformChoices, typeChoices, type Created, type IdeaFields } from "./IdeaForm";
import { ItemDialog, type Opened } from "./ItemDialog";
import { ItemMenu } from "./ItemMenu";
import { useVote } from "./useVote";
import { VoteControl } from "./VoteControl";
import { signIn } from "./viewer";
import { useItemUrl } from "./useItemUrl";

type Sort = "top" | "new";
type TypeFilter = IdeaType | "all";
// A category id, "other" (none) or "all".
type PlatformFilter = string;

const byVotes = (a: FeedbackItem, b: FeedbackItem) =>
  Number(b.isPinned) - Number(a.isPinned) || b.voteCount - a.voteCount || b.createdAt - a.createdAt;
const byDate = (a: FeedbackItem, b: FeedbackItem) => b.createdAt - a.createdAt;
const iconOf = (slug: IdeaType) => ideaTypes.find((type) => type.slug === slug)?.icon ?? "sparkle";
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
  // After posting: the idea waits for review ("partial": some files didn't upload).
  const [sent, setSent] = useState<"pending" | "partial" | null>(null);
  const [mine, setMine] = useState(pendingMine);
  const [composing, setComposing] = useState(false);
  const atLimit = !viewer?.admin && mine >= ideaLimits.pending;
  const admin = useAdmin(setItems);
  // Opened on arrival when this is an item's page (/bugs-and-ideas/<id>/<slug>).
  const [opened, setOpened] = useState<Opened | null>(openId ? { id: openId, mode: "view" } : null);
  const current = opened ? (items.find((item) => item.id === opened.id) ?? null) : null;
  useItemUrl(localeHref(locale, "/bugs-and-ideas"), current, (id) =>
    setOpened(id && items.some((item) => item.id === id) ? { id, mode: "view" } : null),
  );
  const close = useCallback(() => setOpened(null), []);
  const closeForm = useCallback(() => setComposing(false), []);
  const setMode = useCallback((mode: Opened["mode"]) => setOpened((o) => o && { ...o, mode }), []);
  const next = localeHref(locale, "/bugs-and-ideas");
  const available = typeChoices(types, r);
  const platforms = platformChoices(categories, r);
  const typeFilters: DropdownOption<TypeFilter>[] = [{ key: "all", label: r.filterAll, icon: "tag" }, ...available];
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

  const patch = useCallback(
    (id: string, change: Partial<BoardItem>) =>
      setItems((list) => list.map((item) => (item.id === id ? { ...item, ...change } : item))),
    [],
  );
  const { vote, prompt: signInPrompt } = useVote({ patch, viewer, authReady, next });

  // The idea goes to review first; the form uploads its files once it exists.
  const create = async (fields: IdeaFields): Promise<Created> => {
    const response = await fetch("/api/roadmap/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (response.status === 401) {
      signIn(next);
      return null;
    }
    if (response.status === 429) {
      setMine(ideaLimits.pending);
      return null;
    }
    if (response.status === 403 || response.status === 422) {
      const { error } = (await response.json().catch(() => ({}))) as { error?: string };
      return { error: error === "offensive" || error === "name" ? error : "error" };
    }
    if (!response.ok) return { error: "error" };
    const { feedbackId } = (await response.json()) as { feedbackId: string };
    return { feedbackId };
  };

  const posted = (_: string, failedUploads: number) => {
    setSent(failedUploads ? "partial" : "pending");
    setComposing(false);
    if (!viewer?.admin) setMine((count) => count + 1);
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

  const canPost = viewer && !viewer.banned && !viewer.nameBlocked;
  const openForm = () => {
    setSent(null);
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
          <p className={`ideas__sent${sent === "partial" ? " is-error" : ""}`} role="status">
            <Icon name={sent === "partial" ? "attach" : "check"} />
            {sent === "partial" ? r.mediaFailed : r.pending}
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
        <IdeaForm
          open={composing}
          onClose={closeForm}
          categories={categories}
          types={types}
          heading={r.formTitle}
          icon="bulb"
          submit={r.submit}
          submitIcon="send"
          confirm={{ title: r.confirmTitle, body: r.confirmBody, yes: r.confirmYes }}
          closeText={{ title: r.closeTitle, body: r.closeBody }}
          limit={atLimit ? fill(r.limitReached, { count: String(ideaLimits.pending) }) : null}
          create={create}
          onCreated={posted}
        />
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
        removeLabel={current?.status === "under_review" ? r.reject : undefined}
      />
      {admin.dialog}
      {signInPrompt}
    </section>
  );
}
