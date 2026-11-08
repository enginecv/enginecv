import { describe, expect, it } from "vitest";
import { candidateXml, europassPdf, skillsPassportXml } from "./__fixtures__/europass-fixtures";
import { EuropassImportError } from "./errors";
import { extractEuropassXml } from "./extract";
import { MAX_EUROPASS_BYTES, parseEuropassFile } from "./file";

const encode = (text: string) => new TextEncoder().encode(text);

function failureOf(run: () => unknown): string | undefined {
    try {
        run();
    } catch (error) {
        return error instanceof EuropassImportError ? error.failureClass : `unexpected: ${String(error)}`;
    }
    return undefined;
}

describe("extractEuropassXml", () => {
    it("passes Europass XML through for both generations", () => {
        expect(extractEuropassXml(encode(candidateXml()))).toMatchObject({ source: "xml" });
        expect(extractEuropassXml(encode(skillsPassportXml())).xml).toContain("<SkillsPassport");
    });

    it("strips a UTF-8 byte order mark", () => {
        const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...encode(candidateXml())]);
        expect(extractEuropassXml(withBom).xml.startsWith("<?xml")).toBe(true);
    });

    it("finds the embedded XML in compressed and uncompressed PDFs", () => {
        for (const compress of [true, false]) {
            const { xml, source } = extractEuropassXml(europassPdf(candidateXml(), { compress }));
            expect(source).toBe("pdf");
            expect(xml).toContain("<oa:GivenName>Amina</oa:GivenName>");
        }
    });

    it("rejects PDFs without Europass data", () => {
        expect(failureOf(() => extractEuropassXml(europassPdf(null)))).toBe("no-europass-data");
        expect(failureOf(() => extractEuropassXml(europassPdf("<resume><name>Not Europass</name></resume>")))).toBe("no-europass-data");
    });

    it("classifies other files", () => {
        expect(failureOf(() => extractEuropassXml(encode("PK\x03\x04 not a cv")))).toBe("unrecognized-file");
        expect(failureOf(() => extractEuropassXml(encode("<resume/>")))).toBe("no-europass-data");
    });
});

describe("parseEuropassFile", () => {
    it("parses a Europass PDF end to end", async () => {
        const file = new File([europassPdf(candidateXml())], "Europass CV.pdf", { type: "application/pdf" });
        const parsed = await parseEuropassFile(file);
        expect(parsed).toMatchObject({ source: "pdf", fileName: "Europass CV.pdf" });
        expect(parsed.cv.person.familyName).toBe("Kovačević");
    });

    it("rejects oversize files before reading them", async () => {
        const file = new File(["x"], "huge.pdf");
        Object.defineProperty(file, "size", { value: MAX_EUROPASS_BYTES + 1 });
        await expect(parseEuropassFile(file)).rejects.toMatchObject({ failureClass: "too-large" });
    });

    it("rejects a Europass document with nothing to import", async () => {
        const empty = '<Candidate xmlns="http://www.europass.eu/1.0"><CandidateProfile/></Candidate>';
        await expect(parseEuropassFile(new File([empty], "empty.xml"))).rejects.toMatchObject({ failureClass: "no-europass-data" });
    });

    it("reports malformed XML as corrupt", async () => {
        const broken = '<Candidate xmlns="http://www.europass.eu/1.0"><CandidatePerson>';
        await expect(parseEuropassFile(new File([broken], "broken.xml"))).rejects.toMatchObject({ failureClass: "corrupt-file" });
    });
});
