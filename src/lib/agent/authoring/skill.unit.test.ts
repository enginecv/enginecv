import { describe, expect, it } from "vitest";
import { authoringToResume } from "./to-resume";
import { parseAuthoringText } from "./parse-text";
import { AUTHORING_EXAMPLE } from "./instructions";
import { serializeAuthoring } from "./from-resume";
import { AUTHORING_SCHEMA_URL, BASICS_FIELDS, LIST_SECTION_KEYS } from "./schema";
import { buildAgentsSnippet, buildLlmsTxt, buildSkillMarkdown } from "./skill";

describe("buildSkillMarkdown", () => {
    const skill = buildSkillMarkdown();

    it("has the skill frontmatter", () => {
        expect(skill.startsWith("---\nname: enginecv\ndescription: ")).toBe(true);
        expect(skill.split("---")[1]).toContain("name: enginecv");
    });

    it("names every section key and every basics field", () => {
        for (const key of [...LIST_SECTION_KEYS, "declaration", "skills", "languages", "interests", "custom"]) {
            expect(skill).toContain(key);
        }
        for (const field of Object.keys(BASICS_FIELDS)) expect(skill).toContain(`\`${field}\``);
    });

    it("links the schema and carries the rules, scope and privacy warning", () => {
        expect(skill).toContain(AUTHORING_SCHEMA_URL);
        expect(skill).toContain("Do not edit `design`");
        expect(skill).toContain("small targeted edits");
        expect(skill).toContain("Do not re-output or rewrite the whole file");
        expect(skill).not.toContain("in one operation");
        expect(skill).toContain("Do not rename or move the file");
        expect(skill).toContain("model provider");
        expect(skill).toContain("Out of scope");
    });

    it("embeds a worked example that imports without a single notice", () => {
        const match = skill.match(/```json\n([\s\S]*?)\n```/);
        expect(match?.[1]).toBe(serializeAuthoring(AUTHORING_EXAMPLE, "pretty"));
        const parsed = parseAuthoringText(match![1]);
        expect(parsed.status).toBe("ok");
        expect(parsed.notices).toEqual([]);
        expect(authoringToResume(parsed.document).notices).toEqual([]);
    });

    it("matches its snapshot", () => {
        expect(skill).toMatchSnapshot();
    });
});

describe("snippet and llms.txt", () => {
    it("carry the rules and point at the skill and schema", () => {
        const snippet = buildAgentsSnippet();
        expect(snippet).toContain("https://enginecv.app/agent/enginecv/SKILL.md");
        expect(snippet).toContain("Keep entry `id` values");
        const llms = buildLlmsTxt();
        expect(llms).toContain(AUTHORING_SCHEMA_URL);
        expect(llms).toContain("SKILL.md");
    });
});
