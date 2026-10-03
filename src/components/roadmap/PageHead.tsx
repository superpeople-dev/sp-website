import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";
import { Reveal } from "../motion";

export function PageHead({
  title,
  lead,
  notice,
  art,
  variant,
  children,
}: {
  title: string;
  // Key art on the right, faded into the page (lib/art headArt).
  art?: StaticImageData;
  lead?: string;
  notice?: string | null;
  // "legal": the title and its date centered over the Terms and Privacy column.
  variant?: "legal";
  children?: ReactNode;
}) {
  return (
    <header className={["page-head", art && "page-head--art", variant && `page-head--${variant}`].filter(Boolean).join(" ")}>
      {art && (
        <div className="page-head__art" aria-hidden="true">
          <Image src={art} alt="" fill sizes="(max-width: 700px) 100vw, 70vw" priority quality={90} />
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
