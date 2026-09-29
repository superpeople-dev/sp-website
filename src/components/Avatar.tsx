"use client";

import Image from "next/image";
import { useState, type SyntheticEvent } from "react";

// Discord's own default picture (its logo on a colour), chosen from the user id the way Discord does.
// The id comes from the picture's URL (cdn.discordapp.com/avatars/<id>/…) when we don't have it.
function defaultAvatar(src?: string) {
  const id = src?.match(/\/avatars\/(\d+)\//)?.[1];
  const index = id ? Number((BigInt(id) >> BigInt(22)) % BigInt(6)) : 0;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

// Some people set a fully transparent picture. It is drawn on a small canvas once loaded (Discord's
// CDN allows it) and swapped for the default picture when no pixel shows; same when it fails to load.
function isBlank(img: HTMLImageElement) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(img, 0, 0, 16, 16);
    const { data } = context.getImageData(0, 0, 16, 16);
    for (let i = 3; i < data.length; i += 4) if (data[i] > 8) return false;
    return true;
  } catch {
    return false;
  }
}

// blank: always Discord's default picture (a banned user's).
export function Avatar({ src, size, className = "avatar", blank }: { src?: string; size: number; className?: string; blank?: boolean }) {
  const [broken, setFallback] = useState(!src);
  const fallback = broken || blank === true;
  const onLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    if (!fallback && isBlank(event.currentTarget)) setFallback(true);
  };
  return (
    <Image
      className={className}
      src={fallback ? defaultAvatar(src) : (src ?? "")}
      alt=""
      width={size}
      height={size}
      crossOrigin="anonymous"
      unoptimized
      onLoad={onLoad}
      onError={() => setFallback(true)}
    />
  );
}
