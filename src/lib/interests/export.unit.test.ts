import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { toDocumentModel } from "@/lib/document-model";
import { buildDocx } from "@/lib/export-docx";
import { toMarkdown } from "@/lib/export-markdown";
import { toPlainText } from "@/lib/export-plaintext";
import { resumeToJsonResume } from "@/lib/json-resume/from-resume";
import { createEmptyResume, type Resume } from "@/lib/schema";

// Interest icons are a display feature of the live preview and PDF. Every
// text-based export must carry only the interest names (and descriptions where
// the format already shows them), never an icon (FR-014, SC-007).

const ICON_VALUES = ["lucide:guitar", "🥾"];

function resumeWithIcons(): Resume {
    const resume = createEmptyResume();
    resume.basics.name = "Jane Doe";
    resume.settings.contentSections = ["interests"];
    resume.settings.interestsSection = { display: "iconGrid", showIcons: true, columns: 3, separator: "dot" };
    resume.interests = [
        { id: "i1", hidden: false, name: "Guitar", description: "Plays in a band", icon: "lucide:guitar" },
        { id: "i2", hidden: false, name: "Hiking", description: "", icon: "🥾" },
        { id: "i3", hidden: false, name: "Chess", description: "Club player" },
    ];
    return resume;
}

function expectNoIcon(text: string) {
    for (const value of ICON_VALUES) expect(text).not.toContain(value);
    expect(text).not.toContain("lucide");
}

describe("interest icons in exports", () => {
    it("the document model carries only title and body for an interest", () => {
        const model = toDocumentModel(resumeWithIcons());
        const section = model.sections.find((candidate) => candidate.entries.some((entry) => entry.title === "Guitar"));
        expect(section).toBeDefined();
        const guitar = section!.entries.find((entry) => entry.title === "Guitar")!;
        expect(guitar.body).toBe("Plays in a band");
        expect(JSON.stringify(model)).not.toContain("lucide:");
        expect(JSON.stringify(model)).not.toContain("🥾");
    });

    it("Markdown lists the names and descriptions without icons", () => {
        const markdown = toMarkdown(toDocumentModel(resumeWithIcons()));

        expect(markdown).toContain("Guitar");
        expect(markdown).toContain("Hiking");
        expect(markdown).toContain("Chess");
        expect(markdown).toContain("Plays in a band");
        expectNoIcon(markdown);
    });

    it("plain text lists the names without icons", () => {
        const text = toPlainText(toDocumentModel(resumeWithIcons()));

        expect(text).toContain("Guitar");
        expect(text).toContain("Hiking");
        expect(text).toContain("Chess");
        expectNoIcon(text);
    });

    it("DOCX contains the names and no icon glyph", async () => {
        const result = await buildDocx(toDocumentModel(resumeWithIcons()), {
            style: { fontFamily: "Inter", accent: "#b84a24", text: "#111827", paperSize: "a4" },
            includePhoto: false,
        });
        const zip = await JSZip.loadAsync(result.blob);
        const xml = await zip.file("word/document.xml")!.async("string");
        const text = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((match) => match[1]).join("");

        expect(text).toContain("Guitar");
        expect(text).toContain("Hiking");
        expect(text).toContain("Chess");
        expectNoIcon(text);
        expect(Object.keys(zip.files).some((name) => name.startsWith("word/media/"))).toBe(false);
    });

    it("JSON Resume export keeps the names and does not leak the icon", () => {
        const { document } = resumeToJsonResume(resumeWithIcons());
        const interests = (document.interests ?? []) as Array<{ name?: string }>;

        expect(interests.map((interest) => interest.name)).toEqual(["Guitar", "Hiking", "Chess"]);
        expectNoIcon(JSON.stringify(document));
    });

    it("the user data JSON (full resume) does keep the icons so a re-import restores them", () => {
        const json = JSON.stringify(resumeWithIcons());

        expect(json).toContain("lucide:guitar");
        expect(json).toContain("🥾");
    });
});
