import { describe, expect, it } from "vitest";
import { detailsFromForm, emptyDetailsForm, formFromApplication } from "./form";
import { archive, changeStage, newApplication, trash } from "./operations";
import type { JobApplication } from "./schema";
import { EMPTY_FILTERS, allTags, filterApplications, findPossibleDuplicate, groupByStage, hasActiveFilters, sortApplications, summarize } from "./selectors";

let counter = 0;
const ctx = (now = 1000) => ({ now, newId: () => `id-${++counter}` });
const job = (input: Partial<JobApplication> & { company: string; role: string }, now = 1000): JobApplication => ({
    ...newApplication({ company: input.company, role: input.role }, ctx(now)),
    ...input,
});

const acme = job({ company: "Acme", role: "Designer", tags: ["Remote"], location: "Sarajevo", workingCvId: "cv-1", updatedAt: 3 });
const globex = changeStage(job({ company: "Globex", role: "Engineer", tags: ["remote", "Senior"], notesMarkdown: "Ask about the visa", updatedAt: 2 }), "offer", ctx());
const initech = changeStage(job({ company: "Initech", role: "Analyst", workingLetterId: "l-1", updatedAt: 1 }), "rejected", ctx());
const archived = archive(job({ company: "Hooli", role: "PM" }), ctx());
const trashed = trash(job({ company: "Umbrella", role: "Chemist" }), ctx());
const all = [acme, globex, initech, archived, trashed];

describe("filtering applications", () => {
    it("shows current records by default, hiding archived and trashed ones", () => {
        expect(filterApplications(all, EMPTY_FILTERS).map((item) => item.company)).toEqual(["Acme", "Globex", "Initech"]);
        expect(filterApplications(all, { ...EMPTY_FILTERS, scope: "archived" }).map((item) => item.company)).toEqual(["Hooli"]);
        expect(filterApplications(all, { ...EMPTY_FILTERS, scope: "trash" }).map((item) => item.company)).toEqual(["Umbrella"]);
    });

    it("searches company, role, tags, location and notes without case", () => {
        const search = (query: string) => filterApplications(all, { ...EMPTY_FILTERS, query }).map((item) => item.company);
        expect(search("sarajevo")).toEqual(["Acme"]);
        expect(search("VISA")).toEqual(["Globex"]);
        expect(search("senior")).toEqual(["Globex"]);
        expect(search("analyst")).toEqual(["Initech"]);
    });

    it("combines filters with AND and values inside one filter with OR", () => {
        expect(filterApplications(all, { ...EMPTY_FILTERS, stages: ["saved", "offer"] }).map((item) => item.company)).toEqual(["Acme", "Globex"]);
        expect(filterApplications(all, { ...EMPTY_FILTERS, stages: ["saved", "offer"], tags: ["senior"] }).map((item) => item.company)).toEqual(["Globex"]);
        expect(filterApplications(all, { ...EMPTY_FILTERS, documents: ["cv", "letter"] }).map((item) => item.company)).toEqual(["Acme", "Initech"]);
        expect(filterApplications(all, { ...EMPTY_FILTERS, documents: ["none"] }).map((item) => item.company)).toEqual(["Globex"]);
        expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
        expect(hasActiveFilters({ ...EMPTY_FILTERS, query: " x " })).toBe(true);
    });
});

describe("sorting, grouping and counting", () => {
    it("sorts by latest update, then by company or role", () => {
        expect(sortApplications([initech, acme, globex], "updated", "en").map((item) => item.company)).toEqual(["Acme", "Globex", "Initech"]);
        expect(sortApplications([globex, initech, acme], "company", "en").map((item) => item.company)).toEqual(["Acme", "Globex", "Initech"]);
        expect(sortApplications([acme, globex, initech], "role", "en").map((item) => item.role)).toEqual(["Analyst", "Designer", "Engineer"]);
    });

    it("groups by stage and counts active records independently of filters", () => {
        const groups = groupByStage([acme, globex, initech]);
        expect(groups.saved).toEqual([acme]);
        expect(groups.offer).toEqual([globex]);
        expect(groups.rejected).toEqual([initech]);
        expect(summarize(all)).toEqual({ active: 2, offers: 1, archived: 1, trashed: 1 });
    });

    it("lists tags once, first spelling kept, ignoring the trash", () => {
        expect(allTags(all, "en")).toEqual(["Remote", "Senior"]);
    });
});

describe("possible duplicates", () => {
    it("matches the same link, ignoring the fragment and a trailing slash", () => {
        const withUrl = job({ company: "Acme", role: "Designer", jobUrl: "https://jobs.example/acme/42/" });
        expect(findPossibleDuplicate([withUrl], { company: "Other", role: "Other", jobUrl: "https://JOBS.example/acme/42#apply" })?.reason).toBe("url");
    });

    it("matches company and role regardless of case and spacing, but not trashed records", () => {
        expect(findPossibleDuplicate(all, { company: " acme ", role: "designer", jobUrl: null })).toMatchObject({ reason: "company-role", application: { id: acme.id } });
        expect(findPossibleDuplicate(all, { company: "Umbrella", role: "Chemist", jobUrl: null })).toBeNull();
    });
});

describe("details form", () => {
    it("turns empty optional text into null and parses pay", () => {
        const result = detailsFromForm({ ...emptyDetailsForm(), company: " Acme ", role: "Designer", payMin: "50 000", payMax: "60000", payCurrency: "eur", tags: "Remote, remote, Senior" });
        expect(result).toEqual({
            ok: true,
            details: expect.objectContaining({ company: "Acme", jobUrl: null, location: null, compensation: { min: 50000, max: 60000, currency: "EUR", period: "year" }, tags: ["Remote", "Senior"] }),
        });
    });

    it("names each field that needs fixing", () => {
        const result = detailsFromForm({ ...emptyDetailsForm(), role: "Designer", jobUrl: "javascript:alert(1)", deadline: "2026-02-30", payMin: "9", payMax: "5" });
        expect(result).toEqual({ ok: false, errors: { company: "jobs.form.error.required", jobUrl: "jobs.form.error.url", deadline: "jobs.form.error.date", payMax: "jobs.form.error.range", payCurrency: "jobs.form.error.currency" } });
    });

    it("round-trips a stored application", () => {
        const stored = { ...acme, compensation: { min: null, max: 70000, currency: "BAM", period: "month" as const }, deadline: "2026-12-01" };
        const result = detailsFromForm(formFromApplication(stored));
        expect(result.ok && result.details).toMatchObject({ compensation: stored.compensation, deadline: "2026-12-01", tags: ["Remote"], location: "Sarajevo" });
    });
});
