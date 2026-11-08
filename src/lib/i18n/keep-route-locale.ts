"use client";

import { useCallback } from "react";
import { useI18nStore } from "@/lib/i18n";
import { useRouteLocale } from "@/lib/i18n/route-locale";

/**
 * The app (`/dashboard`, `/editor`) has no locale prefix and follows the stored
 * language. A visitor who opens it from a localized page ("/de/blog/...") wants
 * that page's language, so links into the app store it on the way. Readers who
 * never open the app keep whatever language they had.
 */
export function useKeepRouteLocale(): () => void {
    const routeLocale = useRouteLocale();
    const setLocale = useI18nStore((state) => state.setLocale);

    return useCallback(() => {
        if (routeLocale && useI18nStore.getState().locale !== routeLocale) setLocale(routeLocale);
    }, [routeLocale, setLocale]);
}
