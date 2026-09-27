import type { CSSProperties } from "react";
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

export function CategoryTag({ category }: { category: Category }) {
  return (
    <span className="work__category" style={{ "--cat": category.color } as CSSProperties}>
      <Icon name={categoryIcon(category.name)} />
      {category.name}
    </span>
  );
}
