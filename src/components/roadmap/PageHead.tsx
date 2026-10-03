import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";
import { Reveal } from "../motion";

export function PageHead({
  title,
  lead,
  notice,
  art,
  children,
}: {
  title: string;
  // Key art on the right, faded into the page (lib/art headArt).
  art?: StaticImageData;
  lead?: string;
  notice?: string | null;
  children?: ReactNode;
}) {
  return (
    <header className={art ? "page-head page-head--art" : "page-head"}>
      {art && (
        <div className="page-head__art" aria-hidden="true">
          <Image src={art} alt="" fill sizes="(max-width: 700px) 100vw, 70vw" priority />
        </div>
      )}
      <div className="wrap">
        <Reveal>
          <h1>{title}</h1>
          {lead && <p className="lead">{lead}</p>}
          {notice && <p className="page-head__notice">{notice}</p>}
          {children}
        </Reveal>
      </div>
    </header>
  );
}
