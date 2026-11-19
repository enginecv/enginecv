import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { makeLetter, makeSentLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";

// The real HTML builder embeds the site's CSS and fonts over the network; here it only has to be handed the off-screen pages.
const built: Array<{ paper: string; filename: string; pages: number; scoped: boolean }> = [];
vi.mock("@/lib/export", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/export")>();
    return {
        ...actual,
        buildSelfContainedHtmlDocument: async (paper: "a4" | "letter", filename: string, root?: ParentNode) => {
            const pages = root ? [...root.querySelectorAll(".resume-page")] : [...document.querySelectorAll(".resume-page")];
            built.push({ paper, filename, pages: pages.length, scoped: !!root });
            return pages.length === 0 ? null : { html: `<!doctype html><html><body>${pages.map((page) => page.textContent).join("|")}</body></html>`, fallbackFonts: [] };
        },
    };
});

import { ExportUnavailableError, produceExport } from "./export-runner";

describe("export runner", () => {
    beforeEach(async () => {
        built.length = 0;
        document.body.innerHTML = "";
        await resetLetterTables();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV", name: "Amina Hodzic" }));
        await db.coverLetters.put(makeLetter({ id: "l-1", cvId: "cv-1", company: "Acme", role: "Designer" }));
    });

    it.each(["md", "txt", "tex"])("makes a CV as %s with the person's content", async (format) => {
        const made = await produceExport({ kind: "cv", docId: "cv-1", format });
        expect(made.extension).toBe(format);
        expect(typeof made.body).toBe("string");
        expect(made.body as string).toContain("Amina");
    });

    it("makes a CV as the app's JSON", async () => {
        const made = await produceExport({ kind: "cv", docId: "cv-1", format: "json" });
        expect(JSON.parse(made.body as string).basics.name).toBe("Amina Hodzic");
        expect(made.stem.startsWith("resume-")).toBe(true);
    });

    it("makes a CV as a real Word file", async () => {
        const made = await produceExport({ kind: "cv", docId: "cv-1", format: "docx" });
        expect(made.body).toBeInstanceOf(Uint8Array);
        const bytes = made.body as Uint8Array;
        expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK"); // a zip, as .docx is
        expect(bytes.length).toBeGreaterThan(2000);
    });

    it.each(["md", "txt", "tex"])("makes a letter as %s, with its tokens filled in", async (format) => {
        const made = await produceExport({ kind: "letter", docId: "l-1", format });
        expect(made.stem).toBe("cover-letter-acme-designer");
        const body = made.body as string;
        expect(body).toContain("excited"); // the paragraph is there, as text
        expect(body).not.toContain("{{role}}"); // and its token is filled in
    });

    it("makes a letter as a real Word file", async () => {
        const made = await produceExport({ kind: "letter", docId: "l-1", format: "docx" });
        expect(String.fromCharCode(...(made.body as Uint8Array).slice(0, 2))).toBe("PK");
    });

    it("draws a CV off-screen for HTML, hands only those pages to the builder, and leaves the page clean", async () => {
        const editorPage = document.createElement("div");
        editorPage.className = "resume-page";
        editorPage.textContent = "the open editor";
        document.body.appendChild(editorPage);

        const made = await produceExport({ kind: "cv", docId: "cv-1", format: "html", paper: "letter" });
        expect(made.extension).toBe("html");
        expect(made.body as string).toContain("Amina");
        expect(made.body as string).not.toContain("the open editor"); // never the editor's own pages
        expect(built[0]).toMatchObject({ paper: "letter", scoped: true });
        expect(document.querySelector("[data-workspace-export]")).toBeNull(); // the off-screen render is gone
        expect(document.body.contains(editorPage)).toBe(true);
    }, 20_000);

    it("draws a letter off-screen for HTML", async () => {
        const made = await produceExport({ kind: "letter", docId: "l-1", format: "html" });
        expect(made.body as string).toContain("excited");
        expect(built[0].scoped).toBe(true);
        expect(document.querySelector("[data-workspace-export]")).toBeNull();
    }, 20_000);

    it("uses a sent letter's frozen copy, not the CV as it is now", async () => {
        await db.coverLetters.put(makeSentLetter({ id: "l-sent", cvId: "cv-1", senderName: "Frozen Name", company: "Acme", role: "Designer" }));
        await db.resumes.update("cv-1", { basics: { ...(await db.resumes.get("cv-1"))!.basics, name: "Changed Later" } });
        const made = await produceExport({ kind: "letter", docId: "l-sent", format: "txt" });
        expect(made.body as string).toContain("Frozen Name");
        expect(made.body as string).not.toContain("Changed Later");
    });

    it("says unknown-document for a document that is gone, and format-unavailable for a format it cannot make", async () => {
        await expect(produceExport({ kind: "cv", docId: "nope", format: "md" })).rejects.toMatchObject({ reason: "unknown-document" });
        await expect(produceExport({ kind: "letter", docId: "nope", format: "md" })).rejects.toMatchObject({ reason: "unknown-document" });
        await expect(produceExport({ kind: "letter", docId: "l-1", format: "json" })).rejects.toBeInstanceOf(ExportUnavailableError);
        await expect(produceExport({ kind: "cv", docId: "cv-1", format: "pdf" })).rejects.toMatchObject({ reason: "format-unavailable" });
    });
});
