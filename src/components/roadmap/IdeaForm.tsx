"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { fill } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import type { Dictionary, IdeaType } from "@/i18n/types";
import type { Category, TypeTag } from "@/lib/board";
import { postReadsAsEnglish } from "@/lib/english";
import { ideaLimits, ideaTypes, mediaLimits } from "@/lib/site";
import { useConfirm } from "../ConfirmDialog";
import { Icon, type IconName } from "../Icon";
import { Modal } from "../Modal";
import { SelectPicker, type PickOption } from "../SelectPicker";
import { categoryIcon, platformName } from "./CategoryTag";
import { FieldCount } from "./FieldCount";
import { MediaThumb, pickFiles, uploadMedia } from "./media";

// The platforms (Reflet's categories), in this order; any other category after them, then "Other".
const platformOrder = ["launcher", "game", "website", "servers"];
const platformRank = (category: Category) => {
  const rank = platformOrder.indexOf(category.name.toLowerCase());
  return rank < 0 ? platformOrder.length : rank;
};

// The types Reflet has a tag for, and "Other".
export const typeChoices = (types: TypeTag[], r: Dictionary["ideas"]): PickOption<IdeaType>[] =>
  ideaTypes
    .filter((type) => type.slug === "other" || types.some((tag) => tag.slug === type.slug))
    .map((type) => ({ key: type.slug, label: r.types[type.slug], icon: type.icon }));

// Keys: a category id, or "other" (none).
export const platformChoices = (categories: Category[], r: Dictionary["ideas"]): PickOption<string>[] => [
  ...[...categories]
    .sort((a, b) => platformRank(a) - platformRank(b))
    .map((category) => ({ key: category.id, label: platformName(category.name, r), icon: categoryIcon(category.name) })),
  { key: "other", label: r.platforms.other, icon: "other" },
];

export type IdeaFields = { title: string; description: string; type: IdeaType; platform: string };
// What create gives back: the new item's id, why it was refused, or null when the caller took over
// (sent the player to sign in, or shows its own notice).
export type Created = { feedbackId: string } | { error: "error" | "offensive" | "name" | "english" } | null;

// A new post, in a dialog: its type and platform (both required, nothing chosen by default), title,
// details and images. Bugs & Ideas posts a player's idea with it; the roadmap's "Add task" creates a
// task in a column. The caller creates the item; the form then uploads the files to it.
export function IdeaForm({
  open,
  onClose,
  categories,
  types,
  heading,
  submit: submitText,
  submitIcon,
  confirm,
  closeText,
  limit,
  english = false,
  create,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  types: TypeTag[];
  heading: string;
  submit: string;
  submitIcon: IconName;
  // Asked before sending, if given.
  confirm?: { title: string; body: string; yes: string };
  // Asked before closing with something typed in.
  closeText: { title: string; body: string };
  // Why the poster can't post right now: shown on top, and the fields are disabled.
  limit?: string | null;
  // In English only (Bugs & Ideas): said on top on the other languages' pages, and checked before
  // asking to confirm (the server refuses it too).
  english?: boolean;
  create: (fields: IdeaFields) => Promise<Created>;
  onCreated: (feedbackId: string, failedUploads: number) => void;
}) {
  const { locale, t } = useI18n();
  const r = t.ideas;
  const [kind, setKind] = useState<IdeaType | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [picking, setPicking] = useState<"type" | "platform" | null>(null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "error" | "offensive" | "name" | "english">("idle");
  const [ask, dialog] = useConfirm();
  const headingId = useId();
  const kinds = typeChoices(types, r);
  const platforms = platformChoices(categories, r);
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);
  const sending = state === "sending";
  const locked = Boolean(limit) || sending;

  const unsaved = !sending && (title.trim() !== "" || details.trim() !== "" || files.length > 0);
  const unsavedRef = useRef(unsaved);
  useEffect(() => {
    unsavedRef.current = unsaved;
  }, [unsaved]);
  const dismiss = useCallback(() => {
    if (!unsavedRef.current) return onClose();
    void ask({ title: closeText.title, body: closeText.body, confirm: t.board.close, cancel: t.board.cancel, icon: "close" }).then(
      (ok) => ok && onClose(),
    );
  }, [ask, closeText, onClose, t]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const { picked, error } = pickFiles(list, mediaLimits.files - files.length, r);
    setFileError(error);
    setFiles([...files, ...picked]);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (locked) return;
    // The type and the platform are required: the first one left empty opens its list.
    if (kinds.length > 1 && !kind) return setPicking("type");
    if (platforms.length > 1 && !platform) return setPicking("platform");
    if (english && !postReadsAsEnglish(title, details)) return setState("english");
    if (confirm && !(await ask({ title: confirm.title, body: confirm.body, confirm: confirm.yes, cancel: t.board.cancel, icon: "send" }))) {
      return;
    }
    setState("sending");
    const result = await create({
      title,
      description: details,
      type: kind ?? kinds[0]?.key ?? "other",
      platform: platform ?? "other",
    }).catch((): Created => ({ error: "error" }));
    if (!result) return setState("idle");
    if ("error" in result) return setState(result.error);
    let failed = 0;
    for (const [index, file] of files.entries()) {
      setProgress({ current: index + 1, total: files.length });
      await uploadMedia(result.feedbackId, file).catch(() => failed++);
    }
    setProgress(null);
    setState("idle");
    setTitle("");
    setDetails("");
    setKind(null);
    setPlatform(null);
    setFiles([]);
    setFileError(null);
    onCreated(result.feedbackId, failed);
  };

  const errors = { error: r.error, offensive: t.board.offensiveText, name: t.board.nameBlocked, english: r.englishOnly };
  const error = state === "error" || state === "offensive" || state === "name" || state === "english" ? errors[state] : null;

  return (
    <>
      <Modal open={open} onClose={dismiss} labelledBy={headingId} className="sheet--narrow">
        <div className="sheet__bar">
          <h2 id={headingId} className="sheet__heading">
            {heading}
          </h2>
          <div className="sheet__actions">
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label={t.board.close}
              title={t.board.close}
              data-autofocus={limit ? true : undefined}
            >
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="sheet__body">
          <form className="idea-form" onSubmit={(e) => void submit(e)}>
            {error && (
              <p className="idea-form__note is-error" role="status">
                {error}
              </p>
            )}
            {english && locale !== "en" && state !== "english" && <p className="idea-form__note">{r.englishOnly}</p>}
            {limit && (
              <p className="idea-form__limit" role="status">
                <Icon name="clock" />
                {limit}
              </p>
            )}
            <fieldset className="idea-form__fields" disabled={locked}>
              {kinds.length > 1 && (
                <SelectPicker
                  label={r.typeLabel}
                  options={kinds}
                  value={kind}
                  onChange={setKind}
                  placeholder={r.typePlaceholder}
                  open={picking === "type"}
                  onOpen={(value) => setPicking(value ? "type" : null)}
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
                  onOpen={(value) => setPicking(value ? "platform" : null)}
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
                  data-autofocus={limit ? undefined : true}
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
              <button type="submit" className="btn btn--primary" disabled={locked}>
                <Icon name={submitIcon} />
                {progress
                  ? fill(r.uploading, { current: String(progress.current), total: String(progress.total) })
                  : sending
                    ? r.submitting
                    : submitText}
              </button>
            </fieldset>
          </form>
        </div>
      </Modal>
      {dialog}
    </>
  );
}
