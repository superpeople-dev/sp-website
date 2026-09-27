"use client";

import Image from "next/image";
import { fill } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { useConfirm } from "../ConfirmDialog";
import { Icon } from "../Icon";
import type { Viewer } from "@/lib/board";
import { BansButton } from "./Bans";
import { loginHref, signOut } from "./viewer";

export function AccountBar({ authReady, next, viewer }: { authReady: boolean; next: string; viewer: Viewer | null }) {
  const { t } = useI18n();
  const [ask, dialog] = useConfirm();
  if (!authReady) return null;

  const confirmSignOut = async () => {
    const ok = await ask({
      title: t.board.signOutTitle,
      body: t.board.signOutBody,
      confirm: t.board.signOutYes,
      cancel: t.board.cancel,
      icon: "logout",
      danger: true,
    });
    if (ok) await signOut();
  };

  if (!viewer) {
    return (
      <div className="account-bar">
        <a className="btn btn--discord btn--sm" href={loginHref(next)}>
          <Icon name="discord" />
          {t.board.signIn}
        </a>
      </div>
    );
  }

  return (
    <div className="account-bar">
      <Image className="account-bar__avatar" src={viewer.avatar} alt="" width={32} height={32} unoptimized />
      <span className="account-bar__name">{fill(t.board.signedInAs, { name: viewer.name })}</span>
      {viewer.admin && <span className="account-bar__badge">{t.board.admin}</span>}
      <button type="button" className="account-bar__out" onClick={() => void confirmSignOut()}>
        <Icon name="logout" />
        {t.board.signOut}
      </button>
      {viewer.canBan && <BansButton />}
      {dialog}
    </div>
  );
}
