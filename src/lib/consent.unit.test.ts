import { describe, expect, it, vi } from "vitest";
import {
    AD_CONSENT_CHANGE_EVENT,
    CONSENT_STORAGE_KEY,
    canLoadAds,
    purgeLegacyTracking,
    readAdConsent,
    saveAdConsent,
    shouldAskAdConsent,
    type AdConsent,
} from "./consent";

function memoryStorage(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => void values.set(key, value),
        removeItem: (key: string) => void values.delete(key),
        values,
    };
}

/** Minimal cookie jar that honours Max-Age=0 deletions per name/domain. */
function fakeDocument(hostname: string, cookies: Array<{ name: string; domain?: string }>) {
    const jar = new Map(cookies.map((cookie) => [`${cookie.name}|${cookie.domain ?? ""}`, cookie]));
    const writes: string[] = [];
    return {
        location: { hostname },
        writes,
        jar,
        get cookie() {
            return [...jar.values()].map((cookie) => `${cookie.name}=x`).join("; ");
        },
        set cookie(value: string) {
            writes.push(value);
            const name = value.split("=")[0];
            const domain = /Domain=([^;]+)/.exec(value)?.[1] ?? "";
            if (/Max-Age=0/.test(value)) jar.delete(`${name}|${domain}`);
        },
    };
}

const granted: AdConsent = { version: 2, ads: "granted", decidedAt: "2026-09-16T00:00:00.000Z" };
const denied: AdConsent = { ...granted, ads: "denied" };

describe("readAdConsent", () => {
    it("reads a stored v2 decision", () => {
        const storage = memoryStorage({ [CONSENT_STORAGE_KEY]: JSON.stringify(granted) });
        expect(readAdConsent(storage)).toEqual(granted);
    });

    it("treats missing, malformed and v1 values as unanswered", () => {
        expect(readAdConsent(memoryStorage())).toBeNull();
        expect(readAdConsent(memoryStorage({ [CONSENT_STORAGE_KEY]: "{not json" }))).toBeNull();
        expect(readAdConsent(memoryStorage({
            [CONSENT_STORAGE_KEY]: JSON.stringify({
                analyticsStorage: "granted",
                adStorage: "granted",
                adUserData: "granted",
                adPersonalization: "granted",
            }),
        }))).toBeNull();
        expect(readAdConsent(memoryStorage({ [CONSENT_STORAGE_KEY]: JSON.stringify({ ...granted, ads: "maybe" }) }))).toBeNull();
    });

    it("treats unavailable storage as unanswered", () => {
        expect(readAdConsent(null)).toBeNull();
        const throwing = { getItem: () => { throw new Error("blocked"); } };
        expect(readAdConsent(throwing)).toBeNull();
    });
});

describe("saveAdConsent", () => {
    it("stores a v2 decision and announces the change", () => {
        const storage = memoryStorage();
        const listener = vi.fn();
        window.addEventListener(AD_CONSENT_CHANGE_EVENT, listener);

        const saved = saveAdConsent("denied", storage, new Date("2026-09-16T10:00:00.000Z"));

        expect(saved).toEqual({ version: 2, ads: "denied", decidedAt: "2026-09-16T10:00:00.000Z" });
        expect(readAdConsent(storage)).toEqual(saved);
        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener(AD_CONSENT_CHANGE_EVENT, listener);
    });
});

describe("ad consent gate", () => {
    it.each([
        [true, granted, true],
        [true, denied, false],
        [true, null, false],
        [false, granted, false],
        [false, null, false],
    ] as const)("ads configured=%s, consent=%j → canLoadAds=%s", (configured, consent, expected) => {
        expect(canLoadAds(consent, configured, true)).toBe(expected);
    });

    it("never treats the legacy local preference as certified CMP consent", () => {
        expect(canLoadAds(granted, true)).toBe(false);
        expect(canLoadAds(granted, true, false)).toBe(false);
        expect(canLoadAds(denied, true, true)).toBe(false);
    });

    it("asks only when ads are configured and nothing was decided", () => {
        expect(shouldAskAdConsent(null, true)).toBe(true);
        expect(shouldAskAdConsent(granted, true)).toBe(false);
        expect(shouldAskAdConsent(denied, true)).toBe(false);
        expect(shouldAskAdConsent(null, false)).toBe(false);
    });
});

describe("purgeLegacyTracking", () => {
    it("expires analytics and referral cookies on the host and its parent domains", () => {
        const doc = fakeDocument("www.enginecv.app", [
            { name: "_ga", domain: ".enginecv.app" },
            { name: "_ga_ABC123", domain: ".enginecv.app" },
            { name: "_gid", domain: ".enginecv.app" },
            { name: "enginecv_ref" },
            { name: "enginecv_ref_pending" },
            { name: "enginecv-locale" },
        ]);

        purgeLegacyTracking(doc, memoryStorage());

        expect([...doc.jar.values()].map((cookie) => cookie.name)).toEqual(["enginecv-locale"]);
        expect(doc.writes.some((write) => write.startsWith("enginecv-locale="))).toBe(false);
    });

    it("removes a v1 consent value but keeps a v2 decision", () => {
        const v1 = memoryStorage({ [CONSENT_STORAGE_KEY]: JSON.stringify({ analyticsStorage: "granted" }) });
        purgeLegacyTracking(fakeDocument("localhost", []), v1);
        expect(v1.values.has(CONSENT_STORAGE_KEY)).toBe(false);

        const v2 = memoryStorage({ [CONSENT_STORAGE_KEY]: JSON.stringify(denied) });
        purgeLegacyTracking(fakeDocument("localhost", []), v2);
        expect(readAdConsent(v2)).toEqual(denied);
    });
});
