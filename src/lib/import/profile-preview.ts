import { canonicalizeGithubInput } from "./canonicalize";
import type { ImportErrorKind, NormalizedProfile, ProfileSuggestion } from "./provider";

/** Pause after the last keystroke before a preview lookup may fire. */
export const PREVIEW_DEBOUNCE_MS = 500;
/** Canonical usernames shorter than this never trigger a lookup. */
export const PREVIEW_MIN_LENGTH = 3;

export type PreviewStatus = "idle" | "loading" | "found" | "not-found" | "silent-error";

export interface PreviewState {
    status: PreviewStatus;
    /** Canonical username this state refers to; "" when idle. */
    target: string;
    /** Only set when status === "found". */
    profile: NormalizedProfile | null;
}

export type LookupResult = { kind: "found"; profile: NormalizedProfile } | { kind: ImportErrorKind };

export type CachedOutcome =
    | { status: "found"; profile: NormalizedProfile }
    | { status: "not-found" };

/** Session-scoped memo of definitive outcomes, keyed by canonical username. */
export type PreviewCache = Map<string, CachedOutcome>;

export const initialPreviewState: PreviewState = { status: "idle", target: "", profile: null };

/**
 * Decide the next preview state for new raw input. Pure — no I/O, no timers;
 * the caller owns debouncing and must start a lookup for `target` whenever
 * this returns a loading state that differs from the previous one.
 */
export function onInputChanged(
    state: PreviewState,
    cache: PreviewCache,
    rawInput: string,
): PreviewState {
    const target = canonicalizeGithubInput(rawInput);
    if (!target || target.length < PREVIEW_MIN_LENGTH) {
        return state.status === "idle" ? state : initialPreviewState;
    }

    // Same target already being looked up or resolved: keep it. A silent
    // error is deliberately not sticky — retyping the same name retries.
    if (target === state.target && state.status !== "idle" && state.status !== "silent-error") {
        return state;
    }

    const cached = cache.get(target);
    if (cached) {
        return cached.status === "found"
            ? { status: "found", target, profile: cached.profile }
            : { status: "not-found", target, profile: null };
    }

    return { status: "loading", target, profile: null };
}

/**
 * Apply a lookup outcome. Stale-safe: results for a username other than the
 * current loading target are discarded without a transition.
 */
export function onLookupResult(
    state: PreviewState,
    username: string,
    result: LookupResult,
): PreviewState {
    if (state.status !== "loading" || state.target !== username) return state;

    if (result.kind === "found") {
        return { status: "found", target: username, profile: result.profile };
    }
    if (result.kind === "not-found") {
        return { status: "not-found", target: username, profile: null };
    }
    return { status: "silent-error", target: username, profile: null };
}

/** Record a definitive outcome. Transient failures are never cached so retries stay possible. */
export function cacheLookupOutcome(cache: PreviewCache, username: string, result: LookupResult): void {
    if (result.kind === "found") {
        cache.set(username, { status: "found", profile: result.profile });
    } else if (result.kind === "not-found") {
        cache.set(username, { status: "not-found" });
    }
}

// ---------------------------------------------------------------------------
// Typo suggestions (US4): a user search fired only after an exact lookup
// missed. Same stale-rejection and session-cache patterns as the preview.
// ---------------------------------------------------------------------------

export interface SuggestionsState {
    status: "idle" | "loading" | "shown" | "silent-error";
    /** Query (the 404'd canonical username) this state refers to; "" when idle. */
    query: string;
    /** Only non-empty when status === "shown". */
    suggestions: ProfileSuggestion[];
}

export type SuggestionsResult = { kind: "found"; suggestions: ProfileSuggestion[] } | { kind: "error" };

/** Session-scoped memo of completed searches, keyed by query. */
export type SuggestionsCache = Map<string, ProfileSuggestion[]>;

export const initialSuggestionsState: SuggestionsState = { status: "idle", query: "", suggestions: [] };

/**
 * Decide the next suggestions state when the preview resolved not-found for
 * `query` (pass "" when the preview left the not-found state). Pure; the
 * caller must start a search whenever this returns a new loading state.
 */
export function onSuggestionsNeeded(
    state: SuggestionsState,
    cache: SuggestionsCache,
    query: string,
): SuggestionsState {
    if (!query) {
        return state.status === "idle" ? state : initialSuggestionsState;
    }
    if (query === state.query && state.status !== "idle" && state.status !== "silent-error") {
        return state;
    }

    const cached = cache.get(query);
    if (cached) return { status: "shown", query, suggestions: cached };

    return { status: "loading", query, suggestions: [] };
}

/** Apply a search outcome. Stale-safe like onLookupResult. */
export function onSuggestionsResult(
    state: SuggestionsState,
    query: string,
    result: SuggestionsResult,
): SuggestionsState {
    if (state.status !== "loading" || state.query !== query) return state;

    if (result.kind === "found") {
        return { status: "shown", query, suggestions: result.suggestions };
    }
    return { status: "silent-error", query, suggestions: [] };
}

/** Record a completed search (including empty results). Failures are never cached. */
export function cacheSuggestionsOutcome(
    cache: SuggestionsCache,
    query: string,
    result: SuggestionsResult,
): void {
    if (result.kind === "found") cache.set(query, result.suggestions);
}
