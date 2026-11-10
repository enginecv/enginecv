import { describe, expect, it } from "vitest";
import { createQaFullResume } from "@/lib/qa/sample-resumes";
import full from "@/lib/__fixtures__/json-resume/full.json";
import { csvFromRows, zipFromEntries } from "./linkedin/__fixtures__/archive-builder";
import { canonicalPositionRows, POSITIONS_HEADERS } from "./linkedin/__fixtures__/canonical";
import { candidateXml, europassPdf } from "./europass/__fixtures__/europass-fixtures";
import { DATA_EXPORT_FORMAT } from "@/lib/storage-registry/export-file";
import { SourceReadError, readAuthoringText, readSourceFile } from "./read-source";

const jsonFile = (value: unknown, name = "cv.json") => new File([JSON.stringify(value)], name);

describe("readSourceFile", () => {
    it("stages a JSON Resume file with its loss report", async () => {
        const [batch] = await readSourceFile(jsonFile(full, "resume.json"));
        expect(batch.sourceId).toBe("jsonresume");
        expect(batch.label).toBe("resume.json");
        expect(batch.resume.basics.name).toBe("John Doe");
        expect(batch.losses?.items.length).toBeGreaterThan(0);
    });

    it("stages an EngineCV export as it is", async () => {
        const [batch] = await readSourceFile(jsonFile(createQaFullResume()));
        expect(batch.sourceId).toBe("enginecv");
        expect(batch.losses).toBeUndefined();
        expect(batch.resume.experience.length).toBeGreaterThan(0);
    });

    it("stages one batch per CV of a data export", async () => {
        const batches = await readSourceFile(jsonFile({ format: DATA_EXPORT_FORMAT, data: { indexedDB: { EngineCVDatabase: { resumes: [createQaFullResume(), createQaFullResume()] } } } }));
        expect(batches).toHaveLength(2);
        expect(new Set(batches.map((batch) => batch.id)).size).toBe(2);
    });

    it("stages an authoring document", async () => {
        const [batch] = await readSourceFile(
            jsonFile({ format: "enginecv.authoring/v1", basics: { name: "Jane Doe" }, experience: [{ company: "Acme", position: "Dev", start: "2020-01" }] }),
        );
        expect(batch.sourceId).toBe("authoring");
        expect(batch.resume.experience[0].company).toBe("Acme");
    });

    it("stages a LinkedIn archive", async () => {
        const zip = zipFromEntries({ "Positions.csv": csvFromRows(POSITIONS_HEADERS, canonicalPositionRows) });
        const [batch] = await readSourceFile(new File([new Uint8Array(zip)], "export.zip"));
        expect(batch.sourceId).toBe("linkedin");
        expect(batch.resume.experience.map((entry) => entry.company)).toContain("EngineWorks");
    });

    it("stages a Europass file", async () => {
        const [batch] = await readSourceFile(new File([new Uint8Array(europassPdf(candidateXml()))], "cv.pdf"));
        expect(batch.sourceId).toBe("europass");
        expect(batch.resume.basics.name).toContain("Amina");
    });

    it("rejects an unsupported file", async () => {
        await expect(readSourceFile(new File(["hello"], "notes.txt"))).rejects.toMatchObject({ code: "unsupported" });
    });

    it("names the reader's failure class for a bad LinkedIn or Europass file", async () => {
        await expect(readSourceFile(new File(["a,b"], "Unknown.csv"))).rejects.toMatchObject({ code: "linkedin-failure" });
        await expect(readSourceFile(new File([new Uint8Array(europassPdf(null))], "cv.pdf"))).rejects.toMatchObject({ code: "europass-failure" });
    });

    it("reports a JSON file that is no CV as a read error", async () => {
        const error = await readSourceFile(jsonFile({ resumes: "nope", basics: 4 })).catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(SourceReadError);
    });
});

describe("readAuthoringText", () => {
    it("reads an AI answer with fences around the JSON", () => {
        const text = 'Here you go:\n```json\n{"format":"enginecv.authoring/v1","basics":{"name":"Jane Doe"}}\n```';
        const batch = readAuthoringText(text, "Pasted", "paste-ai");
        expect(batch.sourceId).toBe("paste-ai");
        expect(batch.resume.basics.name).toBe("Jane Doe");
    });

    it("throws when there is no document", () => {
        expect(() => readAuthoringText("no json here", "Pasted", "paste-ai")).toThrow(SourceReadError);
    });
});
