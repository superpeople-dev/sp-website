"use client";

import { fill } from "@/i18n/config";
import { useI18n } from "@/i18n/context";
import { shownName, type Viewer } from "@/lib/board";
import { Avatar } from "../Avatar";
import { useConfirm } from "../ConfirmDialog";
import { Icon } from "../Icon";
import { AdminPanel } from "./AdminPanel";
import { NotificationBell } from "./NotificationBell";
import { loginHref, openSuggest, signOut } from "./viewer";

// suggest: the page has the Bugs & Ideas board, whose form "Suggest an idea" opens.
export function AccountBar({
  authReady,
  next,
  viewer,
  suggest = false,
}: {
  authReady: boolean;
  next: string;
  viewer: Viewer | null;
  suggest?: boolean;
}) {
  const { t } = useI18n();
  const [ask, dialog] = useConfirm();
  if (!authReady) return null;
  const name = viewer ? shownName(viewer.name, viewer.username) : "";

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
      <div className="account-bar__who">
        <Avatar className="account-bar__avatar" src={viewer.avatar} size={40} />
        {/* Desktop shows the sentence; phones show a small label over the name, so the name never gets cut. */}
        <span className="account-bar__id">
          <span className="account-bar__name">{fill(t.board.signedInAs, { name })}</span>
          <span className="account-bar__label">{t.board.signedIn}</span>
          <b className="account-bar__user">{name}</b>
          {viewer.admin && <span className="account-bar__badge">{t.board.admin}</span>}
        </span>
        <button
          type="button"
          className="account-bar__out"
          onClick={() => void confirmSignOut()}
          aria-label={t.board.signOut}
          title={t.board.signOut}
        >
          <Icon name="logout" />
          <span className="account-bar__out-label">{t.board.signOut}</span>
        </button>
      </div>
      <NotificationBell />
      {viewer.admin && <AdminPanel viewer={viewer} />}
      {suggest && !viewer.banned && !viewer.nameBlocked && (
        <button type="button" className="btn btn--primary btn--sm account-bar__suggest" onClick={openSuggest}>
          <Icon name="plus" />
          {t.ideas.formTitle}
        </button>
      )}
      {dialog}
    </div>
  );
}
