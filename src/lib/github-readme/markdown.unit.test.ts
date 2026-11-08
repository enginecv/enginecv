import { describe, expect, it } from "vitest";
import { toDocumentModel } from "@/lib/document-model";
import { createQaEdgeCaseResume, createQaFullResume, createQaMinimalResume, QA_HIDDEN_MARKER } from "@/lib/qa/sample-resumes";
import { createEmptyResume, resumeSchema, type Resume } from "@/lib/schema";
import { README_REFERRAL_URL, skillBadge, toGithubReadme } from "./markdown";
import { defaultReadmeOptions, type ReadmeOptions } from "./options";
import { README_FILES } from "./package";

function makeResume(overrides: Record<string, unknown>): Resume {
    return resumeSchema.parse({ ...createEmptyResume(), ...overrides });
}

function readme(resume: Resume, options: Partial<ReadmeOptions> = {}): string {
    return toGithubReadme(toDocumentModel(resume), { ...defaultReadmeOptions(), ...options });
}

const full = () => readme(createQaFullResume());

/** Mirrors GitHub's sanitizer rules for what this export may emit. */
function assertGithubSafe(markdown: string) {
    // A backslash-escaped `\<b\>` renders as literal text, not a tag.
    const tags = [...markdown.matchAll(/(?<!\\)<\/?([a-zA-Z][\w-]*)/g)].map((match) => match[1].toLowerCase());
    for (const tag of tags) expect(["picture", "source", "img", "sub"]).toContain(tag);
    expect(markdown).not.toMatch(/\sstyle\s*=/i);
    expect(markdown).not.toMatch(/\son\w+\s*=/i);
    expect(markdown).not.toMatch(/javascript:/i);
    // Markdown isn't parsed inside the snippet's HTML attributes.
    const prose = markdown.replace(/<picture>[\s\S]*?<\/picture>/, "");
    for (const [, target] of prose.matchAll(/(?<!\\)\]\(([^)\s]+)\)/g)) {
        const relative = [`./${README_FILES.cardLight}`, `./${README_FILES.cardDark}`, "./cv.pdf"];
        expect(relative.includes(target) || /^(https?:|mailto:)/.test(target)).toBe(true);
    }
}

