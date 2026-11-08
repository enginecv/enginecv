import { useEffect, useSyncExternalStore } from "react";
import { en } from "./en";
import type { Locale } from "./locales";

export type Translations = Record<string, string>;

/*
 * English ships with every page; the other dictionaries are about 120 KB each,
 * so they load on demand. A page under a locale URL ("/de") gets its
 * dictionary from the server through RouteLocaleProvider, so the server and
 * the first client render use the same language.
 */
const loaded: Partial<Record<Locale, Translations>> = { en };
const pending = new Map<Locale, Promise<void>>();
const listeners = new Set<() => void>();

const loaders: Record<Exclude<Locale, "en">, () => Promise<Translations>> = {
    bs: () => import("./bs").then((module) => module.bs),
    de: () => import("./de").then((module) => module.de),
    fr: () => import("./fr").then((module) => module.fr),
    es: () => import("./es").then((module) => module.es),
};

export function getDictionary(locale: Locale): Translations | undefined {
    return loaded[locale];
}

/**
 * Makes a dictionary available synchronously. `notify: false` is for callers
 * that register during render, before any reader of that locale renders.
 */
export function registerDictionary(locale: Locale, dictionary: Translations, { notify = true } = {}) {
    if (loaded[locale] === dictionary) return;
    loaded[locale] = dictionary;
    if (notify) listeners.forEach((listener) => listener());
}

export function loadDictionary(locale: Locale): Promise<void> {
    if (loaded[locale]) return Promise.resolve();
    const existing = pending.get(locale);
    if (existing) return existing;

    const load = loaders[locale as Exclude<Locale, "en">]()
        .then((dictionary) => registerDictionary(locale, dictionary))
        .finally(() => pending.delete(locale));
    pending.set(locale, load);
    return load;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** The dictionary for `locale`, loading it if needed; undefined until it arrives. */
export function useDictionary(locale: Locale): Translations | undefined {
    const dictionary = useSyncExternalStore(subscribe, () => loaded[locale], () => loaded[locale]);

    useEffect(() => {
        if (!dictionary) void loadDictionary(locale).catch(() => undefined);
    }, [dictionary, locale]);

    return dictionary;
}
