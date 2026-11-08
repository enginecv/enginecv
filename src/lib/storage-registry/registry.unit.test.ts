import { describe, expect, it } from "vitest";
import { ENGINECV_DATABASE, STORAGE_REGISTRY, invisibleEntries, matchEntry } from "./registry";

describe("storage registry", () => {
    it("has unique ids", () => {
        const ids = STORAGE_REGISTRY.map((entry) => entry.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("matches exact names per location", () => {
        expect(matchEntry({ location: "local-storage", name: "enginecv-preferences" })?.id).toBe("ls.preferences");
        expect(matchEntry({ location: "cookie", name: "enginecv-locale" })?.id).toBe("cookie.locale");
        // Same name, other location: the old localStorage copy of the locale.
        expect(matchEntry({ location: "local-storage", name: "enginecv-locale" })?.id).toBe("legacy.locale");
    });

    it("matches tables only inside their database", () => {
        expect(matchEntry({ location: "indexeddb-table", name: "resumes", database: ENGINECV_DATABASE })?.id).toBe("idb.resumes");
        expect(matchEntry({ location: "indexeddb-table", name: "resumes", database: "Other" })).toBeNull();
    });

    it("matches name families by pattern", () => {
        expect(matchEntry({ location: "cookie", name: "_ga_ABC123" })?.id).toBe("legacy.ga");
        expect(matchEntry({ location: "cookie", name: "_gax" })).toBeNull();
    });

    it("returns null for unknown items", () => {
        expect(matchEntry({ location: "local-storage", name: "foo" })).toBeNull();
    });

    it("lists third-party cookies as invisible", () => {
        expect(invisibleEntries().map((entry) => entry.id)).toEqual(["cookie.cloudflare", "cookie.google"]);
    });
});
