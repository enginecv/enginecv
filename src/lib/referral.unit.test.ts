import { describe, expect, it } from "vitest";
import {
    incrementReferralCount,
    listReferralCounts,
    normalizeReferralSlug,
    type ReferralKv,
} from "./referral";

function createMemoryKv(): ReferralKv {
    const store = new Map<string, string>();
    return {
        async get(key: string) {
            return store.get(key) ?? null;
        },
        async put(key: string, value: string) {
            store.set(key, value);
        },
        async list({ prefix }: { prefix: string }) {
            const keys = [...store.keys()]
                .filter((k) => k.startsWith(prefix))
                .map((name) => ({ name }));
            return { keys, list_complete: true };
        },
    };
}

describe("normalizeReferralSlug", () => {
    it("accepts lowercase alphanumeric and dash slugs", () => {
        expect(normalizeReferralSlug("safet")).toBe("safet");
        expect(normalizeReferralSlug("john-doe")).toBe("john-doe");
        expect(normalizeReferralSlug("user42")).toBe("user42");
    });

    it("lowercases and trims input", () => {
        expect(normalizeReferralSlug("  Safet  ")).toBe("safet");
        expect(normalizeReferralSlug("JOHN-DOE")).toBe("john-doe");
    });

    it("rejects empty, undefined, and whitespace-only values", () => {
        expect(normalizeReferralSlug("")).toBeNull();
        expect(normalizeReferralSlug(undefined)).toBeNull();
        expect(normalizeReferralSlug(null)).toBeNull();
        expect(normalizeReferralSlug("   ")).toBeNull();
    });

    it("rejects slugs starting with a dash", () => {
        expect(normalizeReferralSlug("-safet")).toBeNull();
    });

    it("rejects slugs longer than 32 characters", () => {
        expect(normalizeReferralSlug("a".repeat(33))).toBeNull();
        expect(normalizeReferralSlug("a".repeat(32))).toBe("a".repeat(32));
    });

    it("rejects slugs with disallowed characters", () => {
        expect(normalizeReferralSlug("john.doe")).toBeNull();
        expect(normalizeReferralSlug("john_doe")).toBeNull();
        expect(normalizeReferralSlug("john doe")).toBeNull();
        expect(normalizeReferralSlug("john/doe")).toBeNull();
        expect(normalizeReferralSlug("../etc")).toBeNull();
    });
});

describe("incrementReferralCount", () => {
    it("starts at 1 for a new slug", async () => {
        const kv = createMemoryKv();
        const next = await incrementReferralCount(kv, "safet");
        expect(next).toBe(1);
        expect(await kv.get("count:safet")).toBe("1");
    });

    it("increments existing counts", async () => {
        const kv = createMemoryKv();
        await incrementReferralCount(kv, "safet");
        await incrementReferralCount(kv, "safet");
        const third = await incrementReferralCount(kv, "safet");
        expect(third).toBe(3);
        expect(await kv.get("count:safet")).toBe("3");
    });

    it("tracks slugs independently", async () => {
        const kv = createMemoryKv();
        await incrementReferralCount(kv, "safet");
        await incrementReferralCount(kv, "john");
        await incrementReferralCount(kv, "safet");
        expect(await kv.get("count:safet")).toBe("2");
        expect(await kv.get("count:john")).toBe("1");
    });
});

describe("listReferralCounts", () => {
    it("returns empty when no counters exist", async () => {
        const kv = createMemoryKv();
        expect(await listReferralCounts(kv)).toEqual({});
    });

    it("returns all slug counts as numbers", async () => {
        const kv = createMemoryKv();
        await incrementReferralCount(kv, "safet");
        await incrementReferralCount(kv, "safet");
        await incrementReferralCount(kv, "john");
        expect(await listReferralCounts(kv)).toEqual({ safet: 2, john: 1 });
    });

    it("ignores unrelated keys outside the count prefix", async () => {
        const kv = createMemoryKv();
        await kv.put("count:safet", "5");
        await kv.put("other:key", "ignored");
        expect(await listReferralCounts(kv)).toEqual({ safet: 5 });
    });
});
