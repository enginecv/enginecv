"use client";

import Script from "next/script";
import { useAdConsent } from "@/hooks/useAdConsent";
import { useAdPageAllowed } from "@/hooks/useAdPageAllowed";
import { getCmpScriptSrc } from "@/lib/ads";
import { CMP_READY_EVENT } from "@/lib/tcf-consent";
import { useEffect, useRef } from "react";

/** Paste the certified provider's current TCF 2.3 bootstrap URL into build config. */
export function CmpScript() {
    const { consent, hydrated } = useAdConsent();
    const pageAllowed = useAdPageAllowed();
    const src = getCmpScriptSrc();
    const active = hydrated && pageAllowed && consent?.ads === "granted" && src !== null;
    const wasActive = useRef(false);
    useEffect(() => {
        if (wasActive.current && !active && document.getElementById("enginecv-cmp-src")) window.location.reload();
        wasActive.current = active;
    }, [active]);
    if (!active || !src) return null;
    return <Script
        id="enginecv-cmp-src"
        src={src}
        strategy="afterInteractive"
        onReady={() => { window.dispatchEvent(new Event(CMP_READY_EVENT)); }}
    />;
}
