import { describe, expect, it } from "vitest";
import { authoringToResume, parseAuthoringText, resumeToAuthoring, serializeAuthoring } from "@/lib/agent/authoring";
import { createQaFullResume } from "@/lib/qa/sample-resumes";

/**
 * An agent writes a file in more than one step, and sync clients can show half a file. A cut-off
 * file must never be accepted as a valid but shorter CV, or a half-written file would wipe content.
 * (Measured in the agent-workspace spike: every cut offset of a 16 KB CV is blocked.)
 */
describe("cut-off and mangled agent files", () => {
    const text = serializeAuthoring(resumeToAuthoring(createQaFullResume(), { ids: true, personal: true }), "pretty");

    it("blocks the file at every cut-off point instead of applying part of it", () => {
        const step = Math.ceil(text.length / 1500);
        const accepted: number[] = [];
        for (let cut = 0; cut < text.length - 1; cut += step) {
            if (parseAuthoringText(text.slice(0, cut)).status !== "blocked") accepted.push(cut);
        }
        expect(accepted).toEqual([]);
    }, 30_000);

    it("accepts the harmless mangles with the same content, and blocks the ones that lose structure", () => {
        const expected = Object.values(authoringToResume(JSON.parse(text)).counts).reduce((sum, count) => sum + count, 0);
        const entries = (body: string) => {
            const result = parseAuthoringText(body);
            return result.status === "ok" ? Object.values(authoringToResume(result.document).counts).reduce((sum, count) => sum + count, 0) : result.status;
        };
        expect(entries("﻿" + text)).toBe(expected);
        expect(entries(text.replace(/\n/g, "\r\n"))).toBe(expected);
        expect(entries("```json\n" + text + "\n```")).toBe(expected);
        expect(entries("Here is your CV:\n" + text + "\nLet me know!")).toBe(expected);
        expect(entries(text.replace(/"/g, "'"))).toBe("blocked");
        expect(entries("")).toBe("blocked");
        expect(entries("   \n ")).toBe("blocked");
    });
});