describe("toGithubReadme", () => {
    it("emits the blocks in contract order", () => {
        const markdown = readme(createQaFullResume(), { includeContact: true, includeFullCv: true, credit: true });
        const order = ["<picture>", "# Amina", "📍", "## Summary", "## Skills", "## Experience", "## Projects", "## Links", "📄", "<sub>"];
        const positions = order.map((marker) => markdown.indexOf(marker));
        expect(positions.every((position) => position >= 0)).toBe(true);
        expect([...positions].sort((a, b) => a - b)).toEqual(positions);
        expect(markdown.endsWith("\n")).toBe(true);
    });

    it("never includes hidden content", () => {
        expect(full()).not.toContain(QA_HIDDEN_MARKER);
    });

    it("omits empty sections and the card without a name", () => {
        const minimal = readme(createQaMinimalResume());
        expect(minimal).toBe("<picture>\n  <source media=\"(prefers-color-scheme: dark)\" srcset=\"./enginecv-card-dark.svg\">\n  <img alt=\"Minimal Person\" src=\"./enginecv-card-light.svg\">\n</picture>\n\n# Minimal Person\n");

        const edge = readme(createQaEdgeCaseResume());
        expect(edge).not.toContain("<picture>");
        expect(edge).not.toMatch(/^# /m);
        expect(edge).not.toContain("## Experience");
    });

    it("caps roles, projects and skills", () => {
        const resume = createQaFullResume();
        const capped = readme(resume, { maxRoles: 1, maxProjects: 0, maxSkills: 2 });
        const experience = capped.split("## Experience")[1].split("##")[0];
        expect(experience.match(/^- /gm)).toHaveLength(1);
        expect(capped).not.toContain("## Projects");
        expect(capped.match(/img\.shields\.io/g)).toHaveLength(2);

        const edgeSkills = readme(createQaEdgeCaseResume()).match(/img\.shields\.io/g);
        expect(edgeSkills).toHaveLength(15);
    });

    it("clamps out-of-range caps", () => {
        const markdown = readme(createQaFullResume(), { maxRoles: 0, maxSkills: 999 });
        const experience = markdown.split("## Experience")[1].split("##")[0];
        expect(experience.match(/^- /gm)).toHaveLength(1);
    });

    it("shortens the summary to its first paragraph, at most 400 characters", () => {
        const long = `${"word ".repeat(120)}\n\nSecond paragraph.`;
        const markdown = readme(makeResume({ basics: { name: "A", summary: long } }));
        const summary = markdown.split("## Summary\n\n")[1].split("\n")[0];
        expect(Array.from(summary).length).toBeLessThanOrEqual(400);
        expect(summary.endsWith("…")).toBe(true);
        expect(markdown).not.toContain("Second paragraph");
    });

    it("strips Markdown from the summary instead of cutting through it", () => {
        const markdown = readme(makeResume({ basics: { name: "A", summary: "Led **storage** at [Acme](https://acme.example)." } }));
        expect(markdown).toContain("Led storage at Acme.");
    });

    it("escapes Markdown-sensitive characters in user text", () => {
        const markdown = readme(makeResume({ basics: { name: "*Jane* [x](y) <b>", headline: "# not a heading", location: "a|b" } }));
        expect(markdown).toContain("# \\*Jane\\* \\[x\\](y) \\<b\\>");
        expect(markdown).toContain("\\# not a heading");
        expect(markdown).toContain("📍 a\\|b");
        assertGithubSafe(markdown);
    });

    it("escapes the card alt text as an HTML attribute", () => {
        const markdown = readme(makeResume({ basics: { name: "Jo \"Q\" <x>", headline: "A&B" } }));
        expect(markdown).toContain('alt="Jo &quot;Q&quot; &lt;x&gt; — A&amp;B"');
    });

    it("drops links with unsafe schemes", () => {
        const markdown = readme(makeResume({
            basics: { name: "A", customLinks: [{ id: "l1", name: "Evil", url: "javascript:alert(1)", label: "Evil", icon: "auto" }] },
            projects: [{ id: "p1", name: "Proj", url: "javascript:alert(1)" }],
        }));
        expect(markdown).not.toMatch(/javascript:/i);
        assertGithubSafe(markdown);
    });

    it("leaves email and phone out unless contact is on", () => {
        const resume = createQaFullResume();
        expect(readme(resume)).not.toContain("mailto:");
        expect(readme(resume)).not.toContain("+387");
        expect(readme(resume, { includeContact: true })).toContain("mailto:amina@example.com");
    });

    it("renders skills as plain text when asked", () => {
        const markdown = readme(createQaFullResume(), { skillStyle: "text" });
        expect(markdown).not.toContain("img.shields.io");
        expect(markdown).toContain("Rust · Go · Kubernetes");
    });

    it("doubles shields.io separators in badge messages", () => {
        expect(skillBadge("C_sharp-dev")).toContain("badge/C__sharp--dev-informational");
        expect(skillBadge("C++")).toContain("badge/C%2B%2B-informational");
    });

    it("links the full CV by its file name and falls back on invalid names", () => {
        expect(readme(createQaFullResume(), { includeFullCv: true, fullCvFile: "amina.pdf" })).toContain("](./amina.pdf)");
        expect(readme(createQaFullResume(), { includeFullCv: true, fullCvFile: "../x.exe" })).toContain("](./cv.pdf)");
    });

    it("adds the EngineCV line only when credit is on", () => {
        expect(full()).not.toContain(README_REFERRAL_URL);
        expect(readme(createQaFullResume(), { credit: true })).toContain(`<sub>[Built with EngineCV](${README_REFERRAL_URL})</sub>`);
    });

    it("toggles sections off", () => {
        const markdown = readme(createQaFullResume(), {
            sections: { headline: false, location: false, summary: false, skills: false, experience: false, projects: false, links: false },
            includeCard: false,
        });
        expect(markdown).toBe("# Amina Šehić-Đurić\n");
    });

    it.each([
        ["de", "Erfahrung", "Vollständiger Lebenslauf (PDF)"],
        ["bs", "Iskustvo", "Kompletan CV (PDF)"],
        ["fr", "Compétences", "CV complet (PDF)"],
        ["es", "Experiencia", "CV completo (PDF)"],
        ["it", null, "Full CV (PDF)"],
    ])("uses CV language %s for headings", (language, heading, fullCv) => {
        const resume = createQaFullResume();
        resume.settings.language = language;
        const markdown = readme(resume, { includeFullCv: true });
        if (heading) expect(markdown).toContain(`## ${heading}`);
        expect(markdown).toContain(fullCv);
    });

    it("passes the GitHub allowlist on every QA fixture with everything on", () => {
        for (const create of [createQaFullResume, createQaMinimalResume, createQaEdgeCaseResume]) {
            assertGithubSafe(readme(create(), { includeContact: true, includeFullCv: true, credit: true }));
        }
    });
});
