import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildAgentsSnippet, buildLlmsTxt, buildSkillMarkdown } from "../src/lib/agent/authoring/skill";
import { SKILL_PUBLIC_DIR } from "../src/lib/agent/authoring/skill-urls";
import { folderPublicFiles } from "../src/lib/workspace/agent-files";

/** Writes the agent skill files served from `public/agent/enginecv/`. Run `npm run gen:agent-skill` after the format changes. */
const FILES: Record<string, () => string> = {
    "SKILL.md": buildSkillMarkdown,
    "AGENTS-snippet.md": buildAgentsSnippet,
    "llms.txt": buildLlmsTxt,
};

async function main() {
    const dir = path.join(process.cwd(), "public", ...SKILL_PUBLIC_DIR.split("/"));
    await mkdir(dir, { recursive: true });
    const all: Record<string, string> = { ...Object.fromEntries(Object.entries(FILES).map(([name, build]) => [name, build()])), ...folderPublicFiles() };
    for (const [name, content] of Object.entries(all)) {
        const target = path.join(dir, ...name.split("/"));
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, content, "utf8");
        console.log(`wrote public/${SKILL_PUBLIC_DIR}/${name}`);
    }
}

void main();
