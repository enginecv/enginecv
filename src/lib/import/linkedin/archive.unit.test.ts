import { describe, expect, it } from "vitest";
import { csvFromRows, fileFrom, zipFileFromEntries, zipFromEntries } from "./__fixtures__/archive-builder";
import {
    canonicalArchiveFile,
    canonicalCsvEntries,
    POSITIONS_HEADERS,
    PROFILE_HEADERS,
    SKILLS_HEADERS,
} from "./__fixtures__/canonical";
import { MAX_IMPORT_BYTES, parseLinkedinArchive } from "./archive";
import { LinkedinImportError } from "./errors";

async function expectFailure(files: File[], failureClass: string): Promise<void> {
    try {
        await parseLinkedinArchive(files);
        expect.unreachable(`expected ${failureClass} failure`);
    } catch (error) {
        expect(error).toBeInstanceOf(LinkedinImportError);
        expect((error as LinkedinImportError).failureClass).toBe(failureClass);
    }
}

describe("parseLinkedinArchive — happy path", () => {
    it("assembles all seven sections from the canonical archive", async () => {
        const parsed = await parseLinkedinArchive([canonicalArchiveFile()]);

        expect(parsed.profile?.firstName).toBe("Amina");
        expect(parsed.profile?.lastName).toBe("Kovačević");
        expect(parsed.profile?.summary).toContain('"boring" tech');
        expect(parsed.positions).toHaveLength(2);
        expect(parsed.positions[0].finishedOn).toBe("");
        expect(parsed.education).toHaveLength(1);
        expect(parsed.skills.map((skill) => skill.name)).toEqual(["TypeScript", "React", "C++"]);
        expect(parsed.certifications[0].licenseNumber).toBe("ABC-123");
        expect(parsed.languages).toHaveLength(2);
        expect(parsed.projects[0].title).toBe("EngineCV");

        expect([...parsed.filesFound].sort()).toEqual([
            "certifications",
            "education",
            "languages",
            "positions",
            "profile",
            "projects",
            "skills",
        ]);
        expect(parsed.filesMissing).toEqual([]);
        expect(parsed.skippedRows).toEqual({});
        expect(parsed.ignoredInputs).toEqual([]);
    });

    it("accepts loose CSV files recognized by filename", async () => {
        const entries = canonicalCsvEntries();
        const parsed = await parseLinkedinArchive([
            fileFrom(entries["Profile.csv"], "Profile.csv"),
            fileFrom(entries["Positions.csv"], "Positions.csv"),
        ]);

        expect(parsed.profile?.firstName).toBe("Amina");
        expect(parsed.positions).toHaveLength(2);
        expect(parsed.filesFound.sort()).toEqual(["positions", "profile"]);
        expect(parsed.filesMissing).toHaveLength(5);
    });

    it("partitions filesFound and filesMissing over all seven names", async () => {
        const entries = canonicalCsvEntries();
        const parsed = await parseLinkedinArchive([
            zipFileFromEntries({ "Profile.csv": entries["Profile.csv"] }),
        ]);

        expect(parsed.filesFound).toEqual(["profile"]);
        expect(parsed.filesMissing.sort()).toEqual([
            "certifications",
            "education",
            "languages",
            "positions",
            "projects",
            "skills",
        ]);
    });
});

describe("parseLinkedinArchive — row salvage", () => {
    it("skips blank skill names and counts them", async () => {
        const skillsCsv = csvFromRows(SKILLS_HEADERS, [{ Name: "TypeScript" }, { Name: "  " }, { Name: "React" }]);
        const parsed = await parseLinkedinArchive([zipFileFromEntries({ "Skills.csv": skillsCsv })]);

        expect(parsed.skills.map((skill) => skill.name)).toEqual(["TypeScript", "React"]);
        expect(parsed.skippedRows.skills).toBe(1);
    });

    it("skips positions with neither company nor title", async () => {
        const positionsCsv = csvFromRows(POSITIONS_HEADERS, [
            { "Company Name": "", Title: "", Description: "orphan row" },
            { "Company Name": "EngineWorks", Title: "Engineer" },
        ]);
        const parsed = await parseLinkedinArchive([zipFileFromEntries({ "Positions.csv": positionsCsv })]);

        expect(parsed.positions).toHaveLength(1);
        expect(parsed.skippedRows.positions).toBe(1);
    });

    it("uses only the first Profile row and counts extras", async () => {
        const profileCsv = csvFromRows(PROFILE_HEADERS, [
            { "First Name": "Amina", "Last Name": "Kovačević" },
            { "First Name": "Ghost", "Last Name": "Row" },
        ]);
        const parsed = await parseLinkedinArchive([zipFileFromEntries({ "Profile.csv": profileCsv })]);

        expect(parsed.profile?.firstName).toBe("Amina");
        expect(parsed.skippedRows.profile).toBe(1);
    });

    it("treats a zero-header-overlap file as missing with skipped rows", async () => {
        const alienCsv = csvFromRows(["Foo", "Bar"], [{ Foo: "1", Bar: "2" }]);
        const entries = canonicalCsvEntries();
        const parsed = await parseLinkedinArchive([
            zipFileFromEntries({ "Skills.csv": alienCsv, "Profile.csv": entries["Profile.csv"] }),
        ]);

        expect(parsed.filesFound).toEqual(["profile"]);
        expect(parsed.filesMissing).toContain("skills");
        expect(parsed.skippedRows.skills).toBe(1);
    });

    it("treats an unparseable CSV as missing with a skip marker", async () => {
        const parsed = await parseLinkedinArchive([
            zipFileFromEntries({
                "Skills.csv": 'Name\n"unterminated\n',
                "Profile.csv": canonicalCsvEntries()["Profile.csv"],
            }),
        ]);

        expect(parsed.filesMissing).toContain("skills");
        expect(parsed.skippedRows.skills).toBeGreaterThan(0);
    });
});

