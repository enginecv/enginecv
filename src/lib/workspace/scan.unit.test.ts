import { describe, expect, it } from "vitest";
import { classifyListing, isIgnoredName, type ListedFile } from "./scan";
import { MAX_DOCUMENTS, MAX_FILE_BYTES } from "./types";

const file = (name: string, size = 100): ListedFile => ({ name, size, lastModified: 1 });

describe("workspace scan classification", () => {
    it("treats CV and letter files as documents and sorts them", () => {
        const result = classifyListing({ cvs: [file("b.cv.json"), file("a.cv.json")], letters: [file("x.letter.json")] });
        expect(result.documents.map((doc) => `${doc.kind}:${doc.stem}`)).toEqual(["cv:a", "cv:b", "letter:x"]);
    });

    it("ignores swap files, dotfiles and editor leftovers silently", () => {
        const result = classifyListing({ cvs: [file("a.cv.json"), file("a.cv.json.crswap"), file(".DS_Store"), file("~$a.cv.json"), file("a.cv.json~")] });
        expect(result.documents).toHaveLength(1);
        expect(result.notWorkspaceFiles).toEqual([]);
        expect(isIgnoredName("x.crswap")).toBe(true);
        expect(isIgnoredName("x.cv.json")).toBe(false);
    });

    it("lists other files in a document folder as not workspace files", () => {
        const result = classifyListing({ cvs: [file("notes.txt"), file("a.letter.json"), file("a.cv.json")] });
        expect(result.notWorkspaceFiles).toEqual(["a.letter.json", "notes.txt"]); // a letter in cvs/ is not a CV
        expect(result.documents).toHaveLength(1);
    });

    it("finds conflict copies made by sync tools and names the original", () => {
        const result = classifyListing({
            cvs: [
                file("master.cv.json"),
                file("master (Safet's conflicted copy 2026-11-19).cv.json"),
                file("master.sync-conflict-20261119-120000-ABC123.cv.json"),
                file("master-DESKTOP-4F2K9.cv.json"),
                file("master (1).cv.json"),
                file("solo (1).cv.json"), // no "solo.cv.json": a plain name, not a copy
            ],
        });
        expect(result.documents.map((doc) => doc.name)).toEqual(["master.cv.json", "solo (1).cv.json"]);
        expect(result.conflictCopies.map((copy) => copy.original)).toEqual(["master.cv.json", "master.cv.json", "master.cv.json", "master.cv.json"]);
        expect(result.conflictCopies).toHaveLength(4);
    });

    it("skips files over 200 KB and anything past the document cap", () => {
        const big = classifyListing({ cvs: [file("big.cv.json", MAX_FILE_BYTES + 1), file("ok.cv.json", MAX_FILE_BYTES)] });
        expect(big.skipped).toEqual([{ fileName: "big.cv.json", reason: "too-large" }]);
        expect(big.documents).toHaveLength(1);

        const many = classifyListing({ cvs: Array.from({ length: MAX_DOCUMENTS + 5 }, (_, i) => file(`f${String(i).padStart(4, "0")}.cv.json`)) });
        expect(many.documents).toHaveLength(MAX_DOCUMENTS);
        expect(many.skipped.filter((entry) => entry.reason === "over-limit")).toHaveLength(5);
    });

    it("compares names without regard to case when looking for the original", () => {
        const result = classifyListing({ cvs: [file("Master.cv.json"), file("master (1).cv.json")] });
        expect(result.conflictCopies[0].original).toBe("master.cv.json");
    });
});
