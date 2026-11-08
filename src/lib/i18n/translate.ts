import { en } from "./en";
import { bs } from "./bs";
import { de } from "./de";
import { fr } from "./fr";
import { es } from "./es";
import type { Locale } from "./locales";

const dictionaries: Record<Locale, Record<string, string>> = { en, bs, de, fr, es };

/**
 * A locale's full dictionary, for server components to hand to the client.
 * This module bundles every locale, so keep it out of client components.
 */
export function dictionaryFor(locale: Locale): Record<string, string> {
  return dictionaries[locale];
}

/** Server-safe lookup for metadata and other code outside React. Falls back to English. */
export function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const text = dictionaries[locale]?.[key] || en[key] || key;
  if (!params) return text;
  return Object.entries(params).reduce((out, [name, value]) => out.split(`{${name}}`).join(String(value)), text);
}
