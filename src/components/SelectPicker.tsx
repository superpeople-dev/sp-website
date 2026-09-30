"use client";

import { useId } from "react";
import { Dropdown, type DropdownOption } from "./Dropdown";
import { Icon } from "./Icon";

export type PickOption<K extends string> = DropdownOption<K>;

// A form field that shows the chosen option and lists them all right under it when clicked (the idea
// form's type and platform). The parent holds the open state, so it can also open it itself (a
// required choice left empty).
export function SelectPicker<K extends string>({
  label,
  options,
  value,
  onChange,
  placeholder,
  open,
  onOpen,
}: {
  label: string;
  options: PickOption<K>[];
  value: K | null;
  onChange: (key: K) => void;
  placeholder?: string;
  open: boolean;
  onOpen: (open: boolean) => void;
}) {
  const labelId = useId();
  const valueId = useId();
  const current = options.find((option) => option.key === value) ?? null;

  return (
    <div className="picker">
      <span id={labelId} className="idea-form__label">
        {label}
      </span>
      <Dropdown
        label={label}
        options={options}
        value={value}
        onChange={onChange}
        buttonClass={`picker__btn${current ? "" : " is-empty"}`}
        labelledBy={`${labelId} ${valueId}`}
        className="picker__menu"
        open={open}
        onOpen={onOpen}
      >
        {current && (current.media ?? <Icon name={current.icon ?? "tag"} />)}
        <span id={valueId}>{current?.label ?? placeholder}</span>
        <Icon name="chevron" className="picker__chevron" />
      </Dropdown>
    </div>
  );
}
