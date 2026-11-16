import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildAgentsSnippet, buildLlmsTxt, buildSkillMarkdown } from "../src/lib/agent/authoring/skill";
import { SKILL_PUBLIC_DIR } from "../src/lib/agent/authoring/skill-urls";

/** Writes the agent skill files served from `public/agent/enginecv/`. Run `npm run gen:agent-skill` after the format changes. */
const FILES: Record<string, () => string> = {
    "SKILL.md": buildSkillMarkdown,
    "AGENTS-snippet.md": buildAgentsSnippet,
    "llms.txt": buildLlmsTxt,
};

async function main() {
    const dir = path.join(process.cwd(), "public", ...SKILL_PUBLIC_DIR.split("/"));
    await mkdir(dir, { recursive: true });
    for (const [name, build] of Object.entries(FILES)) {
        await writeFile(path.join(dir, name), build(), "utf8");
        console.log(`wrote public/${SKILL_PUBLIC_DIR}/${name}`);
    }
}

void main();
