import { create } from "zustand";
import { useContext, useEffect } from "react";
import { en } from "./en";
import { useDictionary, type Translations } from "./dictionaries";
import { useClientPreferencesStore } from "../preferences/store";
import type { Locale } from "./locales";
import { RouteLocaleContext } from "./route-locale";

export type { Locale } from "./locales";

export type { Translations } from "./dictionaries";
type TranslationParams = Record<string, string | number>;

const LOCALE_COOKIE_KEY = "enginecv-locale";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  bs: "Bosanski",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
};

interface I18nState {
  locale: Locale;
  _hydrated: boolean;
  setLocale: (locale: Locale) => void;
  _hydrate: () => void;
}

function applyLocale(locale: Locale) {
  if (typeof window === "undefined") return;

  document.cookie = `${LOCALE_COOKIE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`;
  // DocumentLanguage owns <html lang>; a content URL can differ from this preference.
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: "en",
  _hydrated: false,
  setLocale: (locale) => {
    useClientPreferencesStore.getState().updateSection("appearance", { locale });
    applyLocale(locale);
    set({ locale });
  },
  _hydrate: () => {
    if (typeof window === "undefined") return;
    const preferencesStore = useClientPreferencesStore.getState();
    if (!preferencesStore.hydrated) preferencesStore.hydrate();
    const nextLocale = useClientPreferencesStore.getState().preferences.appearance.locale;
    applyLocale(nextLocale);
    set({ locale: nextLocale, _hydrated: true });
  },
}));

useClientPreferencesStore.subscribe((state, previous) => {
  const locale = state.preferences.appearance.locale;
  if (locale === previous.preferences.appearance.locale) return;
  applyLocale(locale);
  useI18nStore.setState({ locale, _hydrated: true });
});

function interpolate(str: string, params?: TranslationParams): string {
  if (!params) return str;

  let result = str;
  for (const [k, v] of Object.entries(params)) {
    result = result.replace(`{${k}}`, String(v));
  }
  return result;
}

function getCountParam(params?: TranslationParams): number | null {
  if (params?.count == null) return null;

  const count = Number(params.count);
  return Number.isFinite(count) ? count : null;
}

export function useTranslation() {
  const { locale: storedLocale, setLocale, _hydrated, _hydrate } = useI18nStore();
  // A locale URL ("/de") wins over the stored preference, so the server and
  // the client render the same language.
  const routeLocale = useContext(RouteLocaleContext);
  const locale = routeLocale ?? storedLocale;
  // English stands in until a lazily loaded dictionary arrives.
  const dictionary: Translations = useDictionary(locale) ?? en;

  useEffect(() => {
    if (!_hydrated) _hydrate();
  }, [_hydrated, _hydrate]);

  const t = (key: string, params?: TranslationParams): string => {
    const count = getCountParam(params);
    const pluralKey = count === null ? null : `${key}.${count === 1 ? "one" : "other"}`;
    const resolvedKey = pluralKey && (dictionary[pluralKey] || en[pluralKey])
      ? pluralKey
      : key;
    const str = dictionary[resolvedKey] || en[resolvedKey] || resolvedKey;
    return interpolate(str, params);
  };

  const tn = (key: string, count: number, params?: TranslationParams): string => {
    return t(key, { ...params, count });
  };

  return { t, tn, locale, setLocale };
}
