import { describe, expect, it } from "vitest";
import { allSkills, createUngroupedSkillGroup } from "@/lib/schema";
import { applyMergePlan, summarizeSelection } from "./apply";
import { buildMergePlan } from "./plan";
import { batchOf, resumeWith } from "./test-helpers";
import type { Selection } from "./types";

const none: Selection = { rows: {}, fields: {}, basics: {} };
const job = (fields: Record<string, unknown>) => ({ id: "e", company: "Acme", position: "Engineer", start: "2020-03", ...fields });

function tickNothing(rowIds: string[]): Selection {
    return { ...none, rows: Object.fromEntries(rowIds.map((id) => [id, false])) };
}

describe("applyMergePlan merge", () => {
    it("changes nothing when nothing is selected", () => {
        const current = resumeWith({ experience: [job({ id: "mine" })] });
        const plan = buildMergePlan(current, [batchOf("a", { experience: [job({ company: "Globex" })], basics: { name: "Other" } })]);
        const before = structuredClone(current);
        const next = applyMergePlan(current, plan, { rows: tickNothing(plan.rows.map((row) => row.id)).rows, fields: {}, basics: { name: "current" } });
        expect(next).toEqual(before);
        expect(current).toEqual(before);
    });

    it("adds ticked rows with fresh unique ids and leaves unticked ones out", () => {
        const current = resumeWith({ experience: [job({ id: "mine", company: "Mine Co" })] });
        const plan = buildMergePlan(current, [
            batchOf("a", { experience: [job({ company: "Globex" }), job({ id: "e", company: "Initech", start: "2015" })] }),
        ]);
        const initech = plan.rows.find((row) => row.title.startsWith("Initech"))!;
        const next = applyMergePlan(current, plan, { ...none, rows: { [initech.id]: false } });
        const names = next.experience.map((entry) => entry.company);
        expect(names).toEqual(["Mine Co", "Globex"]);
        const ids = next.experience.map((entry) => entry.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).not.toContain("e");
    });

    it("builds one entry from two sources and applies the chosen wording", () => {
        const current = resumeWith();
        const plan = buildMergePlan(current, [
            batchOf("a", { experience: [job({ description: "From A." })] }),
            batchOf("b", { experience: [job({ description: "From B, which is longer." })] }),
        ]);
        const [row] = plan.rows;
        const fuller = applyMergePlan(current, plan, none);
        expect(fuller.experience).toHaveLength(1);
        expect(fuller.experience[0].description).toBe("From B, which is longer.");
        const picked = applyMergePlan(current, plan, { ...none, fields: { [row.id]: { description: "a" } } });
        expect(picked.experience[0].description).toBe("From A.");
    });

    it("fills a field one source lacks from the other", () => {
        const current = resumeWith();
        const plan = buildMergePlan(current, [
            batchOf("a", { experience: [job({ location: "Berlin" })] }),
            batchOf("b", { experience: [job({ description: "Text." })] }),
        ]);
        const [entry] = applyMergePlan(current, plan, none).experience;
        expect(entry.location).toBe("Berlin");
        expect(entry.description).toBe("Text.");
    });

    it("updates only the re-chosen field of an entry already in the CV", () => {
        const current = resumeWith({ experience: [job({ id: "mine", description: "Mine.", location: "Home" })] });
        const plan = buildMergePlan(current, [batchOf("a", { experience: [job({ description: "Theirs.", location: "Away" })] })]);
        const [row] = plan.rows;
        const next = applyMergePlan(current, plan, { rows: { [row.id]: true }, fields: { [row.id]: { description: "a" } }, basics: {} });
        expect(next.experience).toHaveLength(1);
        expect(next.experience[0].description).toBe("Theirs.");
        expect(next.experience[0].location).toBe("Home");
        expect(next.experience[0].id).toBe("mine");
    });

    it("adds skills to the ungrouped group and skips ones already there", () => {
        const current = resumeWith({ skillGroups: [createUngroupedSkillGroup([{ id: "s1", name: "React" } as never])] });
        const plan = buildMergePlan(current, [batchOf("a", { skillGroups: [{ id: "g", name: "", skills: [{ id: "x", name: "React" }, { id: "y", name: "Vue" }] }] })]);
        const names = allSkills(applyMergePlan(current, plan, none).skillGroups).map((skill) => skill.name);
        expect(names).toEqual(["React", "Vue"]);
    });

    it("applies chosen basics and keeps the others", () => {
        const current = resumeWith({ basics: { name: "Jane Doe", headline: "Engineer" } });
        const plan = buildMergePlan(current, [batchOf("a", { basics: { name: "J. Doe", headline: "Staff Engineer", email: "j@example.com" } })]);
        const next = applyMergePlan(current, plan, { ...none, basics: { headline: "a" } });
        expect(next.basics.headline).toBe("Staff Engineer");
        expect(next.basics.name).toBe("Jane Doe");
        expect(next.basics.email).toBe("j@example.com");
    });

    it("reveals a section that gains entries", () => {
        const current = resumeWith();
        const plan = buildMergePlan(current, [batchOf("a", { education: [{ id: "x", institution: "MIT", area: "CS", start: "2010" }] })]);
        const next = applyMergePlan(current, plan, none);
        expect(next.settings.contentSections).toContain("education");
        expect(next.settings.layout.sectionOrder).toContain("education");
    });
});

describe("applyMergePlan replace and new", () => {
    it("replace keeps id and creation time and holds only ticked rows", () => {
        const current = { ...resumeWith({ experience: [job({ id: "mine", company: "Old Co" })] }), id: "keep-me", createdAt: 123 };
        const plan = buildMergePlan(current, [
            batchOf("a", { basics: { name: "New Name" }, experience: [job({ company: "Globex" }), job({ company: "Initech", start: "2010" })] }),
        ]);
        const initech = plan.rows.find((row) => row.title.startsWith("Initech"))!;
        const next = applyMergePlan(current, plan, { ...none, rows: { [initech.id]: false } }, "replace");
        expect(next.id).toBe("keep-me");
        expect(next.createdAt).toBe(123);
        expect(next.experience.map((entry) => entry.company)).toEqual(["Globex"]);
        expect(next.basics.name).toBe("New Name");
    });

    it("new returns a fresh CV and leaves the current one untouched", () => {
        const current = resumeWith({ basics: { name: "Jane Doe" }, experience: [job({ id: "mine" })] });
        const before = structuredClone(current);
        const plan = buildMergePlan(current, [batchOf("a", { basics: { name: "Jane Doe" }, experience: [job({})] })]);
        const next = applyMergePlan(current, plan, none, "new");
        expect(current).toEqual(before);
        expect(next.id).toBeUndefined();
        expect(next.experience).toHaveLength(1);
    });
});

describe("summarizeSelection", () => {
    it("counts added entries and changed fields", () => {
        const current = resumeWith({ basics: { name: "Jane Doe", headline: "Engineer" }, experience: [job({ id: "mine", description: "Mine." })] });
        const plan = buildMergePlan(current, [
            batchOf("a", { basics: { name: "Jane Doe", headline: "Staff Engineer" }, experience: [job({ description: "Theirs." }), job({ company: "Globex" })] }),
        ]);
        expect(summarizeSelection(plan, none)).toEqual({ add: 1, update: 0 });
        const existing = plan.rows.find((row) => row.existing)!;
        const picked = { rows: { [existing.id]: true }, fields: { [existing.id]: { description: "a" } }, basics: { headline: "a" } };
        expect(summarizeSelection(plan, picked)).toEqual({ add: 1, update: 2 });
    });
});
