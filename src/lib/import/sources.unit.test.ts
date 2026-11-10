import { describe, expect, it } from "vitest";
import { createQaFullResume } from "@/lib/qa/sample-resumes";
import full from "@/lib/__fixtures__/json-resume/full.json";
import { csvFromRows, zipFromEntries } from "./linkedin/__fixtures__/archive-builder";
import { europassPdf, candidateXml } from "./europass/__fixtures__/europass-fixtures";
import { DATA_EXPORT_FORMAT } from "@/lib/storage-registry/export-file";
import { IMPORT_SOURCES, detectFileSource, getImportSource } from "./sources";

const jsonFile = (value: unknown, name = "cv.json") => new File([JSON.stringify(value)], name);

describe("source registry", () => {
    it("lists every source once, with text keys and a kind", () => {
        const ids = IMPORT_SOURCES.map((source) => source.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toEqual(expect.arrayContaining(["enginecv", "jsonresume", "authoring", "linkedin", "europass", "paste-ai", "github"]));
        for (const source of IMPORT_SOURCES) {
            expect(source.labelKey).toMatch(/^importHub\.source\./);
            expect(source.descriptionKey).toMatch(/^importHub\.source\./);
        }
    });

    it("marks only GitHub as needing the network", () => {
        expect(IMPORT_SOURCES.filter((source) => source.needsNetwork).map((source) => source.id)).toEqual(["github"]);
        expect(getImportSource("github").kind).toBe("github");
    });
});

describe("detectFileSource", () => {
    it("tells the JSON formats apart by content", async () => {
        expect(await detectFileSource(jsonFile(full))).toBe("jsonresume");
        expect(await detectFileSource(jsonFile({ format: "enginecv.authoring/v1", basics: { name: "Jane Doe" } }))).toBe("authoring");
        expect(await detectFileSource(jsonFile(createQaFullResume()))).toBe("enginecv");
    });

    it("reads an encrypted export and a data export as EngineCV files", async () => {
        expect(await detectFileSource(jsonFile({ format: "enginecv/encrypted-json", data: "x" }))).toBe("enginecv");
        expect(await detectFileSource(jsonFile({ format: DATA_EXPORT_FORMAT, data: { indexedDB: { EngineCVDatabase: { resumes: [createQaFullResume()] } } } }))).toBe("enginecv");
    });

    it("sends a LinkedIn zip or csv to LinkedIn", async () => {
        const zip = zipFromEntries({ "Profile.csv": csvFromRows(["First Name"], [{ "First Name": "Amina" }]) });
        expect(await detectFileSource(new File([new Uint8Array(zip)], "Basic_LinkedInDataExport.zip"))).toBe("linkedin");
        expect(await detectFileSource(new File(["a"], "Positions.csv"))).toBe("linkedin");
    });

    it("sends a Europass pdf or xml to Europass", async () => {
        expect(await detectFileSource(new File([new Uint8Array(europassPdf(candidateXml()))], "cv.pdf"))).toBe("europass");
        expect(await detectFileSource(new File([candidateXml()], "cv.xml"))).toBe("europass");
    });

    it("trusts the content when the extension is wrong", async () => {
        const zip = zipFromEntries({ "Profile.csv": "a" });
        expect(await detectFileSource(new File([new Uint8Array(zip)], "export"))).toBe("linkedin");
        expect(await detectFileSource(new File([JSON.stringify(full)], "resume.txt"))).toBe("jsonresume");
    });

    it("returns null for anything unsupported", async () => {
        expect(await detectFileSource(new File(["hello"], "notes.txt"))).toBeNull();
        expect(await detectFileSource(new File(["[1,2]"], "list.json"))).toBeNull();
        expect(await detectFileSource(new File(["x"], "photo.png"))).toBeNull();
    });
});
