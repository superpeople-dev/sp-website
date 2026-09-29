"use client";

import { useCallback, useId, useState } from "react";
import { useI18n } from "@/i18n/context";
import { Icon, type IconName } from "./Icon";
import { Modal } from "./Modal";

export type FilterOption<K extends string> = { key: K; label: string; icon: IconName };

// Two layouts, switched in CSS at the same width as the site menu: a row of chips on wide
// screens, one button that opens a picker below it. The first option is "all".
export function FilterPicker<K extends string>({
  label,
  options,
  value,
  onChange,
  chipIcons = false,
}: {
  label: string;
  options: FilterOption<K>[];
  value: K;
  onChange: (key: K) => void;
  chipIcons?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const titleId = useId();
  const current = options.find((option) => option.key === value) ?? options[0];

  return (
    <div className="filter">
      <div className="filter__chips" role="group" aria-label={label}>
        {options.map((option, i) => (
          <button
            key={option.key}
            type="button"
            className={option.key === value ? "is-active" : undefined}
            aria-pressed={option.key === value}
            onClick={() => onChange(option.key)}
          >
            {chipIcons && i > 0 && <Icon name={option.icon} />}
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`filter__btn${current.key === options[0].key ? "" : " is-active"}`}
        aria-haspopup="dialog"
        aria-label={`${label}: ${current.label}`}
        onClick={() => setOpen(true)}
      >
        <Icon name="filter" />
        <span>{current.label}</span>
        <Icon name="chevron" />
      </button>
      <Modal open={open} onClose={close} labelledBy={titleId} className="sheet--narrow">
        <div className="sheet__bar">
          <h2 id={titleId} className="sheet__heading">
            <Icon name="filter" />
            {label}
          </h2>
          <div className="sheet__actions">
            <button type="button" className="icon-btn" onClick={close} aria-label={t.board.close} title={t.board.close}>
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="sheet__body">
          <div className="filter-pick" role="group" aria-label={label}>
            {options.map((option) => (
              <button
                key={option.key}
                type="button"
                className={option.key === value ? "is-active" : undefined}
                aria-pressed={option.key === value}
                data-autofocus={option.key === value || undefined}
                onClick={() => {
                  onChange(option.key);
                  close();
                }}
              >
                <Icon name={option.icon} />
                {option.label}
                {option.key === value && <Icon name="check" />}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
