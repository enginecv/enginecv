import { describe, expect, it } from "vitest";
import {
    cacheLookupOutcome,
    cacheSuggestionsOutcome,
    initialPreviewState,
    initialSuggestionsState,
    onInputChanged,
    onLookupResult,
    onSuggestionsNeeded,
    onSuggestionsResult,
    PREVIEW_MIN_LENGTH,
    type PreviewCache,
    type PreviewState,
    type SuggestionsCache,
    type SuggestionsState,
} from "./profile-preview";
import type { NormalizedProfile, ProfileSuggestion } from "./provider";

const octocat: NormalizedProfile = {
    username: "octocat",
    displayName: "The Octocat",
    bio: "",
    location: "",
    website: "",
    company: "",
    avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
    profileUrl: "https://github.com/octocat",
};

function loadingFor(target: string): PreviewState {
    return { status: "loading", target, profile: null };
}

describe("onInputChanged", () => {
    it("stays idle for empty input", () => {
        expect(onInputChanged(initialPreviewState, new Map(), "")).toEqual(initialPreviewState);
    });

    it("stays idle for input shorter than the minimum length", () => {
        expect(PREVIEW_MIN_LENGTH).toBe(3);
        expect(onInputChanged(initialPreviewState, new Map(), "a").status).toBe("idle");
        expect(onInputChanged(initialPreviewState, new Map(), "ab").status).toBe("idle");
        expect(onInputChanged(initialPreviewState, new Map(), "abc").status).toBe("loading");
    });

    it("stays idle for input that can never be a valid username", () => {
        expect(onInputChanged(initialPreviewState, new Map(), "bad input!").status).toBe("idle");
        expect(onInputChanged(initialPreviewState, new Map(), "-leading-dash").status).toBe("idle");
    });

    it("moves to loading for a valid new username on cache miss", () => {
        const next = onInputChanged(initialPreviewState, new Map(), "octocat");
        expect(next).toEqual(loadingFor("octocat"));
    });

    it("canonicalizes @handles and profile URLs before deciding", () => {
        expect(onInputChanged(initialPreviewState, new Map(), "@octocat")).toEqual(loadingFor("octocat"));
        expect(onInputChanged(initialPreviewState, new Map(), "https://github.com/octocat")).toEqual(
            loadingFor("octocat"),
        );
    });

    it("returns the same state for an unchanged target (no duplicate lookup)", () => {
        const loading = loadingFor("octocat");
        expect(onInputChanged(loading, new Map(), "octocat")).toBe(loading);

        const found: PreviewState = { status: "found", target: "octocat", profile: octocat };
        expect(onInputChanged(found, new Map(), "@octocat")).toBe(found);

        const notFound: PreviewState = { status: "not-found", target: "octocat", profile: null };
        expect(onInputChanged(notFound, new Map(), "octocat")).toBe(notFound);
    });

    it("re-attempts a lookup when the same target previously hit a silent error", () => {
        const silent: PreviewState = { status: "silent-error", target: "octocat", profile: null };
        expect(onInputChanged(silent, new Map(), "octocat")).toEqual(loadingFor("octocat"));
    });

    it("short-circuits to found on a cache hit without a lookup", () => {
        const cache: PreviewCache = new Map([["octocat", { status: "found", profile: octocat }]]);
        expect(onInputChanged(initialPreviewState, cache, "octocat")).toEqual({
            status: "found",
            target: "octocat",
            profile: octocat,
        });
    });

    it("short-circuits to not-found on a cache hit without a lookup", () => {
        const cache: PreviewCache = new Map([["ghost", { status: "not-found" }]]);
        expect(onInputChanged(initialPreviewState, cache, "ghost")).toEqual({
            status: "not-found",
            target: "ghost",
            profile: null,
        });
    });

    it("resets to idle when the input becomes invalid while a preview is showing", () => {
        const found: PreviewState = { status: "found", target: "octocat", profile: octocat };
        expect(onInputChanged(found, new Map(), "bad input!").status).toBe("idle");
    });
});

describe("onLookupResult", () => {
    it("applies a found result to the matching loading state", () => {
        const next = onLookupResult(loadingFor("octocat"), "octocat", { kind: "found", profile: octocat });
        expect(next).toEqual({ status: "found", target: "octocat", profile: octocat });
    });

    it("applies a not-found result to the matching loading state", () => {
        const next = onLookupResult(loadingFor("ghost"), "ghost", { kind: "not-found" });
        expect(next).toEqual({ status: "not-found", target: "ghost", profile: null });
    });

    it("maps rate-limited and network errors to silent-error", () => {
        expect(onLookupResult(loadingFor("octocat"), "octocat", { kind: "rate-limited" }).status).toBe(
            "silent-error",
        );
        expect(onLookupResult(loadingFor("octocat"), "octocat", { kind: "network" }).status).toBe(
            "silent-error",
        );
    });

    it("discards a stale result whose username no longer matches the target", () => {
        const loading = loadingFor("second");
        const next = onLookupResult(loading, "first", { kind: "found", profile: octocat });
        expect(next).toBe(loading);
    });

    it("ignores results when the state is not loading", () => {
        const idle = initialPreviewState;
        expect(onLookupResult(idle, "octocat", { kind: "found", profile: octocat })).toBe(idle);

        const found: PreviewState = { status: "found", target: "octocat", profile: octocat };
        expect(onLookupResult(found, "octocat", { kind: "not-found" })).toBe(found);
    });
});

