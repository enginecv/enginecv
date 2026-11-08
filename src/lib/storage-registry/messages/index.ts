import { useEffect, useState } from "react";
import { useTranslation, type Locale } from "@/lib/i18n";
import { en } from "./en";

/*
 * The Your data texts load with the Your data page and the delete dialog
 * only. English is bundled with them; other languages arrive on demand, with
 * English standing in meanwhile (same approach as the main dictionaries).
 */

type Messages = Record<string, string>;
type Params = Record<string, string | number>;

const loaders: Record<Exclude<Locale, "en">, () => Promise<Messages>> = {
    bs: () => import("./bs").then((module) => module.bs),
    de: () => import("./de").then((module) => module.de),
    fr: () => import("./fr").then((module) => module.fr),
    es: () => import("./es").then((module) => module.es),
};

const loaded: Partial<Record<Locale, Messages>> = { en };

export function loadStorageMessages(locale: Locale): Promise<Messages> {
    const cached = loaded[locale];
    if (cached) return Promise.resolve(cached);
    return loaders[locale as Exclude<Locale, "en">]().then((messages) => {
        loaded[locale] = messages;
        return messages;
    });
}

/** Lookup with English fallback and the `.one` / `.other` plural convention of the main dictionaries. */
export function formatStorageMessage(messages: Messages, key: string, params?: Params): string {
    const count = params?.count == null ? null : Number(params.count);
    const pluralKey = count === null || !Number.isFinite(count) ? null : `${key}.${count === 1 ? "one" : "other"}`;
    const resolved = pluralKey && (messages[pluralKey] || en[pluralKey]) ? pluralKey : key;
    const text = messages[resolved] || en[resolved] || resolved;
    if (!params) return text;
    return Object.entries(params).reduce((out, [name, value]) => out.split(`{${name}}`).join(String(value)), text);
}

export type StorageTranslate = (key: string, params?: Params) => string;

export function useStorageMessages(): { ts: StorageTranslate; locale: Locale } {
    const { locale } = useTranslation();
    const [messages, setMessages] = useState<Messages>(() => loaded[locale] ?? en);

    useEffect(() => {
        let cancelled = false;
        loadStorageMessages(locale).then((next) => {
            if (!cancelled) setMessages(next);
        }).catch(() => {
            // Offline before the language chunk was cached: English stays.
        });
        return () => {
            cancelled = true;
        };
    }, [locale]);

    return { ts: (key, params) => formatStorageMessage(messages, key, params), locale };
}
