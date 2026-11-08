"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useI18nStore } from "@/lib/i18n";
import { isPrefixedLocale, localizedPath, type PrefixedLocale } from "@/lib/i18n/locales";
import { useRouteLocale } from "@/lib/i18n/route-locale";
import { useDictionary } from "@/lib/i18n/dictionaries";

const DISMISS_KEY = "enginecv-locale-suggestion-dismissed";

// Croatian and Serbian readers get the Bosnian page: the languages are close
// and there is no hr or sr version yet.
const BROWSER_LANGUAGE_MAP: Record<string, PrefixedLocale> = { hr: "bs", sr: "bs", sh: "bs" };

function browserLocale(): PrefixedLocale | null {
    for (const tag of navigator.languages ?? [navigator.language]) {
        const base = tag.toLowerCase().split("-")[0];
        if (isPrefixedLocale(base)) return base;
        if (BROWSER_LANGUAGE_MAP[base]) return BROWSER_LANGUAGE_MAP[base];
    }
    return null;
}

function readDismissed(): boolean {
    try {
        return Boolean(localStorage.getItem(DISMISS_KEY));
    } catch {
        // Storage blocked: still suggest, the dismissal just won't stick.
        return false;
    }
}

const noSubscription = () => () => {};

/**
 * On the English landing page, offers the page in the visitor's language.
 * It never redirects: crawlers and people who chose English stay on "/".
 */
export function LocaleSuggestion() {
    const routeLocale = useRouteLocale();
    const hydrated = useI18nStore((state) => state._hydrated);
    const storedLocale = useI18nStore((state) => state.locale);
    // Browser-only facts; the server snapshot renders nothing, so no mismatch.
    const browserSuggestion = useSyncExternalStore(noSubscription, browserLocale, () => null);
    const dismissedEarlier = useSyncExternalStore(noSubscription, readDismissed, () => true);
    const [dismissed, setDismissed] = useState(false);

    const suggested = routeLocale === "en" && hydrated && !dismissed && !dismissedEarlier
        ? (isPrefixedLocale(storedLocale) ? storedLocale : browserSuggestion)
        : null;

    // Loads the suggested language on its own; nothing shows until it arrives.
    const dictionary = useDictionary(suggested ?? "en");

    if (!suggested || !dictionary) return null;
    const copy = (key: string) => dictionary[key] ?? key;

    const dismiss = () => {
        setDismissed(true);
        try {
            localStorage.setItem(DISMISS_KEY, "1");
        } catch {
            // Storage blocked: hidden for this visit only.
        }
    };

    return (
        <div
            role="region"
            aria-label={copy("localeSuggestion.label")}
            lang={suggested}
            data-testid="locale-suggestion"
            className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap rounded-2xl border border-edge bg-surface-4 px-4 py-3 text-sm text-strong shadow-2xl"
        >
            <p className="min-w-0 basis-full sm:basis-auto sm:flex-1">{copy("localeSuggestion.message")}</p>
            <Link
                href={localizedPath("/", suggested)}
                data-testid="locale-suggestion-link"
                className="shrink-0 rounded-xl bg-accent px-3 py-1.5 font-medium text-surface-2 transition-colors hover:bg-accent-soft"
            >
                {copy("localeSuggestion.action")}
            </Link>
            <button
                type="button"
                onClick={dismiss}
                aria-label={copy("localeSuggestion.dismiss")}
                className="ml-auto flex h-8 w-8 shrink-0 items-center sm:ml-0 justify-center rounded-lg text-faint transition-colors hover:text-strong"
            >
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );
}
