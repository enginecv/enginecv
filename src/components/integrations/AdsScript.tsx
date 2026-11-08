"use client";

import Script from "next/script";
import { useAdConsent } from "@/hooks/useAdConsent";
import { adsConfig } from "@/lib/ads";
import { canLoadAds } from "@/lib/consent";
import { useTcfConsent } from "@/hooks/useTcfConsent";
import { useAdPageAllowed } from "@/hooks/useAdPageAllowed";
import { useEffect, useRef } from "react";

/** Loads the AdSense script only after the visitor granted ad consent. */
export function AdsScript() {
    const { consent, hydrated } = useAdConsent();
    const tcfAllowed = useTcfConsent();
    const pageAllowed = useAdPageAllowed();
    const allowed = hydrated && pageAllowed && canLoadAds(consent, undefined, tcfAllowed);
    const wasAllowed = useRef(false);

    useEffect(() => {
        // Removing a script element cannot stop a running third-party script.
        if (wasAllowed.current && !allowed && document.getElementById("enginecv-adsense-src")) {
            window.location.reload();
        }
        wasAllowed.current = allowed;
    }, [allowed]);

    if (!allowed) {
        return null;
    }

    return (
        <Script
            id="enginecv-adsense-src"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsConfig.client}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
        />
    );
}
