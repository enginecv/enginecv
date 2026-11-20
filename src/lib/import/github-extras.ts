/**
 * Reading what a repository says about itself: the first paragraph of its README, and the technologies
 * its dependency files name. Everything here is pure and defensive: the text comes from other people's
 * repositories, so it is cut down to plain short text and only technologies on a known list are kept.
 */

const BLOCK_SKIP = /^(#|\||>|!\[|\[!\[|<|---|===|```|~~~|\*\*\*)/;
const LIST_LINE = /^\s*([-*+]|\d+[.)])\s+/;

function plainText(markdown: string): string {
    return markdown
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
        .replace(/<[^>]*>/g, "")
        .replace(/`+/g, "")
        .replace(/(\*\*|__|\*|_)(.+?)\1/g, "$2")
        .replace(/&[a-z]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function cut(text: string, max: number): string {
    if (text.length <= max) return text;
    const slice = text.slice(0, max);
    const sentence = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
    if (sentence >= max * 0.5) return slice.slice(0, sentence + 1).trim();
    return `${slice.slice(0, slice.lastIndexOf(" ")).trim()}…`;
}

/** Paragraphs of a README that read as sentences: no headings, badges, tables, code or lists. */
function proseBlocks(markdown: string): string[] {
    const withoutCode = markdown
        .replace(/\r\n/g, "\n")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/~~~[\s\S]*?~~~/g, "");
    const blocks: string[] = [];
    for (const raw of withoutCode.split(/\n\s*\n/)) {
        const lines = raw.split("\n").filter((line) => line.trim());
        if (lines.length === 0) continue;
        if (BLOCK_SKIP.test(lines[0].trim())) continue;
        if (lines.every((line) => LIST_LINE.test(line))) continue;
        const text = plainText(raw);
        if (text.length < 40) continue;
        if (/^(table of contents|contents|license|installation|usage)\b/i.test(text)) continue;
        // A line of only links or badges.
        if (!/[a-z]{3,}\s+[a-z]{2,}/i.test(text)) continue;
        blocks.push(text);
    }
    return blocks;
}

/** The first meaningful paragraph of a repository README, as short plain text. "" when there is none. */
export function readmeToSummary(markdown: string, maxChars = 280): string {
    const [first] = proseBlocks(markdown.slice(0, 40_000));
    return first ? cut(first, maxChars) : "";
}

/** The first one or two paragraphs of a profile README, as short plain text. "" when there is none. */
export function profileReadmeToSummary(markdown: string, maxChars = 500): string {
    const blocks = proseBlocks(markdown.slice(0, 40_000)).slice(0, 2);
    return blocks.length ? cut(blocks.join(" "), maxChars) : "";
}

// -- dependency files --------------------------------------------------------

type ManifestKind = "npm" | "python" | "go" | "rust" | "maven" | "composer" | "ruby";

const NPM: Record<string, string> = {
    react: "React", "react-dom": "React", next: "Next.js", vue: "Vue", nuxt: "Nuxt", svelte: "Svelte", "@sveltejs/kit": "SvelteKit",
    "@angular/core": "Angular", solid: "Solid", "solid-js": "Solid", astro: "Astro", remix: "Remix", "@remix-run/react": "Remix",
    express: "Express", fastify: "Fastify", koa: "Koa", "@nestjs/core": "NestJS", hono: "Hono", trpc: "tRPC", "@trpc/server": "tRPC",
    typescript: "TypeScript", tailwindcss: "Tailwind CSS", "styled-components": "styled-components", "@emotion/react": "Emotion",
    prisma: "Prisma", "@prisma/client": "Prisma", mongoose: "MongoDB", mongodb: "MongoDB", pg: "PostgreSQL", mysql2: "MySQL",
    redis: "Redis", ioredis: "Redis", "drizzle-orm": "Drizzle", typeorm: "TypeORM", sequelize: "Sequelize", graphql: "GraphQL",
    "apollo-server": "GraphQL", "@apollo/client": "GraphQL", "socket.io": "Socket.IO", jest: "Jest", vitest: "Vitest",
    cypress: "Cypress", "@playwright/test": "Playwright", playwright: "Playwright", webpack: "Webpack", vite: "Vite", esbuild: "esbuild",
    electron: "Electron", "react-native": "React Native", expo: "Expo", three: "Three.js", d3: "D3", zustand: "Zustand",
    redux: "Redux", "@reduxjs/toolkit": "Redux", "@tanstack/react-query": "TanStack Query", firebase: "Firebase", "@supabase/supabase-js": "Supabase",
    stripe: "Stripe", "aws-sdk": "AWS", "@aws-sdk/client-s3": "AWS", docker: "Docker", zod: "Zod", storybook: "Storybook",
};

const PYTHON: Record<string, string> = {
    django: "Django", flask: "Flask", fastapi: "FastAPI", starlette: "Starlette", pydantic: "Pydantic", sqlalchemy: "SQLAlchemy",
    celery: "Celery", pandas: "pandas", numpy: "NumPy", scipy: "SciPy", scikit_learn: "scikit-learn", sklearn: "scikit-learn",
    tensorflow: "TensorFlow", torch: "PyTorch", pytorch: "PyTorch", transformers: "Hugging Face", keras: "Keras", opencv_python: "OpenCV",
    matplotlib: "Matplotlib", streamlit: "Streamlit", pytest: "pytest", requests: "Requests", aiohttp: "aiohttp", psycopg2: "PostgreSQL",
    asyncpg: "PostgreSQL", pymongo: "MongoDB", redis: "Redis", boto3: "AWS", langchain: "LangChain", openai: "OpenAI API", scrapy: "Scrapy",
    beautifulsoup4: "Beautiful Soup", selenium: "Selenium", airflow: "Airflow", apache_airflow: "Airflow", dbt_core: "dbt", ray: "Ray",
};

const GO: Array<[string, string]> = [
    ["gin-gonic/gin", "Gin"], ["labstack/echo", "Echo"], ["gofiber/fiber", "Fiber"], ["go-chi/chi", "chi"], ["gorilla/mux", "Gorilla Mux"],
    ["gorm.io/gorm", "GORM"], ["jackc/pgx", "PostgreSQL"], ["lib/pq", "PostgreSQL"], ["go-redis/redis", "Redis"], ["redis/go-redis", "Redis"],
    ["spf13/cobra", "Cobra"], ["grpc", "gRPC"], ["google.golang.org/protobuf", "Protocol Buffers"], ["kubernetes", "Kubernetes"],
    ["aws/aws-sdk-go", "AWS"], ["stretchr/testify", "testify"], ["segmentio/kafka-go", "Kafka"],
];

const RUST: Record<string, string> = {
    tokio: "Tokio", serde: "Serde", "actix-web": "Actix", axum: "Axum", rocket: "Rocket", warp: "Warp", diesel: "Diesel", sqlx: "SQLx",
    clap: "clap", wasm_bindgen: "WebAssembly", "wasm-bindgen": "WebAssembly", tauri: "Tauri", bevy: "Bevy", rayon: "Rayon", reqwest: "reqwest",
};

const MAVEN: Record<string, string> = {
    "spring-boot-starter": "Spring Boot", "spring-boot-starter-web": "Spring Boot", "spring-boot": "Spring Boot", "spring-core": "Spring",
    hibernate: "Hibernate", "hibernate-core": "Hibernate", junit: "JUnit", "junit-jupiter": "JUnit", mockito: "Mockito", lombok: "Lombok",
    kafka: "Kafka", "kafka-clients": "Kafka", jackson: "Jackson", "jackson-databind": "Jackson", mybatis: "MyBatis", quarkus: "Quarkus",
};

const COMPOSER: Record<string, string> = {
    "laravel/framework": "Laravel", "symfony/symfony": "Symfony", "symfony/framework-bundle": "Symfony", "phpunit/phpunit": "PHPUnit",
    "doctrine/orm": "Doctrine", "livewire/livewire": "Livewire", "inertiajs/inertia-laravel": "Inertia.js",
};

const RUBY: Record<string, string> = {
    rails: "Ruby on Rails", sinatra: "Sinatra", rspec: "RSpec", sidekiq: "Sidekiq", devise: "Devise", puma: "Puma", pg: "PostgreSQL", redis: "Redis",
};

function ordered(names: string[], lookup: (name: string) => string | undefined): string[] {
    const found: string[] = [];
    for (const name of names) {
        const tech = lookup(name);
        if (tech && !found.includes(tech)) found.push(tech);
    }
    return found;
}

function jsonKeys(text: string, fields: string[]): string[] {
    try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        return fields.flatMap((field) => {
            const value = parsed[field];
            return value && typeof value === "object" ? Object.keys(value as Record<string, unknown>) : [];
        });
    } catch {
        return [];
    }
}

function pythonNames(text: string): string[] {
    const names: string[] = [];
    for (const line of text.split("\n")) {
        const requirement = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*(?:[<>=!~;[]|$)/.exec(line);
        if (requirement && !line.trim().startsWith("#")) names.push(requirement[1]);
    }
    // pyproject: "fastapi>=0.1" inside a dependencies list, or keys of [tool.poetry.dependencies].
    for (const quoted of text.matchAll(/"([A-Za-z0-9][A-Za-z0-9._-]*)\s*(?:[<>=!~;[,]|")/g)) names.push(quoted[1]);
    const poetry = /\[tool\.poetry\.(?:dev-)?dependencies\]([\s\S]*?)(?:\n\[|$)/.exec(text);
    if (poetry) for (const key of poetry[1].matchAll(/^\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*=/gm)) names.push(key[1]);
    return names.map((name) => name.toLowerCase().replace(/[-.]/g, "_"));
}

/** Technologies a dependency file names, from a known list only, at most `limit`. */
export function stackFromManifest(kind: ManifestKind, text: string, limit = 8): string[] {
    const body = text.slice(0, 200_000);
    let found: string[] = [];
    switch (kind) {
        case "npm":
            found = ordered(jsonKeys(body, ["dependencies", "devDependencies", "peerDependencies"]), (name) => NPM[name.toLowerCase()]);
            break;
        case "python":
            found = ordered(pythonNames(body), (name) => PYTHON[name]);
            break;
        case "go": {
            const modules = [...body.matchAll(/^\s*(?:require\s+)?([\w.\-/]+\.[\w.\-/]+)\s+v[\w.\-+]+/gm)].map((match) => match[1]);
            found = ordered(modules, (module) => GO.find(([needle]) => module.includes(needle))?.[1]);
            break;
        }
        case "rust": {
            const section = /\[(?:dev-)?dependencies\]([\s\S]*?)(?:\n\[|$)/g;
            const names: string[] = [];
            for (const match of body.matchAll(section)) for (const key of match[1].matchAll(/^\s*([A-Za-z0-9_-]+)\s*=/gm)) names.push(key[1]);
            found = ordered(names, (name) => RUST[name]);
            break;
        }
        case "maven": {
            const ids = [...body.matchAll(/<artifactId>\s*([^<\s]+)\s*<\/artifactId>/g)].map((match) => match[1]);
            found = ordered(ids, (id) => MAVEN[id] ?? (id.startsWith("spring-boot-starter") ? "Spring Boot" : undefined));
            break;
        }
        case "composer":
            found = ordered(jsonKeys(body, ["require", "require-dev"]), (name) => COMPOSER[name.toLowerCase()]);
            break;
        case "ruby": {
            const gems = [...body.matchAll(/^\s*gem\s+['"]([\w-]+)['"]/gm)].map((match) => match[1]);
            found = ordered(gems, (name) => RUBY[name]);
            break;
        }
    }
    return found.slice(0, limit);
}

/** Which dependency files are worth asking for, from the repository's main language. */
export function manifestsFor(primaryLanguage: string): Array<{ file: string; kind: ManifestKind }> {
    switch (primaryLanguage) {
        case "JavaScript":
        case "TypeScript":
        case "Vue":
        case "Svelte":
        case "HTML":
        case "CSS":
            return [{ file: "package.json", kind: "npm" }];
        case "Python":
        case "Jupyter Notebook":
            return [{ file: "requirements.txt", kind: "python" }, { file: "pyproject.toml", kind: "python" }];
        case "Go":
            return [{ file: "go.mod", kind: "go" }];
        case "Rust":
            return [{ file: "Cargo.toml", kind: "rust" }];
        case "Java":
        case "Kotlin":
            return [{ file: "pom.xml", kind: "maven" }];
        case "PHP":
            return [{ file: "composer.json", kind: "composer" }];
        case "Ruby":
            return [{ file: "Gemfile", kind: "ruby" }];
        default:
            return [];
    }
}

/** Merged-pull-request search results grouped by the project they went to. */
export function groupContributions(
    items: Array<{ repository_url?: string; title?: string; html_url?: string }>,
    limit = 12,
): Array<{ repo: string; url: string; mergedPrs: number; titles: string[] }> {
    const byRepo = new Map<string, { repo: string; url: string; mergedPrs: number; titles: string[] }>();
    for (const item of items) {
        const match = /\/repos\/([^/]+\/[^/]+)$/.exec(item.repository_url ?? "");
        if (!match) continue;
        const repo = match[1];
        const key = repo.toLowerCase();
        const entry = byRepo.get(key) ?? { repo, url: `https://github.com/${repo}`, mergedPrs: 0, titles: [] };
        entry.mergedPrs += 1;
        const title = plainText(item.title ?? "").slice(0, 120);
        if (title && entry.titles.length < 3) entry.titles.push(title);
        byRepo.set(key, entry);
    }
    return [...byRepo.values()].sort((a, b) => b.mergedPrs - a.mergedPrs || a.repo.localeCompare(b.repo)).slice(0, limit);
}
