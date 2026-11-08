"use client";

import Link from "next/link";
import { useAdConsent } from "@/hooks/useAdConsent";
import { isAdsConfigured } from "@/lib/ads";
import { shouldAskAdConsent } from "@/lib/consent";
import { useTranslation } from "@/lib/i18n";
import { useAdPageAllowed } from "@/hooks/useAdPageAllowed";

/**
 * Asks for ad consent when (and only when) this deployment has ads configured
 * and the visitor has not decided yet. Declining is as easy as accepting.
 * Rendered as a non-modal region so it never steals focus from the page.
 */
export function AdConsentPrompt() {
    const { t } = useTranslation();
    const { consent, hydrated, decide } = useAdConsent();
    const pageAllowed = useAdPageAllowed();

    if (!hydrated || !pageAllowed || !shouldAskAdConsent(consent, isAdsConfigured())) {
        return null;
    }

    return (
        <section
            data-testid="ad-consent-prompt"
            aria-labelledby="ad-consent-title"
            className="fixed inset-x-4 bottom-4 z-[150] mx-auto max-w-xl rounded-2xl border border-edge bg-surface-3 p-5 shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6"
        >
            <h2 id="ad-consent-title" className="text-sm font-semibold text-strong">
                {t("adConsent.title")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-mid">{t("adConsent.body")}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    data-testid="ad-consent-accept"
                    onClick={() => decide("granted")}
                    className="rounded-lg border border-edge bg-surface-1 px-4 py-2 text-sm font-medium text-strong transition-colors hover:border-faint"
                >
                    {t("adConsent.accept")}
                </button>
                <button
                    type="button"
                    data-testid="ad-consent-decline"
                    onClick={() => decide("denied")}
                    className="rounded-lg border border-edge bg-surface-1 px-4 py-2 text-sm font-medium text-strong transition-colors hover:border-faint"
                >
                    {t("adConsent.decline")}
                </button>
                <Link href="/cookies" className="ml-auto text-sm text-accent underline-offset-4 hover:underline">
                    {t("adConsent.learnMore")}
                </Link>
            </div>
        </section>
    );
}
