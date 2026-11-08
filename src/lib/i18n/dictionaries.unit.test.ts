import { beforeEach, describe, expect, it, vi } from "vitest";

// The test setup preloads every dictionary into the shared module instance;
// these tests need a fresh one to see the lazy behaviour.
async function freshDictionaries() {
    vi.resetModules();
    return import("./dictionaries");
}

describe("dictionaries", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("has English up front and nothing else", async () => {
        const { getDictionary } = await freshDictionaries();

        expect(getDictionary("en")?.["hero.startBuilding"]).toBeTruthy();
        expect(getDictionary("de")).toBeUndefined();
        expect(getDictionary("bs")).toBeUndefined();
    });

    it("loads a locale on demand, once, however often it is asked for", async () => {
        const { getDictionary, loadDictionary } = await freshDictionaries();

        const first = loadDictionary("de");
        const second = loadDictionary("de");
        expect(second).toBe(first);
        await first;

        const { de } = await import("./de");
        expect(getDictionary("de")).toBe(de);
        await expect(loadDictionary("de")).resolves.toBeUndefined();
    });

    it("uses a dictionary handed over by the server without loading it", async () => {
        const { getDictionary, registerDictionary } = await freshDictionaries();
        const messages = { "hero.startBuilding": "Los geht's" };

        registerDictionary("de", messages, { notify: false });

        expect(getDictionary("de")).toBe(messages);
    });
});
