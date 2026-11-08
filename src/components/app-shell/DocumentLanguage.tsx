"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useI18nStore } from "@/lib/i18n";
import { documentLocale } from "@/lib/i18n/locales";

/** One owner prevents nested translation consumers from racing over <html lang>. */
export function DocumentLanguage() {
    const pathname = usePathname() ?? "/";
    const storedLocale = useI18nStore((state) => state.locale);
    const locale = documentLocale(pathname, storedLocale);

    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    return null;
}
