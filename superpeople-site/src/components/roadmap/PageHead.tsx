import type { ReactNode } from "react";
import { Reveal } from "../motion";

export function PageHead({
  title,
  lead,
  notice,
  children,
}: {
  title: string;
  lead?: string;
  notice?: string | null;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
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
