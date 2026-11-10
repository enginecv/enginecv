import { describe, expect, it } from "vitest";
import { createUngroupedSkillGroup } from "@/lib/schema";
import { buildMergePlan } from "./plan";
import { batchOf, resumeWith } from "./test-helpers";
import { CURRENT } from "./types";

const job = (fields: Record<string, unknown>) => ({ id: "e", company: "Acme", position: "Engineer", start: "2020-03", ...fields });

describe("buildMergePlan", () => {
    it("collapses the same job from two sources into one row with both origins", () => {
        const plan = buildMergePlan(
            resumeWith(),
            [batchOf("a", { experience: [job({})] }), batchOf("b", { experience: [job({ company: "ACME Inc.", start: "2020" })] })],
        );
        const rows = plan.rows.filter((row) => row.section === "experience");
        expect(rows).toHaveLength(1);
        expect(rows[0].origins.map((origin) => origin.batchId)).toEqual(["a", "b"]);
        expect(rows[0].defaultSelected).toBe(true);
    });

    it("offers the more precise date and the fuller text as the default", () => {
        const plan = buildMergePlan(
            resumeWith(),
            [
                batchOf("a", { experience: [job({ start: "2020", description: "Short." })] }),
                batchOf("b", { experience: [job({ start: "2020-03", description: "A longer, fuller description." })] }),
            ],
        );
        const conflicts = plan.rows[0].conflicts;
        expect(conflicts.find((conflict) => conflict.field === "start")?.defaultId).toBe("b");
        expect(conflicts.find((conflict) => conflict.field === "description")?.defaultId).toBe("b");
    });

    it("marks an item already in the CV and leaves it unticked", () => {
        const current = resumeWith({ experience: [job({ id: "mine", description: "Mine." })] });
        const plan = buildMergePlan(current, [batchOf("a", { experience: [job({ description: "Theirs." })] })]);
        const [row] = plan.rows;
        expect(row.existing?.id).toBe("mine");
        expect(row.defaultSelected).toBe(false);
        expect(row.conflicts.find((conflict) => conflict.field === "description")?.defaultId).toBe(CURRENT);
    });

    it("proposes filling a gap in the CV from a source", () => {
        const current = resumeWith({ experience: [job({ id: "mine", description: "" })] });
        const plan = buildMergePlan(current, [batchOf("a", { experience: [job({ description: "Filled." })] })]);
        expect(plan.rows[0].conflicts.find((conflict) => conflict.field === "description")?.defaultId).toBe("a");
    });

    it("does not list fields that agree", () => {
        const plan = buildMergePlan(resumeWith(), [batchOf("a", { experience: [job({})] }), batchOf("b", { experience: [job({})] })]);
        expect(plan.rows[0].conflicts).toEqual([]);
    });

    it("matches skills by name across groups and ignores case", () => {
        const current = resumeWith({ skillGroups: [createUngroupedSkillGroup([{ id: "s1", name: "React" } as never])] });
        const incoming = batchOf("a", { skillGroups: [{ id: "g", name: "Frontend", hidden: false, skills: [{ id: "s2", name: "react" }, { id: "s3", name: "Vue" }] }] });
        const rows = buildMergePlan(current, [incoming]).rows.filter((row) => row.section === "skills");
        expect(rows.find((row) => row.title === "react")?.existing?.id).toBe("s1");
        expect(rows.find((row) => row.title === "Vue")?.existing).toBeUndefined();
    });

    it("leaves a name-only project unticked and skips nameless entries", () => {
        const plan = buildMergePlan(resumeWith(), [batchOf("a", { projects: [{ id: "p", name: "Thin" }, { id: "q", name: "" }] })]);
        const rows = plan.rows.filter((row) => row.section === "projects");
        expect(rows).toHaveLength(1);
        expect(rows[0].defaultSelected).toBe(false);
    });

    it("counts an item listed twice in one source once", () => {
        const plan = buildMergePlan(resumeWith(), [batchOf("a", { experience: [job({ id: "1" }), job({ id: "2" })] })]);
        expect(plan.rows[0].origins).toHaveLength(1);
    });

    it("offers basics choices only where a source differs", () => {
        const current = resumeWith({ basics: { name: "Jane Doe", headline: "Engineer", email: "" } });
        const plan = buildMergePlan(current, [
            batchOf("a", { basics: { name: "Jane Doe", headline: "Staff Engineer", email: "jane@example.com" } }),
        ]);
        const fields = plan.basics.map((choice) => choice.field);
        expect(fields).toContain("headline");
        expect(fields).toContain("email");
        expect(fields).not.toContain("name");
        expect(plan.basics.find((choice) => choice.field === "headline")?.defaultId).toBe(CURRENT);
        expect(plan.basics.find((choice) => choice.field === "email")?.defaultId).toBe("a");
    });

    it("builds a plan for 300 entries quickly", () => {
        const many = (prefix: string) => Array.from({ length: 300 }, (_, i) => ({ id: `${prefix}${i}`, company: `Company ${i}`, position: `Role ${i}`, start: "2020" }));
        const start = performance.now();
        const plan = buildMergePlan(resumeWith({ experience: many("c") }), [batchOf("a", { experience: many("a") }), batchOf("b", { experience: many("b") })]);
        expect(plan.rows.filter((row) => row.section === "experience")).toHaveLength(300);
        expect(performance.now() - start).toBeLessThan(3000);
    });
});
