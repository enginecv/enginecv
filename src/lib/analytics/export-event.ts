import { EXPORT_FORMAT_IDS } from "@/lib/export-formats";

/**
 * One anonymous counter: "a CV export finished", with the file format and where
 * the visit came from. No cookie, no identifier, no resume content, no IP is
 * stored. Shared by the browser (send) and the route (validate).
 */

export const EXPORT_EVENT_ENDPOINT = "/api/e";
export const SOURCE_STORAGE_KEY = "enginecv:source";
export const UNKNOWN_SOURCE = "direct";
export const OTHER_SOURCE = "other";

const SOURCE_PATTERN = /^[a-z0-9][a-z0-9.-]{0,39}$/;

export interface ExportEvent {
    format: (typeof EXPORT_FORMAT_IDS)[number];
    source: string;
}

/** A short lowercase token (referral slug, utm_source or a host name), or null. */
export function normalizeSource(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const value = raw.trim().toLowerCase().replace(/^www\./, "");
    return SOURCE_PATTERN.test(value) ? value : null;
}

/** Validates an untrusted body; null means drop it. */
export function parseExportEvent(body: unknown): ExportEvent | null {
    if (typeof body !== "object" || body === null) return null;
    const { format, source } = body as Record<string, unknown>;
    if (typeof format !== "string" || !(EXPORT_FORMAT_IDS as readonly string[]).includes(format)) return null;
    return {
        format: format as ExportEvent["format"],
        source: normalizeSource(source) ?? (source === undefined || source === UNKNOWN_SOURCE ? UNKNOWN_SOURCE : OTHER_SOURCE),
    };
}

/** A click on a sponsored (partner) link: which link only, never who clicked. */
export interface AffiliateClick {
    id: string;
    source: string;
}

const LINK_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function parseAffiliateClick(body: unknown): AffiliateClick | null {
    if (typeof body !== "object" || body === null) return null;
    const { event, id, source } = body as Record<string, unknown>;
    if (event !== "affiliate_click" || typeof id !== "string" || !LINK_ID_PATTERN.test(id)) return null;
    return { id, source: normalizeSource(source) ?? (source === undefined || source === UNKNOWN_SOURCE ? UNKNOWN_SOURCE : OTHER_SOURCE) };
}

/** What the visitor's browser asks for: no measurement at all. */
function optedOut(): boolean {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

/**
 * Remembers where this visit came from, for the tab's lifetime only
 * (sessionStorage): `?ref=` from a referral link, else `?utm_source=`, else the
 * referring site's host name. Only the first one seen is kept.
 */
export function captureSource(): void {
    try {
        if (sessionStorage.getItem(SOURCE_STORAGE_KEY)) return;
        const params = new URLSearchParams(window.location.search);
        let source = normalizeSource(params.get("ref")) ?? normalizeSource(params.get("utm_source"));
        if (!source && document.referrer) {
            const host = new URL(document.referrer).hostname;
            if (host !== window.location.hostname) source = normalizeSource(host);
        }
        sessionStorage.setItem(SOURCE_STORAGE_KEY, source ?? UNKNOWN_SOURCE);
    } catch {
        // Storage or referrer unavailable: the source stays "direct".
    }
}

/** Fire and forget; never throws and never delays an export. */
export function reportExportCompleted(format: ExportEvent["format"]): void {
    send({ format });
}

/** Fire and forget; counts one click on a partner link, so earnings can be matched to traffic. */
export function reportAffiliateClick(id: string): void {
    send({ event: "affiliate_click", id });
}

function send(fields: Record<string, string>): void {
    try {
        if (typeof navigator === "undefined" || optedOut()) return;
        let source = UNKNOWN_SOURCE;
        try {
            source = sessionStorage.getItem(SOURCE_STORAGE_KEY) ?? UNKNOWN_SOURCE;
        } catch {
            // keep "direct"
        }
        const payload = JSON.stringify({ ...fields, source });
        if (!navigator.sendBeacon?.(EXPORT_EVENT_ENDPOINT, new Blob([payload], { type: "text/plain" }))) {
            void fetch(EXPORT_EVENT_ENDPOINT, { method: "POST", body: payload, keepalive: true, credentials: "omit" }).catch(() => undefined);
        }
    } catch {
        // Measurement is best-effort.
    }
}
