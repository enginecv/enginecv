"use client";

import { useTranslation } from "@/lib/i18n";

/** Shown only when the visitor's interface language is not English: the guide itself is English only. */
export function GuideLanguageNotice() {
    const { t, locale } = useTranslation();
    if (locale === "en") return null;

    return (
        <p
            role="note"
            data-testid="guide-english-only"
            className="mb-8 rounded-2xl border border-edge bg-surface-4 px-4 py-3 text-sm leading-6 text-strong"
        >
            {t("guides.englishOnly")}
        </p>
    );
}
