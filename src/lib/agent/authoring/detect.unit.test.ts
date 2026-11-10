import { describe, expect, it } from "vitest";
import { createQaFullResume, createQaMinimalResume } from "@/lib/qa/sample-resumes";
import { isAuthoringDocument, isFullEngineCvExport, isJsonResumeDocument } from "./detect";
import { resumeToAuthoring } from "./from-resume";

describe("isAuthoringDocument", () => {
    it("accepts authoring documents with the format marker, including newer versions", () => {
        expect(isAuthoringDocument(resumeToAuthoring(createQaFullResume()))).toBe(true);
        expect(isAuthoringDocument({ format: "enginecv.authoring/v1" })).toBe(true);
        expect(isAuthoringDocument({ format: "enginecv.authoring/v2", basics: { name: "A" } })).toBe(true);
    });

    it("accepts documents without the marker that look like one", () => {
        expect(isAuthoringDocument({ basics: { name: "A" } })).toBe(true);
        expect(isAuthoringDocument({ experience: [], skills: [] })).toBe(true);
        expect(isAuthoringDocument({ work: [], hobbies: [] })).toBe(true);
    });

    it("rejects full EngineCV exports, plain and encrypted", () => {
        const full = JSON.parse(JSON.stringify(createQaFullResume()));
        expect(isAuthoringDocument(full)).toBe(false);
        expect(isAuthoringDocument(JSON.parse(JSON.stringify(createQaMinimalResume())))).toBe(false);
        const encrypted = { format: "enginecv/encrypted-json", version: 1, algorithm: "AES-GCM", iv: "x", ciphertext: "y" };
        expect(isAuthoringDocument(encrypted)).toBe(false);
        expect(isFullEngineCvExport(full)).toBe(true);
        expect(isFullEngineCvExport(encrypted)).toBe(true);
    });

    it("keeps trimmed EngineCV files on the existing import", () => {
        // What older tests and hand-edited exports look like: no settings, but stored-only keys.
        const trimmed = { meta: { title: "JSON start" }, basics: { name: "Jasmin" } };
        expect(isAuthoringDocument(trimmed)).toBe(false);
        expect(isFullEngineCvExport(trimmed)).toBe(true);
        expect(isAuthoringDocument({ basics: { name: "A" }, skillGroups: [] })).toBe(false);
        // The marker wins: an authoring document is never a full export.
        expect(isFullEngineCvExport({ format: "enginecv.authoring/v1", meta: {} })).toBe(false);
    });

    it("rejects JSON Resume", () => {
        expect(isAuthoringDocument({
            $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
            basics: { name: "A" },
            work: [],
        })).toBe(false);
        expect(isAuthoringDocument({ basics: { name: "A", label: "Dev", profiles: [] }, work: [] })).toBe(false);
        expect(isAuthoringDocument({ basics: { name: "A" }, meta: { canonical: "https://x" } })).toBe(false);
    });

    it("recognises JSON Resume documents and never calls them EngineCV exports", () => {
        const withMeta = { basics: { name: "A", label: "Dev" }, work: [], meta: { canonical: "https://x", version: "v1.0.0" } };
        expect(isJsonResumeDocument(withMeta)).toBe(true);
        expect(isFullEngineCvExport(withMeta)).toBe(false);
        expect(isJsonResumeDocument({ $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json", meta: { version: "v1.0.0" } })).toBe(true);
        expect(isJsonResumeDocument({ basics: { name: "A", profiles: [] } })).toBe(true);
    });

    it("does not mistake EngineCV or authoring documents for JSON Resume", () => {
        expect(isJsonResumeDocument({ meta: { title: "CV" }, basics: { name: "A", headline: "Dev" }, settings: {} })).toBe(false);
        expect(isJsonResumeDocument({ format: "enginecv.authoring/v1", basics: { name: "A" } })).toBe(false);
        for (const value of [null, 1, "x", [], {}]) expect(isJsonResumeDocument(value)).toBe(false);
    });

    it("rejects other JSON", () => {
        for (const value of [null, 1, "x", [], {}, { name: "A" }, { experience: [] }, { format: "something/else" }, { dependencies: {} }]) {
            expect(isAuthoringDocument(value), JSON.stringify(value)).toBe(false);
        }
    });
});
