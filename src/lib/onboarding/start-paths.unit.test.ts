import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/en";
import { START_PATH_IDS, START_PATHS, isStartPathId } from "./start-paths";

describe("START_PATHS", () => {
    it("lists every start path once, in the public order", () => {
        expect(START_PATHS.map((path) => path.id)).toEqual([...START_PATH_IDS]);
    });

    it("marks only GitHub as needing the network", () => {
        expect(START_PATHS.filter((path) => path.needsNetwork).map((path) => path.id)).toEqual(["github"]);
    });

    it("uses translation keys that exist", () => {
        for (const path of START_PATHS) {
            expect(en[path.titleKey], path.titleKey).toBeTruthy();
            expect(en[path.hintKey], path.hintKey).toBeTruthy();
        }
    });

    it("offers Paste from AI right after the examples, offline", () => {
        expect(START_PATH_IDS.indexOf("ai")).toBe(START_PATH_IDS.indexOf("example") + 1);
        expect(START_PATHS.find((path) => path.id === "ai")?.needsNetwork).toBe(false);
    });

    it("recognises only known ids", () => {
        expect(isStartPathId("europass")).toBe(true);
        expect(isStartPathId("toString")).toBe(false);
    });
});
