import { describe, expect, it } from "vitest";
import { createEmptyResume, createUngroupedSkillGroup, skillSchema } from "@/lib/schema";
import { makeCv } from "../../../test/setup/letter-fixtures";
import { CHIP_END, CHIP_START, CHIP_UNRESOLVED_START, SKILLS_TOKEN_LIMIT, findTokens, stripChipMarkers, substituteTokens, tokenValues } from "./tokens";

describe("findTokens", () => {
    it("lists tokens in order, lower-cased, with known and unknown marked", () => {
        expect(findTokens("Hi {{Name}}, a {{ role }} in {{city}}")).toEqual([
            { name: "name", known: true },
            { name: "role", known: true },
            { name: "city", known: false },
        ]);
    });

    it("finds tokens inside bold and list items", () => {
        expect(findTokens("**{{name}}**\n- {{skills}}").map((token) => token.name)).toEqual(["name", "skills"]);
    });
});

describe("tokenValues", () => {
    it("reads name, role, location and the first skills in CV order", () => {
        const values = tokenValues(makeCv());
        expect(values.name).toBe("Amina Hodzic");
        expect(values.role).toBe("Senior Product Designer");
        expect(values.location).toBe("Berlin, Germany");
        expect(values.skills.split(", ")).toEqual(["Figma", "Design systems", "Prototyping", "User research", "Accessibility"]);
        expect(values.skills.split(", ")).toHaveLength(SKILLS_TOKEN_LIMIT);
    });

    it("falls back to the latest visible job title when there is no headline", () => {
        const cv = makeCv({ headline: "" });
        cv.experience = [
            { ...createEmptyResume().experience[0], id: "a", hidden: true, position: "Hidden role" },
            { ...createEmptyResume().experience[0], id: "b", hidden: false, position: "Lead Designer" },
        ] as typeof cv.experience;
        expect(tokenValues(cv).role).toBe("Lead Designer");
    });

    it("skips hidden skills and hidden groups", () => {
        const cv = makeCv();
        cv.skillGroups = [
            { ...createUngroupedSkillGroup([skillSchema.parse({ name: "Shown" }), skillSchema.parse({ name: "Hidden", hidden: true })]) },
            { id: "g", name: "Secret", hidden: true, skills: [skillSchema.parse({ name: "InHiddenGroup" })] },
        ];
        expect(tokenValues(cv).skills).toBe("Shown");
    });

    it("returns empty strings for what the CV does not have", () => {
        const values = tokenValues(createEmptyResume());
        expect(values).toEqual({ name: "", role: "", location: "", skills: "" });
    });
});

describe("substituteTokens", () => {
    const values = { name: "Amina", role: "Designer", location: "", skills: "" };

    it("replaces tokens with their values and leaves no braces", () => {
        const { text, unresolved } = substituteTokens("I am {{name}}, a {{role}}.", values);
        expect(text).toBe("I am Amina, a Designer.");
        expect(unresolved).toEqual([]);
    });

    it("reports empty and unknown tokens and prints nothing for them", () => {
        const { text, unresolved } = substituteTokens("From {{location}} with {{skills}} and {{pet}}.", values);
        expect(text).toBe("From  with  and .");
        expect(unresolved).toEqual(["location", "skills", "pet"]);
        expect(text).not.toContain("{{");
    });

    it("wraps values in chip markers for the preview, flagging unresolved ones", () => {
        const { text } = substituteTokens("{{name}} {{location}}", values, { chips: true });
        expect(text).toBe(`${CHIP_START}Amina${CHIP_END} ${CHIP_UNRESOLVED_START}location${CHIP_END}`);
        expect(stripChipMarkers(text)).toBe("Amina location");
    });

    it("keeps exclamation marks in text when stripping markers", () => {
        expect(stripChipMarkers(`Hello!${CHIP_START}x${CHIP_END}`)).toBe("Hello!x");
    });
});
