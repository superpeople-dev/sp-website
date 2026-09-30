"use client";

import type { CSSProperties } from "react";
import { useI18n } from "@/i18n/context";
import type { Dictionary } from "@/i18n/types";
import type { Category } from "@/lib/board";
import { Icon, type IconName } from "../Icon";

const icons: [RegExp, IconName][] = [
  [/launch/i, "rocket"],
  [/server|backend|lobby/i, "server"],
  [/web|site/i, "globe"],
  [/game|client|gameplay/i, "gamepad"],
  [/discord|community/i, "discord"],
];

export const categoryIcon = (name: string): IconName => icons.find(([pattern]) => pattern.test(name))?.[1] ?? "tag";

// A category's name in the page's language when it is one of the platforms (Launcher, Game, ...);
// any other category keeps its name from Reflet.
export const platformName = (name: string, r: Dictionary["ideas"]) => {
  const key = name.toLowerCase();
  return key in r.platforms ? r.platforms[key as keyof typeof r.platforms] : name;
};

export function CategoryTag({ category }: { category: Category }) {
  const { t } = useI18n();
  return (
    <span className="work__category" style={{ "--cat": category.color } as CSSProperties}>
      <Icon name={categoryIcon(category.name)} />
      {platformName(category.name, t.ideas)}
    </span>
  );
}
