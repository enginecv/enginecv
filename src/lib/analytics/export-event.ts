import { EXPORT_FORMAT_IDS } from "@/lib/export-formats";
import { DEFAULT_LOCALE, PREFIXED_LOCALES } from "@/lib/i18n/locales";

/**
 * One anonymous counter: "a CV export finished", with the file format and where
 * the visit came from. No cookie, no identifier, no resume content, no IP is
 * stored. Shared by the browser (send) and the route (validate).
 */

export const EXPORT_EVENT_ENDPOINT = "/api/e";
export const SOURCE_STORAGE_KEY = "enginecv:source";
export const UNKNOWN_SOURCE = "direct";
export const OTHER_SOURCE = "other";
export const LANDING_STORAGE_KEY = "enginecv:landing";
export const TEMPLATE_STORAGE_KEY = "enginecv:template";
export const DEFAULT_TEMPLATE = "default";
export const NO_ROLE = "none";

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

/**
 * Coarse, non-identifying context sent with an export: which page the visit began
 * on, which language the site was in, which built-in template, mobile or desktop.
 * Every field is reduced to a short allow-listed token; anything else becomes
 * "other", so nothing free-form (and no resume content) can be stored.
 */
export interface ExportContext {
    locale: string;
    template: string;
    landing: string;
    role: string;
    device: "mobile" | "desktop" | "unknown";
}

const LOCALES: readonly string[] = [DEFAULT_LOCALE, ...PREFIXED_LOCALES];
const LOCALE_PREFIX = /^\/(?:de|bs|fr|es)(?=\/|$)/;
const SEGMENT_PATTERN = /^[a-z0-9-]{1,60}$/;
const TEMPLATE_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** Routes whose second segment is a private id: only the route itself is kept. */
const PRIVATE_ROOTS = new Set(["editor", "dashboard", "internal"]);

