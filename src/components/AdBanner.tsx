"use client";

import { useEffect, useMemo } from "react";
import { useAdConsent } from "@/hooks/useAdConsent";
import { useTcfConsent } from "@/hooks/useTcfConsent";
import { useAdPageAllowed } from "@/hooks/useAdPageAllowed";
import { getAdSlotDefinition, type AdSlotName } from "@/lib/ads";
import { canLoadAds } from "@/lib/consent";
import { useTranslation } from "@/lib/i18n";

interface AdBannerProps {
    className?: string;
    slot: AdSlotName;
}

export function AdBanner({ className = "", slot }: AdBannerProps) {
    const { t } = useTranslation();
    const { consent, hydrated } = useAdConsent();
    const tcfAllowed = useTcfConsent();
    const pageAllowed = useAdPageAllowed();
    // No slot (not even the development placeholder) without ad consent.
    const slotConfig = useMemo(() => hydrated && pageAllowed && canLoadAds(consent, undefined, tcfAllowed)
        ? getAdSlotDefinition(slot) : null, [hydrated, pageAllowed, consent, tcfAllowed, slot]);

    useEffect(() => {
        if (!slotConfig) {
            return;
        }

        try {
            window.adsbygoogle = window.adsbygoogle || [];
            window.adsbygoogle.push({});
        } catch {
            // Ignore AdSense bootstrap errors until slots are configured for a real deployment.
        }
    }, [slotConfig]);

    if (!slotConfig) {
        return null;
    }

    const isResponsive = slotConfig.format === "responsive";
    const slotStyle = isResponsive
        ? { display: "block", width: "100%" }
        : {
            display: "inline-block",
            width: `${slotConfig.width}px`,
            height: `${slotConfig.height}px`,
        };

    // AdSense never serves on localhost and ignores placeholder publisher IDs, so
    // the real <ins> collapses to zero height during development. Render a visible
    // placeholder that reserves the slot's footprint instead.
    if (process.env.NODE_ENV !== "production") {
        return (
            <div
                className={`flex items-center justify-center ${className}`}
                aria-label={t("ad.advertisement")}
            >
                <div
                    className="flex items-center justify-center rounded-xl border border-dashed border-edge bg-surface-4 text-[10px] font-medium uppercase tracking-wider text-faint"
                    style={isResponsive ? { width: "100%", height: 90 } : { width: slotConfig.width, height: slotConfig.height }}
                >
                    {t("ad.advertisement")} · {slot}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex items-center justify-center ${className}`}
            aria-label={t("ad.advertisement")}
        >
            <ins
                className="adsbygoogle overflow-hidden rounded-xl"
                style={slotStyle}
                data-ad-client={slotConfig.client}
                data-ad-slot={slotConfig.slotId}
                data-ad-format={isResponsive ? "auto" : undefined}
                data-full-width-responsive={isResponsive ? "true" : undefined}
            />
        </div>
    );
}
