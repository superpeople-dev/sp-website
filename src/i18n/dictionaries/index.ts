import type { Locale } from "../config";
import type { Dictionary } from "../types";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { ja } from "./ja";
import { ko } from "./ko";
import { pt } from "./pt";
import { ru } from "./ru";
import { zh } from "./zh";

export const dictionaries: Record<Locale, Dictionary> = { en, fr, es, pt, de, ru, ja, ko, zh };

export const getDictionary = (locale: Locale) => dictionaries[locale];
