"use client";

import { useMemo, useState } from "react";
import type { FeedbackItem } from "reflet-sdk";
import { useI18n } from "@/i18n/context";
import type { IdeaType } from "@/i18n/types";
import { categoryOf, typeOf, type Category, type TypeTag } from "@/lib/board";
import { Dropdown, type DropdownOption } from "../Dropdown";
import { Icon } from "../Icon";
import { Reveal } from "../motion";
import { platformChoices, typeChoices } from "./IdeaForm";

// The boards' toolbar (Bugs & Ideas, Roadmap): filters by type and platform, Top or New, and a search
// through titles and descriptions. useBoardFilters holds what is picked; BoardBar shows it.

export type Sort = "top" | "new";
type TypeFilter = IdeaType | "all";
// A category id, "other" (none) or "all".
type PlatformFilter = string;

export const byVotes = (a: FeedbackItem, b: FeedbackItem) =>
  Number(b.isPinned) - Number(a.isPinned) || b.voteCount - a.voteCount || b.createdAt - a.createdAt;
export const byDate = (a: FeedbackItem, b: FeedbackItem) => b.createdAt - a.createdAt;
// Lower case and without accents, so "equipe" finds "Équipe".
const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function useBoardFilters(categories: Category[], types: TypeTag[]) {
  const [sort, setSort] = useState<Sort>("top");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [query, setQuery] = useState("");
  // Whether an item passes the filters and the search (every word, in its title or description).
  const matches = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    return (item: FeedbackItem) =>
      (typeFilter === "all" || typeOf(item, types) === typeFilter) &&
      (platformFilter === "all" || (categoryOf(item, categories)?.id ?? "other") === platformFilter) &&
      words.every((word) => plain(`${item.title} ${item.description}`).includes(word));
  }, [query, typeFilter, platformFilter, types, categories]);
  return {
    sort,
    setSort,
    typeFilter,
    setTypeFilter,
    platformFilter,
    setPlatformFilter,
    query,
    setQuery,
    matches,
    // Something narrows the list (a filter or search words), so it may show fewer items or none.
    filtering: typeFilter !== "all" || platformFilter !== "all" || query.trim() !== "",
    order: sort === "top" ? byVotes : byDate,
  };
}

export type BoardFilters = ReturnType<typeof useBoardFilters>;

// Desktop: the type and platform filters, the sort, then the search on the right, on one row.
// Phone: the two filters on one row, the sort and the search under them.
export function BoardBar({ filters, categories, types }: { filters: BoardFilters; categories: Category[]; types: TypeTag[] }) {
  const { t } = useI18n();
  const r = t.ideas;
  const { sort, setSort, typeFilter, setTypeFilter, platformFilter, setPlatformFilter, query, setQuery } = filters;
  const available = typeChoices(types, r);
  const platforms = platformChoices(categories, r);
  const typeFilters: DropdownOption<TypeFilter>[] = [{ key: "all", label: r.filterAll, icon: "tag" }, ...available];
  const platformFilters: DropdownOption<PlatformFilter>[] = [{ key: "all", label: r.filterAll, icon: "layers" }, ...platforms];
  const typeShown = typeFilters.find((option) => option.key === typeFilter) ?? typeFilters[0];
  const platformShown = platformFilters.find((option) => option.key === platformFilter) ?? platformFilters[0];

  return (
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
              <Icon name={typeShown.icon ?? "tag"} />
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
              <Icon name={platformShown.icon ?? "layers"} />
              <span>{platformFilter === "all" ? r.platformLabel : platformShown.label}</span>
              <Icon name="chevron" className="ideas__chevron" />
            </Dropdown>
          )}
        </div>
      )}
      <div className="ideas__sort" role="group">
        {(["top", "new"] as const).map((key) => (
          <button key={key} type="button" className={sort === key ? "is-active" : undefined} aria-pressed={sort === key} onClick={() => setSort(key)}>
            {key === "top" ? r.sortTop : r.sortNew}
          </button>
        ))}
      </div>
      <label className="ideas__search">
        <Icon name="search" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={r.search} aria-label={r.search} />
      </label>
    </Reveal>
  );
}
