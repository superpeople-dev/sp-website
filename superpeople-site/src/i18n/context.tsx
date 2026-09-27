"use client";

import { createContext, use, type ReactNode } from "react";
import type { Locale } from "./config";
import type { Dictionary } from "./types";

type I18n = { locale: Locale; t: Dictionary };

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ locale, t, children }: I18n & { children: ReactNode }) {
  return <I18nContext value={{ locale, t }}>{children}</I18nContext>;
}

export function useI18n() {
  const value = use(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
