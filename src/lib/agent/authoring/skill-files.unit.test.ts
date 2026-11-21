import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildAgentsSnippet, buildLlmsTxt, buildSkillMarkdown } from "./skill";
import { SKILL_PUBLIC_DIR } from "./skill-urls";
import { folderPublicFiles } from "@/lib/workspace/agent-files";

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

    it.each(Object.entries(folderPublicFiles()))("%s matches the workspace generator", (name, text) => {
        expect(read(name)).toBe(text);
    });

    it("llms.txt points at the folder-based flow", () => {
        expect(buildLlmsTxt()).toContain("Workspace folder");
        expect(buildLlmsTxt()).toContain("/agent/enginecv/folder/AGENTS.md");
    });
});
