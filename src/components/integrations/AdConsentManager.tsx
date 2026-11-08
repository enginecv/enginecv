"use client";

import { useAdConsent } from "@/hooks/useAdConsent";
import { useTranslation } from "@/lib/i18n";

/**
 * Shows the stored ad decision and lets the visitor change it at any time.
 * Withdrawing reloads the page when the ad script was already loaded, because a
 * running AdSense script cannot be unloaded in place.
 */
export function AdConsentManager() {
    const { t } = useTranslation();
    const { consent, hydrated, decide } = useAdConsent();
    const status = consent?.ads ?? "unanswered";

    const withdraw = () => {
        const scriptLoaded = Boolean(document.getElementById("enginecv-adsense-src"));
        decide("denied");
        if (scriptLoaded) window.location.reload();
    };

    const message = status === "granted"
        ? t("adConsent.manageGranted")
        : status === "denied"
            ? t("adConsent.manageDenied")
            : t("adConsent.manageUnanswered");

    return (
        <div className="rounded-xl border border-edge bg-surface-4 p-4">
            <h3 className="text-sm font-semibold text-strong">{t("adConsent.manageTitle")}</h3>
            <p
                data-testid="ad-consent-status"
                data-status={hydrated ? status : "unknown"}
                role="status"
                className="mt-2 text-sm text-mid"
            >
                {hydrated ? message : null}
            </p>
            {hydrated ? (
                <div className="mt-3 flex flex-wrap gap-2">
                    {status !== "granted" ? (
                        <button
                            type="button"
                            data-testid="ad-consent-allow"
                            onClick={() => decide("granted")}
                            className="rounded-lg border border-edge bg-surface-1 px-4 py-2 text-sm font-medium text-strong transition-colors hover:border-faint"
                        >
                            {t("adConsent.allow")}
                        </button>
                    ) : null}
                    {status !== "denied" ? (
                        <button
                            type="button"
                            data-testid="ad-consent-withdraw"
                            onClick={withdraw}
                            className="rounded-lg border border-edge bg-surface-1 px-4 py-2 text-sm font-medium text-strong transition-colors hover:border-faint"
                        >
                            {t("adConsent.withdraw")}
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
