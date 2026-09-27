"use client";

import { AnimatePresence, animate, motion, useMotionValue, type PanInfo } from "motion/react";
import Image, { type StaticImageData } from "next/image";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { fill } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { galleryImages } from "@/lib/site";
import { Icon } from "./Icon";
import { Reveal, ease, inView, stagger } from "./motion";

const tileSizes = (i: number) =>
  i === 0
    ? "(max-width: 700px) 84vw, (max-width: 1320px) 66vw, 880px"
    : "(max-width: 700px) 84vw, (max-width: 1320px) 33vw, 440px";

const viewSizes = "(max-width: 1422px) 90vw, 1280px";
const zoomSizes = "4096px";
const tapZoom = 2.5;
const maxZoom = 4;

const unveil = {
  hidden: { opacity: 0, clipPath: "inset(14% 14% 14% 14%)" },
  show: { opacity: 1, clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 1, ease } },
};

type Bounds = { left: number; right: number; top: number; bottom: number };
const noBounds: Bounds = { left: 0, right: 0, top: 0, bottom: 0 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const span = (size: number, center: number, extent: number) => {
  const a = size / 2 - center;
  const b = extent - center - size / 2;
  return [Math.min(a, b), Math.max(a, b)];
};

function Shot({
  src,
  alt,
  caption,
  index,
  count,
  onSwipe,
}: {
  src: StaticImageData;
  alt: string;
  caption: string;
  index: number;
  count: number;
  onSwipe: (delta: number) => void;
}) {
  const { t } = useI18n();
  const g = t.gallery;
  const [zoomed, setZoomed] = useState(false);
  const [bounds, setBounds] = useState<Bounds>(noBounds);
  const stage = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const level = useRef(1);
  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const zoomTo = (target: number, clientX: number, clientY: number, smooth: boolean) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return;
    const next = target < 1.02 ? 1 : target;
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const [left, right] = span(box.width * next, cx, window.innerWidth);
    const [top, bottom] = span(box.height * next, cy, window.innerHeight);
    const limits = next === 1 ? noBounds : { left, right, top, bottom };
    const px = clientX - (box.left + box.width / 2);
    const py = clientY - (box.top + box.height / 2);
    const k = next / scale.get();
    const nx = clamp(px - (px - x.get()) * k, limits.left, limits.right);
    const ny = clamp(py - (py - y.get()) * k, limits.top, limits.bottom);
    x.stop();
    y.stop();
    if (smooth) {
      const transition = { duration: 0.35, ease };
      animate(scale, next, transition);
      animate(x, nx, transition);
      animate(y, ny, transition);
    } else {
      scale.set(next);
      x.set(nx);
      y.set(ny);
    }
    level.current = next;
    setBounds(limits);
    setZoomed(next > 1);
  };

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (dragged.current) return;
    zoomTo(level.current > 1 ? 1 : tapZoom, e.clientX, e.clientY, true);
  };

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    zoomTo(clamp(scale.get() * Math.exp(-e.deltaY * 0.0015), 1, maxZoom), e.clientX, e.clientY, false);
  };

  const swipe = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60) onSwipe(1);
    else if (info.offset.x > 60) onSwipe(-1);
  };

  return (
    <>
      <div className="lightbox__stage" ref={stage} onWheel={onWheel}>
        <motion.div
          className={`lightbox__zoom${zoomed ? " is-zoomed" : ""}`}
          style={{ x, y, scale }}
          drag={zoomed ? true : "x"}
          dragConstraints={bounds}
          dragElastic={zoomed ? 0.05 : 0.5}
          dragMomentum={zoomed}
          onPointerDown={() => {
            dragged.current = false;
          }}
          onDragStart={() => {
            dragged.current = true;
          }}
          onDragEnd={zoomed ? undefined : swipe}
          onClick={onClick}
        >
          <Image src={src} alt={alt} sizes={zoomed ? zoomSizes : viewSizes} placeholder="blur" className="lightbox__img" draggable={false} />
        </motion.div>
      </div>
      <figcaption className={zoomed ? "is-hidden" : undefined}>
        {caption}
        <span>
          <span className="lightbox__hint lightbox__hint--mouse">{g.hintMouse}</span>
          <span className="lightbox__hint lightbox__hint--touch">{g.hintTouch}</span>
          {index + 1} / {count}
        </span>
      </figcaption>
    </>
  );
}

export function Gallery() {
  const { t } = useI18n();
  const g = t.gallery;
  const count = galleryImages.length;
  const [open, setOpen] = useState<number | null>(null);
  const isOpen = open !== null;

  const close = useCallback(() => setOpen(null), []);

  const go = useCallback(
    (delta: number) => setOpen((i) => (i === null ? i : (i + delta + count) % count)),
    [count],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, close, go]);

  const shot = open === null ? null : { src: galleryImages[open], ...g.items[open] };

  return (
    <section className="flush">
      <div className="wrap">
        <Reveal>
          <h2>{g.title}</h2>
        </Reveal>
        <motion.div className="gallery" {...inView} variants={stagger(0.09)}>
          {galleryImages.map((src, i) => (
            <motion.button
              key={src.src}
              type="button"
              className={`gallery__item g${i + 1}`}
              variants={unveil}
              onClick={() => setOpen(i)}
              aria-label={fill(g.enlarge, { caption: g.items[i].caption })}
            >
              <Image src={src} alt={g.items[i].alt} fill sizes={tileSizes(i)} placeholder="blur" />
              <span className="gallery__cap">{g.items[i].caption}</span>
            </motion.button>
          ))}
        </motion.div>
      </div>

      <AnimatePresence>
        {shot && open !== null && (
          <motion.div
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={shot.caption}
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.figure
                key={open}
                className="lightbox__figure"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.35, ease }}
              >
                <Shot
                  src={shot.src}
                  alt={shot.alt}
                  caption={shot.caption}
                  index={open}
                  count={count}
                  onSwipe={go}
                />
              </motion.figure>
            </AnimatePresence>

            <button type="button" className="lightbox__btn lightbox__close" onClick={close} aria-label={g.close} autoFocus>
              <Icon name="close" />
            </button>
            <button
              type="button"
              className="lightbox__btn lightbox__prev"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label={g.prev}
            >
              <Icon name="left" />
            </button>
            <button
              type="button"
              className="lightbox__btn lightbox__next"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label={g.next}
            >
              <Icon name="right" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
