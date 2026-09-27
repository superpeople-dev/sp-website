"use client";

export function loginHref(next: string) {
  return `/api/auth/discord?next=${encodeURIComponent(next)}`;
}

export function signIn(next: string) {
  window.location.assign(new URL(loginHref(next), window.location.href));
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
  window.location.reload();
}
