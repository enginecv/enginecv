import { describe, expect, it } from "vitest";
import { createEmptyResume, type Resume } from "@/lib/schema";
import { applyContent, describeContentChange } from "./apply-content";

function base(): Resume {
    const resume = createEmptyResume();
    resume.id = "cv-1";
    resume.meta.title = "My CV";
    resume.basics.name = "Amina";
    resume.basics.photo = "data:image/png;base64,AAA";
    resume.settings.colors.accent = "#123456";
    resume.settings.contentSections = ["experience", "projects"];
    resume.settings.layout.sectionOrder = ["experience", "projects"];
    resume.experience = [{ ...createEmptyResume().experience[0], id: "e1", hidden: true, position: "Nurse", company: "KCUS" } as never];
    return resume;
}

function incomingFrom(current: Resume): Resume {
    return JSON.parse(JSON.stringify(current)) as Resume;
}

describe("applyContent", () => {
    it("keeps id, meta, design and photo", () => {
        const current = base();
        const incoming = incomingFrom(current);
        incoming.id = "other";
        incoming.meta.title = "Other";
        incoming.settings.colors.accent = "#ffffff";
        incoming.basics.photo = "";
        incoming.basics.name = "Changed";
        const next = applyContent(current, incoming);
        expect(next.id).toBe("cv-1");
        expect(next.meta.title).toBe("My CV");
        expect(next.settings.colors.accent).toBe("#123456");
        expect(next.basics.photo).toBe("data:image/png;base64,AAA");
        expect(next.basics.name).toBe("Changed");
    });

    it("takes section order and content sections from the file", () => {
        const current = base();
        const incoming = incomingFrom(current);
        incoming.settings.contentSections = ["projects", "experience", "education"];
        incoming.settings.layout.sectionOrder = ["projects", "experience", "education"];
        const next = applyContent(current, incoming);
        expect(next.settings.contentSections).toEqual(["projects", "experience", "education"]);
        expect(next.settings.layout.sectionOrder).toEqual(["projects", "experience", "education"]);
        expect(next.settings.layout.columns).toBe(current.settings.layout.columns);
    });

    it("keeps per-entry hidden when the file carries it, and removes a section", () => {
        const current = base();
        const incoming = incomingFrom(current);
        const next = applyContent(current, incoming);
        expect(next.experience[0].hidden).toBe(true);
        incoming.experience = [];
        expect(applyContent(current, incoming).experience).toEqual([]);
    });

    it("keeps a declaration signature the file cannot carry", () => {
        const current = base();
        current.declaration = [{ id: "d1", hidden: false, text: "t", signature: "data:sig", fullName: "", place: "", date: "" }];
        const incoming = incomingFrom(current);
        incoming.declaration[0].signature = "";
        expect(applyContent(current, incoming).declaration[0].signature).toBe("data:sig");
    });

    it("keeps the link icons and layout choices a file cannot carry, for entries the file keeps", () => {
        const current = base();
        (current.experience[0] as unknown as Record<string, unknown>).urlIcon = "graduation-cap";
        current.basics.detailsOrder = ["email", "phone"];
        const incoming = incomingFrom(current);
        (incoming.experience[0] as unknown as Record<string, unknown>).urlIcon = "auto";
        incoming.basics.detailsOrder = [];
        incoming.experience[0].position = "Changed";
        const next = applyContent(current, incoming);
        expect((next.experience[0] as unknown as Record<string, unknown>).urlIcon).toBe("graduation-cap");
        expect(next.experience[0].position).toBe("Changed");
        expect(next.basics.detailsOrder).toEqual(["email", "phone"]);
        // A new entry (no matching id) takes the file's defaults.
        incoming.experience.push({ ...incoming.experience[0], id: "e2" });
        expect((applyContent(current, incoming).experience[1] as unknown as Record<string, unknown>).urlIcon).toBe("auto");
    });

    it("handles an empty file", () => {
        const current = base();
        const next = applyContent(current, createEmptyResume());
        expect(next.experience).toEqual([]);
        expect(next.id).toBe("cv-1");
        expect(next.basics.photo).toBe("data:image/png;base64,AAA");
    });
});

describe("describeContentChange", () => {
    it("counts added, removed and changed", () => {
        const before = base();
        const after = incomingFrom(before);
        after.experience[0].position = "Lead";
        after.projects = [{ ...createEmptyResume().projects[0], id: "p1", title: "New" } as never];
        expect(describeContentChange(before, after)).toEqual({ added: 1, removed: 0, changed: 1 });
        after.experience = [];
        expect(describeContentChange(before, after)).toEqual({ added: 1, removed: 1, changed: 0 });
    });

    it("counts basics and summary once each", () => {
        const before = base();
        const after = incomingFrom(before);
        after.basics.name = "X";
        after.basics.summary = "S";
        expect(describeContentChange(before, after).changed).toBe(2);
    });

    it("is zero for identical content", () => {
        const before = base();
        expect(describeContentChange(before, incomingFrom(before))).toEqual({ added: 0, removed: 0, changed: 0 });
    });
});
