"use client";

import { createContext, useContext, type ReactNode } from "react";
import { registerDictionary, type Translations } from "./dictionaries";
import type { Locale } from "./locales";

// A page served under a locale URL ("/de") renders in that locale on the server
// and the client, whatever language the visitor stored for the app.
export const RouteLocaleContext = createContext<Locale | null>(null);

/**
 * `messages` is the locale's dictionary, sent by the server for non-English
 * locale URLs. Registering it while rendering, before any child reads it,
 * lets the first client render match the server HTML.
 */
export function RouteLocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages?: Translations;
  children: ReactNode;
}) {
  if (messages) registerDictionary(locale, messages, { notify: false });
  return <RouteLocaleContext.Provider value={locale}>{children}</RouteLocaleContext.Provider>;
}

/** The locale fixed by the URL, or null on pages that follow the stored preference. */
export function useRouteLocale(): Locale | null {
  return useContext(RouteLocaleContext);
}

const LanguageLinksContext = createContext<Record<Locale, string> | null>(null);

/**
 * Where the language switcher should go for each locale, for pages whose
 * address differs by more than the prefix (a blog post has a slug per language).
 */
export function LanguageLinksProvider({ links, children }: { links: Record<Locale, string>; children: ReactNode }) {
  return <LanguageLinksContext.Provider value={links}>{children}</LanguageLinksContext.Provider>;
}

/** Page-provided language switcher targets, or null to swap the URL prefix. */
export function useLanguageLinks(): Record<Locale, string> | null {
  return useContext(LanguageLinksContext);
}