const hits: ProfileSuggestion[] = [
    { login: "SafetImamovic", avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4" },
    { login: "safetch", avatarUrl: "" },
];

function searchingFor(query: string): SuggestionsState {
    return { status: "loading", query, suggestions: [] };
}

describe("onSuggestionsNeeded", () => {
    it("stays idle without a query and resets when the query goes away", () => {
        expect(onSuggestionsNeeded(initialSuggestionsState, new Map(), "")).toBe(initialSuggestionsState);
        const shown: SuggestionsState = { status: "shown", query: "safetimamovik", suggestions: hits };
        expect(onSuggestionsNeeded(shown, new Map(), "")).toBe(initialSuggestionsState);
    });

    it("moves to loading for a new query on cache miss", () => {
        expect(onSuggestionsNeeded(initialSuggestionsState, new Map(), "safetimamovik")).toEqual(
            searchingFor("safetimamovik"),
        );
    });

    it("returns the same state for an unchanged query", () => {
        const loading = searchingFor("safetimamovik");
        expect(onSuggestionsNeeded(loading, new Map(), "safetimamovik")).toBe(loading);
        const shown: SuggestionsState = { status: "shown", query: "safetimamovik", suggestions: hits };
        expect(onSuggestionsNeeded(shown, new Map(), "safetimamovik")).toBe(shown);
    });

    it("re-attempts after a silent error for the same query", () => {
        const silent: SuggestionsState = { status: "silent-error", query: "safetimamovik", suggestions: [] };
        expect(onSuggestionsNeeded(silent, new Map(), "safetimamovik")).toEqual(searchingFor("safetimamovik"));
    });

    it("short-circuits to shown on a cache hit, including cached empty results", () => {
        const cache: SuggestionsCache = new Map([
            ["safetimamovik", hits],
            ["zzz", []],
        ]);
        expect(onSuggestionsNeeded(initialSuggestionsState, cache, "safetimamovik")).toEqual({
            status: "shown",
            query: "safetimamovik",
            suggestions: hits,
        });
        expect(onSuggestionsNeeded(initialSuggestionsState, cache, "zzz")).toEqual({
            status: "shown",
            query: "zzz",
            suggestions: [],
        });
    });
});

describe("onSuggestionsResult", () => {
    it("applies results to the matching loading state", () => {
        const next = onSuggestionsResult(searchingFor("safetimamovik"), "safetimamovik", {
            kind: "found",
            suggestions: hits,
        });
        expect(next).toEqual({ status: "shown", query: "safetimamovik", suggestions: hits });
    });

    it("maps failures to silent-error", () => {
        expect(onSuggestionsResult(searchingFor("abc"), "abc", { kind: "error" }).status).toBe("silent-error");
    });

    it("discards stale results and ignores non-loading states", () => {
        const loading = searchingFor("second");
        expect(onSuggestionsResult(loading, "first", { kind: "found", suggestions: hits })).toBe(loading);
        expect(onSuggestionsResult(initialSuggestionsState, "abc", { kind: "error" })).toBe(
            initialSuggestionsState,
        );
    });
});

describe("cacheSuggestionsOutcome", () => {
    it("caches found results including empty lists, never failures", () => {
        const cache: SuggestionsCache = new Map();
        cacheSuggestionsOutcome(cache, "abc", { kind: "found", suggestions: hits });
        cacheSuggestionsOutcome(cache, "zzz", { kind: "found", suggestions: [] });
        cacheSuggestionsOutcome(cache, "err", { kind: "error" });
        expect(cache.get("abc")).toEqual(hits);
        expect(cache.get("zzz")).toEqual([]);
        expect(cache.has("err")).toBe(false);
    });
});

describe("cacheLookupOutcome", () => {
    it("caches found and not-found outcomes", () => {
        const cache: PreviewCache = new Map();
        cacheLookupOutcome(cache, "octocat", { kind: "found", profile: octocat });
        cacheLookupOutcome(cache, "ghost", { kind: "not-found" });
        expect(cache.get("octocat")).toEqual({ status: "found", profile: octocat });
        expect(cache.get("ghost")).toEqual({ status: "not-found" });
    });

    it("never caches transient failures", () => {
        const cache: PreviewCache = new Map();
        cacheLookupOutcome(cache, "octocat", { kind: "rate-limited" });
        cacheLookupOutcome(cache, "octocat", { kind: "network" });
        expect(cache.size).toBe(0);
    });
});