/** "/de/cv-examples/nurse?x=1" -> "/cv-examples/nurse"; ids and odd paths are dropped or truncated. */
export function normalizeLandingPath(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const path = raw.split(/[?#]/)[0].toLowerCase().replace(LOCALE_PREFIX, "");
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) return "/";
    if (segments.length > 2 || !segments.every((segment) => SEGMENT_PATTERN.test(segment))) return null;
    if (PRIVATE_ROOTS.has(segments[0])) return `/${segments[0]}`;
    return `/${segments.join("/")}`;
}

/** The role example slug when the visit began on one, else "none". */
export function roleFromLanding(landing: string): string {
    return /^\/cv-examples\/([a-z0-9-]+)$/.exec(landing)?.[1] ?? NO_ROLE;
}

export function parseExportContext(body: unknown): ExportContext {
    const { locale, template, landing, device } = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
    const page = normalizeLandingPath(landing);
    return {
        locale: typeof locale === "string" && LOCALES.includes(locale) ? locale : OTHER_SOURCE,
        template: typeof template === "string" && TEMPLATE_PATTERN.test(template) ? template : template === undefined ? DEFAULT_TEMPLATE : OTHER_SOURCE,
        landing: page ?? (landing === undefined ? "unknown" : OTHER_SOURCE),
        role: page ? roleFromLanding(page) : NO_ROLE,
        device: device === "mobile" || device === "desktop" ? device : "unknown",
    };
}

/** Two capital letters from Cloudflare's edge, else "xx". The IP itself is never read. */
export function normalizeCountry(raw: unknown): string {
    return typeof raw === "string" && /^[A-Z]{2}$/.test(raw) ? raw.toLowerCase() : "xx";
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

/** A thumbs up or down on a finished export: which format and which way, never who or why. */
export const EXPORT_RATINGS = ["up", "down"] as const;
export type ExportRatingValue = (typeof EXPORT_RATINGS)[number];

export interface ExportRating {
    rating: ExportRatingValue;
    format: ExportEvent["format"];
    source: string;
}

export function parseExportRating(body: unknown): ExportRating | null {
    if (typeof body !== "object" || body === null) return null;
    const { event, rating, format, source } = body as Record<string, unknown>;
    if (event !== "export_rating") return null;
    if (typeof rating !== "string" || !(EXPORT_RATINGS as readonly string[]).includes(rating)) return null;
    if (typeof format !== "string" || !(EXPORT_FORMAT_IDS as readonly string[]).includes(format)) return null;
    return {
        rating: rating as ExportRatingValue,
        format: format as ExportRating["format"],
        source: normalizeSource(source) ?? (source === undefined || source === UNKNOWN_SOURCE ? UNKNOWN_SOURCE : OTHER_SOURCE),
    };
}

/** Longest optional comment kept, in characters. */
export const MAX_COMMENT_LENGTH = 280;

/**
 * Tidies an optional free-text comment: whitespace collapsed, capped, and anything
 * that looks like an email address, a link or a long number (phone, id) removed,
 * since people sometimes paste those. Null when nothing is left.
 */
export function normalizeComment(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const text = raw
        .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[removed]")
        .replace(/(?:https?:\/\/|www\.)\S+/gi, "[removed]")
        .replace(/\+?\d[\d\s().-]{6,}\d/g, "[removed]")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_COMMENT_LENGTH);
    return text === "" ? null : text;
}

/** The optional words that follow a thumbs answer: same fields as the rating, plus the text. */
export interface ExportComment extends ExportRating {
    comment: string;
}

export function parseExportComment(body: unknown): ExportComment | null {
    if (typeof body !== "object" || body === null) return null;
    const { event, comment } = body as Record<string, unknown>;
    if (event !== "export_comment") return null;
    const rating = parseExportRating({ ...body, event: "export_rating" });
    const text = normalizeComment(comment);
    return rating && text ? { ...rating, comment: text } : null;
}

/** What the visitor's browser asks for: no measurement at all. */
export function optedOut(): boolean {
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

/** Remembers the first page of this tab (path only, no query), for the tab's lifetime. */
export function captureLanding(): void {
    try {
        if (sessionStorage.getItem(LANDING_STORAGE_KEY)) return;
        const landing = normalizeLandingPath(window.location.pathname);
        if (landing) sessionStorage.setItem(LANDING_STORAGE_KEY, landing);
    } catch {
        // Storage unavailable: the landing page stays unknown.
    }
}

/** Notes the last built-in template applied in this tab. Custom templates are never recorded. */
export function rememberTemplate(templateId: string): void {
    try {
        if (TEMPLATE_PATTERN.test(templateId)) sessionStorage.setItem(TEMPLATE_STORAGE_KEY, templateId);
    } catch {
        // Storage unavailable: the template stays "default".
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

/** Fire and forget; records one optional thumbs up or down for an export. */
export function reportExportRating(rating: ExportRatingValue, format: ExportEvent["format"]): void {
    send({ event: "export_rating", rating, format });
}

/** Fire and forget; sends the optional words after a thumbs answer. Empty text sends nothing. */
export function reportExportComment(rating: ExportRatingValue, format: ExportEvent["format"], comment: string): void {
    const text = normalizeComment(comment);
    if (text) send({ event: "export_comment", rating, format, comment: text });
}

function exportContext(): Record<string, string> {
    const context: Record<string, string> = { locale: document.documentElement.lang.slice(0, 2).toLowerCase() };
    try {
        const landing = sessionStorage.getItem(LANDING_STORAGE_KEY);
        const template = sessionStorage.getItem(TEMPLATE_STORAGE_KEY);
        if (landing) context.landing = landing;
        if (template) context.template = template;
    } catch {
        // keep the defaults
    }
    context.device = window.matchMedia?.("(pointer: coarse)")?.matches ? "mobile" : "desktop";
    return context;
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
        const payload = JSON.stringify({ ...fields, source, ...(fields.event ? {} : exportContext()) });
        if (!navigator.sendBeacon?.(EXPORT_EVENT_ENDPOINT, new Blob([payload], { type: "text/plain" }))) {
            void fetch(EXPORT_EVENT_ENDPOINT, { method: "POST", body: payload, keepalive: true, credentials: "omit" }).catch(() => undefined);
        }
    } catch {
        // Measurement is best-effort.
    }
}