describe("parseLinkedinArchive — failure classes", () => {
    it("rejects oversized inputs before reading (too-large)", async () => {
        const big = fileFrom("x", "archive.zip");
        Object.defineProperty(big, "size", { value: MAX_IMPORT_BYTES + 1 });
        await expectFailure([big], "too-large");
    });

    it("rejects files that are neither ZIP nor CSV (unrecognized-file)", async () => {
        await expectFailure([fileFrom("just some text", "resume.txt")], "unrecognized-file");
    });

    it("rejects corrupt ZIP bytes (corrupt-archive)", async () => {
        const bytes = zipFromEntries({ "Profile.csv": canonicalCsvEntries()["Profile.csv"] });
        const corrupted = bytes.slice(0, Math.floor(bytes.length / 2));
        await expectFailure([fileFrom(corrupted, "archive.zip")], "corrupt-archive");
    });

    it("rejects archives without recognized profile files (no-profile-data)", async () => {
        const connectionsOnly = zipFileFromEntries({
            "Connections.csv": csvFromRows(["First Name", "Last Name", "Company"], [{ "First Name": "A" }]),
        });
        await expectFailure([connectionsOnly], "no-profile-data");
    });

    it("orders too-large before type sniffing", async () => {
        const big = fileFrom("not a zip", "whatever.txt");
        Object.defineProperty(big, "size", { value: MAX_IMPORT_BYTES + 1 });
        await expectFailure([big], "too-large");
    });
});

describe("parseLinkedinArchive — multiple inputs", () => {
    it("uses the first ZIP and reports the rest as ignored", async () => {
        const entries = canonicalCsvEntries();
        const first = zipFileFromEntries({ "Profile.csv": entries["Profile.csv"] }, "first.zip");
        const second = zipFileFromEntries({ "Skills.csv": entries["Skills.csv"] }, "second.zip");
        const parsed = await parseLinkedinArchive([first, second]);

        expect(parsed.filesFound).toEqual(["profile"]);
        expect(parsed.ignoredInputs).toEqual(["second.zip"]);
    });

    it("ignores loose CSVs when a ZIP is present", async () => {
        const entries = canonicalCsvEntries();
        const zip = zipFileFromEntries({ "Profile.csv": entries["Profile.csv"] }, "export.zip");
        const csv = fileFrom(entries["Skills.csv"], "Skills.csv");
        const parsed = await parseLinkedinArchive([zip, csv]);

        expect(parsed.filesFound).toEqual(["profile"]);
        expect(parsed.ignoredInputs).toEqual(["Skills.csv"]);
    });

    it("ignores unrecognized loose CSV names without failing", async () => {
        const entries = canonicalCsvEntries();
        const parsed = await parseLinkedinArchive([
            fileFrom(entries["Profile.csv"], "Profile.csv"),
            fileFrom(csvFromRows(["A"], []), "Random.csv"),
        ]);

        expect(parsed.filesFound).toEqual(["profile"]);
        expect(parsed.ignoredInputs).toEqual(["Random.csv"]);
    });

    it("fails no-profile-data when only unrecognized CSVs are given", async () => {
        await expectFailure([fileFrom(csvFromRows(["A"], []), "Connections.csv")], "no-profile-data");
    });
});

describe("parseLinkedinArchive — large inputs stay ordered", () => {
    it("parses thousands of rows preserving order across yields", async () => {
        const rows = Array.from({ length: 5000 }, (_, index) => ({ Name: `Skill ${index}` }));
        const skillsCsv = csvFromRows(SKILLS_HEADERS, rows);
        const parsed = await parseLinkedinArchive([zipFileFromEntries({ "Skills.csv": skillsCsv })]);

        expect(parsed.skills).toHaveLength(5000);
        expect(parsed.skills[0].name).toBe("Skill 0");
        expect(parsed.skills[4999].name).toBe("Skill 4999");
    });

    it("yields to the event loop while parsing large archives", async () => {
        const rows = Array.from({ length: 5000 }, (_, index) => ({ Name: `Skill ${index}` }));
        const skillsCsv = csvFromRows(SKILLS_HEADERS, rows);

        let timerTicks = 0;
        const interval = setInterval(() => {
            timerTicks += 1;
        }, 0);
        try {
            await parseLinkedinArchive([zipFileFromEntries({ "Skills.csv": skillsCsv })]);
        } finally {
            clearInterval(interval);
        }

        // A parse that never yielded would block the loop and leave the
        // interval at zero; ~2 yields are expected for 5000 rows.
        expect(timerTicks).toBeGreaterThan(0);
    });
});
