"use client";

export function loginHref(next: string) {
  return `/api/auth/discord?next=${encodeURIComponent(next)}`;
}

export function signIn(next: string) {
  window.location.assign(new URL(loginHref(next), window.location.href));
}

// "Suggest an idea" is in the account bar at the top of Bugs & Ideas (AccountBar), the form it opens
// in the board under it (IdeasBoard): the button announces it on the window, the board listens.
export const suggestEvent = "sp:suggest-idea";
export const openSuggest = () => window.dispatchEvent(new Event(suggestEvent));

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
  window.location.reload();
}
