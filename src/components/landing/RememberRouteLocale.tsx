"use client";

import { useEffect } from "react";
import { useI18nStore } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Someone who opens "/de" wants German, so the app they open next should be
 * German too. Stores the route locale as the app language once hydrated.
 */
export function RememberRouteLocale({ locale }: { locale: Locale }) {
    const hydrated = useI18nStore((state) => state._hydrated);
    const setLocale = useI18nStore((state) => state.setLocale);

    useEffect(() => {
        // Remember entry into this route, without undoing a language-menu
        // choice while its navigation is still pending.
        if (hydrated && useI18nStore.getState().locale !== locale) setLocale(locale);
    }, [hydrated, locale, setLocale]);

    return null;
}
