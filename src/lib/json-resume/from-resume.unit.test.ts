import { describe, expect, it } from "vitest";
import { createQaFullResume, createQaMinimalResume } from "@/lib/qa/sample-resumes";
import full from "@/lib/__fixtures__/json-resume/full.json";
import { resumeToJsonResume } from "./from-resume";
import type { ConversionReport } from "./report";
import { jsonResumeToResume } from "./to-resume";

function item(report: ConversionReport, code: string, section = "") {
    return report.items.find((entry) => entry.code === code && entry.section === section);
}

const NOW = new Date("2026-11-10T10:00:00Z");

describe("resumeToJsonResume", () => {
    it("writes basics, location parts and profiles", () => {
        const { resume } = jsonResumeToResume(full);
        const { document } = resumeToJsonResume(resume, { now: NOW });
        expect(document.basics).toMatchObject({
            name: "John Doe",
            label: "Senior Software Engineer",
            email: "john@example.com",
            url: "https://johndoe.example.com",
            location: { address: "2712 Broadway St", postalCode: "CA 94115", city: "San Francisco", region: "California", countryCode: "US" },
        });
        expect((document.basics as { profiles: unknown[] }).profiles).toEqual([
            { network: "LinkedIn", username: "johndoe", url: "https://www.linkedin.com/in/johndoe" },
            { network: "GitHub", username: "johndoe", url: "https://github.com/johndoe" },
            { network: "Mastodon", username: "john", url: "https://mastodon.example/@john" },
        ]);
    });

    it("puts plain location text into city and reports parts only when they were dropped", () => {
        const { resume } = jsonResumeToResume(full);
        const plain = { ...resume, basics: { ...resume.basics, locationParts: { address: "", postalCode: "", city: "", region: "", countryCode: "" }, location: "Berlin, Germany" } };
        const first = resumeToJsonResume(plain, { now: NOW });
        expect((first.document.basics as { location: unknown }).location).toEqual({ city: "Berlin, Germany" });
        expect(item(first.report, "location-parts-simplified", "basics")).toBeUndefined();

        const edited = { ...resume, basics: { ...resume.basics, location: "Somewhere else" } };
        const second = resumeToJsonResume(edited, { now: NOW });
        expect((second.document.basics as { location: unknown }).location).toEqual({ city: "Somewhere else" });
        expect(item(second.report, "location-parts-simplified", "basics")).toBeDefined();
    });

    it("omits empty fields and the end date of a current role", () => {
        const { resume } = jsonResumeToResume(full);
        const { document } = resumeToJsonResume(resume, { now: NOW });
        const work = document.work as Record<string, unknown>[];
        expect(work[0]).toMatchObject({ name: "Acme Systems", position: "Senior Engineer", startDate: "2019-06" });
        expect(work[0]).not.toHaveProperty("endDate");
        expect(work[1]).toMatchObject({ startDate: "2015", endDate: "2019-05" });
        expect(Object.values(work[1]).some((value) => value === "" || (Array.isArray(value) && value.length === 0))).toBe(false);
    });

    it("writes the meta block", () => {
        const { document } = resumeToJsonResume(createQaMinimalResume(), { now: NOW });
        expect(document.meta).toEqual({ version: "v1.0.0", lastModified: "2026-11-10T10:00:00" });
    });

    it("skips hidden entries and counts them", () => {
        const { resume } = jsonResumeToResume(full);
        const hiding = { ...resume, experience: resume.experience.map((entry, index) => (index === 1 ? { ...entry, hidden: true } : entry)) };
        const { document, report } = resumeToJsonResume(hiding, { now: NOW });
        expect(document.work).toHaveLength(1);
        expect(item(report, "hidden-entries-left-out", "experience")?.count).toBe(1);
    });

    it("includes the photo only when asked", () => {
        const { resume } = jsonResumeToResume({ basics: { name: "A", image: "data:image/png;base64,AAAA" } });
        const off = resumeToJsonResume(resume, { now: NOW });
        expect(off.document.basics).not.toHaveProperty("image");
        expect(item(off.report, "photo-left-out", "basics")).toBeDefined();

        const on = resumeToJsonResume(resume, { now: NOW, includePhoto: true });
        expect((on.document.basics as { image: string }).image).toBe("data:image/png;base64,AAAA");
        expect(item(on.report, "photo-left-out", "basics")).toBeUndefined();
    });

    it("flattens skill groups and writes level words", () => {
        const { resume } = jsonResumeToResume(full);
        const { document } = resumeToJsonResume(resume, { now: NOW });
        expect(document.skills).toEqual([
            { name: "Go", level: "Expert", keywords: ["Concurrency", "gRPC"] },
            { name: "PostgreSQL", level: "Competent" },
            { name: "Distributed systems" },
        ]);

        const grouped = {
            ...resume,
            skillGroups: [
                ...resume.skillGroups,
                { id: "g1", name: "Tools", hidden: false, skills: [{ ...resume.skillGroups[0].skills[0], id: "s9", name: "Make" }] },
            ],
        };
        const { report } = resumeToJsonResume(grouped, { now: NOW });
        expect(item(report, "skill-groups-flattened", "skills")?.count).toBe(1);
    });

    it("reports a CV with every lossy feature, and only those", () => {
        const { report } = resumeToJsonResume(createQaFullResume(), { now: NOW });
        const codes = report.items.map((entry) => entry.code);
        expect(codes).toContain("personal-details-left-out");
        expect(codes).toContain("entry-extras-left-out");
        for (const entry of report.items) {
            expect(entry.kind === "left-out" || entry.kind === "changed").toBe(true);
        }
    });

    it("reports nothing for a CV that loses nothing", () => {
        const { resume } = jsonResumeToResume({
            basics: { name: "Jane Doe", label: "Engineer", email: "jane@example.com" },
            work: [{ name: "Acme", position: "Dev", startDate: "2020-01", endDate: "2021-01", highlights: ["Shipped it"] }],
        });
        const { report } = resumeToJsonResume(resume, { now: NOW });
        expect(report.items).toEqual([]);
    });
});
