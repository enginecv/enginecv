import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildAgentsSnippet, buildLlmsTxt, buildSkillMarkdown } from "./skill";
import { SKILL_PUBLIC_DIR } from "./skill-urls";

// The committed files under public/ are generated; a stale copy would teach agents an old format.
const read = (name: string) =>
    fs.readFileSync(path.join(process.cwd(), "public", ...SKILL_PUBLIC_DIR.split("/"), name), "utf8").replace(/\r\n/g, "\n");

describe("committed agent skill files", () => {
    it.each([
        ["SKILL.md", buildSkillMarkdown],
        ["AGENTS-snippet.md", buildAgentsSnippet],
        ["llms.txt", buildLlmsTxt],
    ])("%s matches the generator (run `npm run gen:agent-skill`)", (name, build) => {
        expect(read(name)).toBe(build());
    });
});
