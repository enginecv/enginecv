import { describe, expect, it } from "vitest";
import { importResumeFromJsonText } from "@/lib/export";
import { createQaFullResume } from "@/lib/qa/sample-resumes";
import full from "@/lib/__fixtures__/json-resume/full.json";
import { resumeToJsonResume } from "./from-resume";

describe("importResumeFromJsonText routing", () => {
    it("converts a JSON Resume file and returns its report", async () => {
        const result = await importResumeFromJsonText(JSON.stringify(full));
        expect(result?.kind).toBe("json-resume");
        if (result?.kind !== "json-resume") return;
        expect(result.resume.basics.name).toBe("John Doe");
        expect(result.report.items.length).toBeGreaterThan(0);
        expect(result.clampedFields).toEqual([]);
    });

    it("converts a file that EngineCV itself exported as JSON Resume", async () => {
        const { document } = resumeToJsonResume(createQaFullResume());
        const result = await importResumeFromJsonText(JSON.stringify(document));
        expect(result?.kind).toBe("json-resume");
    });

    it("still reads a full EngineCV export as a resume", async () => {
        const result = await importResumeFromJsonText(JSON.stringify(createQaFullResume()));
        expect(result?.kind).toBe("resume");
    });

    it("rejects a JSON Resume file over the size limit", async () => {
        const huge = JSON.stringify({ ...full, basics: { ...full.basics, summary: "x".repeat(2 * 1024 * 1024 + 10) } });
        await expect(importResumeFromJsonText(huge)).rejects.toThrow();
    });
});
