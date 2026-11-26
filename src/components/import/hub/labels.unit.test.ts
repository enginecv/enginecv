import { describe, expect, it } from "vitest";
import { entryDetails } from "./labels";

const asIs = (value: string) => value;

describe("entryDetails", () => {
    it("lists dates, facts the title leaves out, and the link", () => {
        const details = entryDetails(
            "experience",
            { id: "1", company: "Acme", position: "Engineer", start: "2021-03", end: "Present", location: "Berlin", url: "https://www.acme.dev/" },
            (value) => `<${value}>`,
        );
        // Company and position are the title, so they are not repeated.
        expect(details.meta).toEqual(["<2021-03> – <Present>", "Berlin", "acme.dev"]);
    });

    it("uses a single date when the section has one", () => {
        expect(entryDetails("certificates", { id: "1", name: "AWS", issuer: "Amazon", date: "2024" }, asIs).meta).toEqual(["2024"]);
    });

    it("reads the description as plain text", () => {
        const details = entryDetails("projects", { id: "1", name: "engine", description: "A **fast** `cv` tool.\n\n- one\n- two" }, asIs);
        expect(details.text).toBe("A fast cv tool. one two");
    });

    it("falls back to the highlights, and joins keywords and skills without repeats", () => {
        const details = entryDetails(
            "projects",
            { id: "1", name: "engine", description: "", highlights: ["Shipped v1", "Wrote docs"], keywords: ["TypeScript", "React"], skills: ["React", "Next.js"] },
            asIs,
        );
        expect(details.text).toBe("Shipped v1 · Wrote docs");
        expect(details.tags).toEqual(["TypeScript", "React", "Next.js"]);
    });

    it("is empty for an entry with nothing but a name", () => {
        expect(entryDetails("skills", { id: "1", name: "Go" }, asIs)).toEqual({ meta: [], text: "", tags: [] });
    });
});
