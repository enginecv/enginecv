"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
    AD_CONSENT_CHANGE_EVENT,
    CONSENT_STORAGE_KEY,
    readAdConsent,
    saveAdConsent,
    type AdConsent,
    type AdConsentChoice,
} from "@/lib/consent";

function subscribe(onChange: () => void) {
    const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === CONSENT_STORAGE_KEY) onChange();
    };
    window.addEventListener(AD_CONSENT_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
        window.removeEventListener(AD_CONSENT_CHANGE_EVENT, onChange);
        window.removeEventListener("storage", onStorage);
    };
}

// useSyncExternalStore needs a stable snapshot: re-parse only when the raw value changes.
let cachedRaw: string | null | undefined;
let cachedConsent: AdConsent | null = null;

function getSnapshot(): AdConsent | null {
    let raw: string | null = null;
    try {
        raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    } catch {
        raw = null;
    }
    if (raw !== cachedRaw) {
        cachedRaw = raw;
        cachedConsent = readAdConsent();
    }
    return cachedConsent;
}

/**
 * Current ad consent, re-rendering when it changes in this tab or another one.
 * `hydrated` is false during server rendering and the hydration pass, when the
 * stored decision cannot be known yet — nothing ad-related should render then.
 */
export function useAdConsent() {
    const consent = useSyncExternalStore(subscribe, getSnapshot, () => null);
    const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
    const decide = useCallback((ads: AdConsentChoice) => saveAdConsent(ads), []);
    return { consent, hydrated, decide };
}
