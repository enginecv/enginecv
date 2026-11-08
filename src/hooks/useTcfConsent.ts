"use client";

import { useEffect, useState } from "react";
import { isAdsConfigured } from "@/lib/ads";
import { subscribeTcfConsent } from "@/lib/tcf-consent";

export function useTcfConsent() {
    const [allowed, setAllowed] = useState(false);
    useEffect(() => {
        if (!isAdsConfigured()) return;
        return subscribeTcfConsent(setAllowed);
    }, []);
    return allowed;
}
