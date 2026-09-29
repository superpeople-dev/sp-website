import Image from "next/image";
import { fill } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { mediaLimits } from "@/lib/site";
import { Icon } from "../Icon";

// Images and videos on an idea or task: picking them (the idea form, the admin edit form), uploading
// them and their thumbnails.

export const isVideo = (type: string) => type.startsWith("video/");

// Of the files picked, those of an allowed type and size, up to `room` of them; error says why one was
// left out.
export function pickFiles(list: FileList, room: number, r: Dictionary["ideas"]) {
  const picked: File[] = [];
  let error: string | null = null;
  for (const file of Array.from(list)) {
    if (picked.length >= room) break;
    if (!mediaLimits.types.includes(file.type)) {
      error = fill(r.mediaType, { name: file.name });
      continue;
    }
    if (file.size > (isVideo(file.type) ? mediaLimits.video : mediaLimits.image)) {
      error = fill(r.mediaTooBig, { name: file.name });
      continue;
    }
    picked.push(file);
  }
  return { picked, error };
}

// One file onto an item (app/api/roadmap/media): an upload address, the file itself, then saving it on
// the item.
export async function uploadMedia(feedbackId: string, file: File) {
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

// A square thumbnail in a .media-picks list: the picture, or a video's first frame with a play mark.
export function MediaThumb({ url, type }: { url: string; type: string }) {
  if (!isVideo(type)) return <Image src={url} alt="" width={160} height={120} unoptimized />;
  return (
    <>
      <video src={url} muted playsInline preload="metadata" />
      <span className="media-picks__play" aria-hidden="true">
        <Icon name="play" />
      </span>
    </>
  );
}
