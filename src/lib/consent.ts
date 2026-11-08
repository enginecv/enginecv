import { z } from "zod";
import { isAdsConfigured } from "./ads";

/**
 * Ad consent is the only consent EngineCV asks for: the product runs no
 * analytics, and ads are the only feature that needs it. Nothing ad-related
 * may load until `canLoadAds` says so.
 */

export const CONSENT_STORAGE_KEY = "enginecv-consent";

/** Dispatched on `window` whenever the stored ad consent changes. */
export const AD_CONSENT_CHANGE_EVENT = "enginecv:consent-change";

export const adConsentSchema = z.object({
    version: z.literal(2),
    ads: z.enum(["granted", "denied"]),
    decidedAt: z.string(),
});

export type AdConsent = z.infer<typeof adConsentSchema>;
export type AdConsentChoice = AdConsent["ads"];

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

function browserStorage(): Storage | null {
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    } catch {
        return null;
    }
}

/** Stored consent, or null when unanswered (missing, malformed, or an older format). */
export function readAdConsent(storage: StorageReader | null = browserStorage()): AdConsent | null {
    if (!storage) return null;
    try {
        const raw = storage.getItem(CONSENT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = adConsentSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}

export function saveAdConsent(
    ads: AdConsentChoice,
    storage: StorageWriter | null = browserStorage(),
    now: Date = new Date(),
): AdConsent {
    const consent: AdConsent = { version: 2, ads, decidedAt: now.toISOString() };
    storage?.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(AD_CONSENT_CHANGE_EVENT, { detail: consent }));
    }
    return consent;
}

/** The single gate for the ad script, ad slots and anything else ad-related. */
export function canLoadAds(consent: AdConsent | null, adsConfigured: boolean = isAdsConfigured(), tcfAllowed = false): boolean {
    return adsConfigured && consent?.ads === "granted" && tcfAllowed;
}

/** Ask only when ads exist in this deployment and the visitor has not decided yet. */
export function shouldAskAdConsent(consent: AdConsent | null, adsConfigured: boolean = isAdsConfigured()): boolean {
    return adsConfigured && consent === null;
}

const LEGACY_COOKIE_NAMES = new Set(["_ga", "_gid", "enginecv_ref", "enginecv_ref_pending"]);

function isLegacyTrackingCookie(name: string): boolean {
    return LEGACY_COOKIE_NAMES.has(name) || name.startsWith("_ga_");
}

/** The host itself plus every parent domain an analytics script could have used. */
export function cookieDomainsFor(hostname: string): Array<string | null> {
    const domains: Array<string | null> = [null];
    const parts = hostname.split(".");
    for (let index = 0; index < parts.length - 1; index += 1) {
        domains.push(`.${parts.slice(index).join(".")}`);
    }
    return domains;
}

/**
 * Removes what earlier versions left behind: Google Analytics cookies, the
 * referral cookies and the old consent-mode value. Only first-party cookies
 * can be removed from page script; third-party cookies are up to the browser.
 */
export function purgeLegacyTracking(
    doc: Pick<Document, "cookie"> & { location: Pick<Location, "hostname"> } = document,
    storage: Pick<Storage, "getItem" | "removeItem"> | null = browserStorage(),
) {
    const names = doc.cookie
        .split(";")
        .map((part) => part.split("=")[0]?.trim() ?? "")
        .filter((name) => name && isLegacyTrackingCookie(name));

    for (const name of new Set(names)) {
        for (const domain of cookieDomainsFor(doc.location.hostname)) {
            doc.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}; SameSite=Lax`;
        }
    }

    if (storage && storage.getItem(CONSENT_STORAGE_KEY) !== null && readAdConsent(storage) === null) {
        storage.removeItem(CONSENT_STORAGE_KEY);
    }
}
