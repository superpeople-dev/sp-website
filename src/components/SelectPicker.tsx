"use client";

import { useId } from "react";
import { useI18n } from "@/i18n/context";
import { Icon, type IconName } from "./Icon";
import { Modal } from "./Modal";

export type PickOption<K extends string> = { key: K; label: string; icon: IconName };

// A form field that shows the chosen option and opens a dialog listing them all (the idea form's type
// and platform): one row in the form, whatever the number of options or the language. The parent
// opens it, so it can also open it itself (a required choice left empty).
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
  const { t } = useI18n();
  const labelId = useId();
  const valueId = useId();
  const titleId = useId();
  const current = options.find((option) => option.key === value) ?? null;
  const close = () => onOpen(false);

  return (
    <div className="picker">
      <span id={labelId} className="idea-form__label">
        {label}
      </span>
      <button
        type="button"
        className={`picker__btn${current ? "" : " is-empty"}`}
        aria-haspopup="dialog"
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => onOpen(true)}
      >
        {current && <Icon name={current.icon} />}
        <span id={valueId}>{current?.label ?? placeholder}</span>
        <Icon name="chevron" className="picker__chevron" />
      </button>
      <Modal open={open} onClose={close} labelledBy={titleId} className="sheet--narrow">
        <div className="sheet__bar">
          <h2 id={titleId} className="sheet__heading">
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
