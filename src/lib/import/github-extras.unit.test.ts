import { describe, expect, it } from "vitest";
import { groupContributions, manifestsFor, profileReadmeToSummary, readmeToSummary, stackFromManifest } from "./github-extras";

describe("readmeToSummary", () => {
    it("skips the title, badges and code and returns the first real paragraph as plain text", () => {
        const readme = `# engine-cv\n\n[![CI](https://x/y.svg)](https://x) ![logo](a.png)\n\nA **local-first** resume builder with [live preview](https://example.com) and exports.\n\n## Install\n\n\`\`\`sh\nnpm i\n\`\`\`\n`;
        expect(readmeToSummary(readme)).toBe("A local-first resume builder with live preview and exports.");
    });

    it("returns nothing for a README with no prose, and cuts a long paragraph at a sentence", () => {
        expect(readmeToSummary("# Title\n\n- one\n- two\n")).toBe("");
        const long = `${"This tool does one useful thing well. ".repeat(20)}`;
        const summary = readmeToSummary(long, 100);
        expect(summary.length).toBeLessThanOrEqual(101);
        expect(summary.endsWith(".")).toBe(true);
    });

    it("strips html and never lets markup through", () => {
        expect(readmeToSummary('<h1 align="center">x</h1>\n\nBuilds <b>fast</b> command line tools for <script>alert(1)</script> data work.')).toBe("Builds fast command line tools for alert(1) data work.");
    });

    it("takes up to two paragraphs for a profile README", () => {
        const text = profileReadmeToSummary("# Hi\n\nI build tools for people who write a lot of documentation.\n\nCurrently learning Rust and compilers in my spare time.\n\nThird paragraph is ignored here.");
        expect(text).toContain("documentation");
        expect(text).toContain("Rust");
        expect(text).not.toContain("Third");
    });
});

describe("stackFromManifest", () => {
    it("recognises known technologies only, in file order, without duplicates", () => {
        const pkg = JSON.stringify({ dependencies: { react: "1", "react-dom": "1", next: "1", "left-pad": "1" }, devDependencies: { typescript: "5", vitest: "3" } });
        expect(stackFromManifest("npm", pkg)).toEqual(["React", "Next.js", "TypeScript", "Vitest"]);
        expect(stackFromManifest("npm", "{ not json")).toEqual([]);
    });

    it("reads requirements, pyproject, go.mod, Cargo.toml, pom.xml, composer.json and a Gemfile", () => {
        expect(stackFromManifest("python", "fastapi==0.1\n# django\npydantic>=2\nobscure-lib\n")).toEqual(["FastAPI", "Pydantic"]);
        expect(stackFromManifest("python", '[project]\ndependencies = ["django>=5", "celery"]\n')).toEqual(["Django", "Celery"]);
        expect(stackFromManifest("go", "module x\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.0\n\tgorm.io/gorm v1.25.0\n)\n")).toEqual(["Gin", "GORM"]);
        expect(stackFromManifest("rust", '[dependencies]\ntokio = { version = "1" }\nserde = "1"\nsome-crate = "1"\n')).toEqual(["Tokio", "Serde"]);
        expect(stackFromManifest("maven", "<dependency><artifactId>spring-boot-starter-web</artifactId></dependency><artifactId>junit</artifactId>")).toEqual(["Spring Boot", "JUnit"]);
        expect(stackFromManifest("composer", JSON.stringify({ require: { "laravel/framework": "^11" } }))).toEqual(["Laravel"]);
        expect(stackFromManifest("ruby", "gem 'rails'\ngem 'pg'\n")).toEqual(["Ruby on Rails", "PostgreSQL"]);
    });

    it("keeps at most the limit and asks only for files that fit the main language", () => {
        const many = JSON.stringify({ dependencies: { react: "1", next: "1", vue: "1", svelte: "1", express: "1" } });
        expect(stackFromManifest("npm", many, 3)).toHaveLength(3);
        expect(manifestsFor("Go")).toEqual([{ file: "go.mod", kind: "go" }]);
        expect(manifestsFor("Haskell")).toEqual([]);
    });
});

describe("groupContributions", () => {
    it("groups merged pull requests by project, most active first, with a few titles", () => {
        const items = [
            { repository_url: "https://api.github.com/repos/vercel/next.js", title: "Fix **image** loader", html_url: "x" },
            { repository_url: "https://api.github.com/repos/vercel/next.js", title: "Docs: typo", html_url: "x" },
            { repository_url: "https://api.github.com/repos/Vercel/next.js", title: "Another", html_url: "x" },
            { repository_url: "https://api.github.com/repos/a/b", title: "One", html_url: "x" },
            { repository_url: "nonsense", title: "Ignored" },
        ];
        const grouped = groupContributions(items);
        expect(grouped.map((entry) => [entry.repo, entry.mergedPrs])).toEqual([["vercel/next.js", 3], ["a/b", 1]]);
        expect(grouped[0].titles).toEqual(["Fix image loader", "Docs: typo", "Another"]);
        expect(grouped[0].url).toBe("https://github.com/vercel/next.js");
    });
});
