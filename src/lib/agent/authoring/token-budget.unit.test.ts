import { encode } from "gpt-tokenizer/encoding/o200k_base";
import { describe, expect, it } from "vitest";
import { createQaFullResume, createQaMinimalResume } from "@/lib/qa/sample-resumes";
import type { Resume } from "@/lib/schema";
import { resumeToAuthoring, serializeAuthoring } from "./from-resume";

/**
 * FR-009 / SC-004 budgets, measured with o200k_base (gpt-tokenizer, pinned) on
 * the minified form without ids: what an AI writes or reads (research R4, R5).
 * The ids form and the pretty form are snapshotted for comparison only; ids
 * are an #84 concern (stored ids are UUIDs, about 25 tokens each).
 */

const BUDGET = { full: 3000, minimal: 200 };

function measure(resume: Resume) {
    const tokens = (text: string) => encode(text).length;
    return {
        withIds: tokens(serializeAuthoring(resumeToAuthoring(resume, { ids: true, personal: true }), "compact")),
        withoutIds: tokens(serializeAuthoring(resumeToAuthoring(resume, { ids: false, personal: true }), "compact")),
        pretty: tokens(serializeAuthoring(resumeToAuthoring(resume, { ids: true, personal: true }), "pretty")),
        stored: tokens(JSON.stringify(resume)),
    };
}

describe("authoring token budget (FR-009)", () => {
    it("QA full CV stays within 3,000 tokens and at most half the stored size", () => {
        const counts = measure(createQaFullResume());
        expect(counts.withoutIds).toBeLessThanOrEqual(BUDGET.full);
        expect(counts.withoutIds).toBeLessThanOrEqual(counts.stored / 2);
        expect(counts).toMatchSnapshot();
    });

    it("QA minimal CV stays within 200 tokens", () => {
        const counts = measure(createQaMinimalResume());
        expect(counts.withoutIds).toBeLessThanOrEqual(BUDGET.minimal);
        expect(counts).toMatchSnapshot();
    });
});
