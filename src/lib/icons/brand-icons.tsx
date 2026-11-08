import type { CSSProperties, ComponentType } from "react";
import {
    siAnaconda, siAndroid, siAngular, siAnsible, siApache, siApacheairflow, siApachecassandra,
    siApacheflink, siApachegroovy, siApachehadoop, siApachekafka, siApachemaven, siApachespark,
    siApollographql, siApple, siArchlinux, siAstro, siBabel, siBitbucket, siBlender, siBootstrap,
    siBun, siC, siChai, siChocolatey, siCircleci, siClojure, siCloudflare, siCmake, siConfluence,
    siConsul, siCouchbase, siCplusplus, siCss, siCypress, siDart, siDatabricks, siDatadog,
    siDebian, siDeno, siDigitalocean, siDjango, siDocker, siDotnet, siDrizzle, siElectron, siElasticsearch,
    siElixir, siElm, siEsbuild, siEslint, siExpo, siExpress, siFastapi, siFigma, siFirebase,
    siFishshell, siFlask, siFlutter, siFsharp, siGit, siGithub, siGithubactions, siGitlab, siGnu, siGnubash,
    siGnuemacs, siGo, siGodotengine, siGooglecloud, siGradle, siGrafana, siGraphql, siHaskell,
    siHelm, siHomebrew, siHtml5, siHuggingface, siInfluxdb, siInsomnia, siIntellijidea,
    siJavascript, siJenkins, siJest, siJira, siJquery, siJson, siJulia, siJunit5, siJupyter,
    siKeras, siKotlin, siKubernetes, siLangchain, siLaravel, siLatex, siLess, siLinear, siLinux,
    siLlvm, siLooker, siLua, siMake, siMariadb, siMarkdown, siMlflow, siMocha, siMongodb,
    siMysql, siNeo4j, siNeovim, siNestjs, siNetlify, siNewrelic, siNextdotjs, siNginx,
    siNodedotjs, siNotion, siNpm, siNumpy, siNushell, siNuxt, siObsidian, siOpencv,
    siOpenapiinitiative, siPandas, siPerl, siPhp, siPnpm, siPoetry, siPostgresql, siPostman,
    siPrettier, siPrisma, siPrometheus, siPytest, siPython, siPytorch, siQt, siQwik, siR,
    siRabbitmq, siReact, siReactquery, siReactrouter, siRedis, siRedux, siRemix, siRollupdotjs,
    siRuby, siRubyonrails, siRuff, siRust, siSass, siScala, siScikitlearn, siSelenium,
    siSentry, siShopify, siSnowflake, siSolid, siSpring, siSpringboot, siSqlite, siStorybook,
    siStripe, siSublimetext, siSupabase, siSvelte, siSwift, siSwc, siSwagger, siTailwindcss,
    siTauri, siTensorflow, siTerraform, siThreedotjs, siTraefikproxy, siTrello, siTrpc,
    siTypescript, siUbuntu, siUnity, siUnrealengine, siUv, siVault, siVercel, siVim, siVite,
    siVitest, siVuedotjs, siWebassembly, siWebpack, siWordpress, siYaml, siYarn, siZig, siZod,
    siZsh,
} from "simple-icons";
import type { SimpleIcon } from "simple-icons";

/**
 * Minimal icon surface used across the app: any component that accepts a
 * className + inline style. Both lucide icons and our brand SVG wrappers
 * satisfy it, so a resolver can return either interchangeably.
 */
export type IconComponent = ComponentType<{ className?: string; style?: CSSProperties }>;

export type BrandIcon = {
    /** Human label, e.g. "Node.js" (taken from simple-icons). */
    title: string;
    /** Renderable component, tinted via `currentColor` / `color`. */
    Comp: IconComponent;
    /** Brand/preferred colour as `#rrggbb`, or null when no useful colour exists. */
    hex: string | null;
};

// Wrap a simple-icons single-path glyph in a currentColor SVG so it tints the
// same way lucide icons do (via the `color` style property).
function makeBrandIcon(icon: SimpleIcon): IconComponent {
    const Brand = ({ className, style }: { className?: string; style?: CSSProperties }) => (
        <svg
            role="img"
            viewBox="0 0 24 24"
            className={className}
            style={style}
            fill="currentColor"
            aria-hidden="true"
        >
            <path d={icon.path} />
        </svg>
    );
    Brand.displayName = `Brand(${icon.slug})`;
    return Brand;
}

function makeTokenIcon(label: string): IconComponent {
    const Token = ({ className, style }: { className?: string; style?: CSSProperties }) => (
        <svg
            role="img"
            viewBox="0 0 24 24"
            className={className}
            style={style}
            fill="none"
            aria-hidden="true"
        >
            <rect x="2.75" y="3.75" width="18.5" height="16.5" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
            <text
                x="12"
                y="14.75"
                textAnchor="middle"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize={label.length > 3 ? "5.5" : "7"}
                fontWeight="700"
                fill="currentColor"
            >
                {label}
            </text>
        </svg>
    );
    Token.displayName = `TokenIcon(${label})`;
    return Token;
}

// key -> simple-icons glyph. Keys are the stable slugs stored in `skill.icon`
// as `brand:<key>` and referenced by the auto-match index below.
const BRAND_SOURCE: Record<string, SimpleIcon> = {
    javascript: siJavascript,
    typescript: siTypescript,
    python: siPython,
    rust: siRust,
    go: siGo,
    cplusplus: siCplusplus,
    c: siC,
    php: siPhp,
    ruby: siRuby,
    swift: siSwift,
    kotlin: siKotlin,
    scala: siScala,
    dart: siDart,
    elixir: siElixir,
    haskell: siHaskell,
    lua: siLua,
    perl: siPerl,
    r: siR,
    julia: siJulia,
    fsharp: siFsharp,
    zig: siZig,
    elm: siElm,
    clojure: siClojure,
    groovy: siApachegroovy,
    latex: siLatex,
    react: siReact,
    vue: siVuedotjs,
    angular: siAngular,
    svelte: siSvelte,
    nextjs: siNextdotjs,
    nuxt: siNuxt,
    astro: siAstro,
    solid: siSolid,
    qwik: siQwik,
    remix: siRemix,
    nodejs: siNodedotjs,
    express: siExpress,
    nestjs: siNestjs,
    reactrouter: siReactrouter,
    trpc: siTrpc,
    deno: siDeno,
    bun: siBun,
    django: siDjango,
    flask: siFlask,
    fastapi: siFastapi,
    spring: siSpring,
    springboot: siSpringboot,
    laravel: siLaravel,
    rails: siRubyonrails,
    dotnet: siDotnet,
    tailwindcss: siTailwindcss,
    bootstrap: siBootstrap,
    redux: siRedux,
    jquery: siJquery,
    threejs: siThreedotjs,
    webpack: siWebpack,
    rollup: siRollupdotjs,
    esbuild: siEsbuild,
    swc: siSwc,
    vite: siVite,
    babel: siBabel,
    eslint: siEslint,
    prettier: siPrettier,
    jest: siJest,
    vitest: siVitest,
    pytest: siPytest,
    junit5: siJunit5,
    mocha: siMocha,
    chai: siChai,
    selenium: siSelenium,
    cypress: siCypress,
    storybook: siStorybook,
    postgresql: siPostgresql,
    mysql: siMysql,
    mariadb: siMariadb,
    sqlite: siSqlite,
    mongodb: siMongodb,
    drizzle: siDrizzle,
    couchbase: siCouchbase,
    cassandra: siApachecassandra,
    neo4j: siNeo4j,
    influxdb: siInfluxdb,
    snowflake: siSnowflake,
    redis: siRedis,
    elasticsearch: siElasticsearch,
    firebase: siFirebase,
    supabase: siSupabase,
    graphql: siGraphql,
    apollo: siApollographql,
    openapi: siOpenapiinitiative,
    swagger: siSwagger,
    prisma: siPrisma,
    zod: siZod,
    docker: siDocker,
    kubernetes: siKubernetes,
    helm: siHelm,
    terraform: siTerraform,
    ansible: siAnsible,
    consul: siConsul,
    vault: siVault,
    googlecloud: siGooglecloud,
    vercel: siVercel,
    netlify: siNetlify,
    cloudflare: siCloudflare,
    digitalocean: siDigitalocean,
    nginx: siNginx,
    traefik: siTraefikproxy,
    apache: siApache,
    git: siGit,
    github: siGithub,
    gitlab: siGitlab,
    bitbucket: siBitbucket,
    linux: siLinux,
    ubuntu: siUbuntu,
    debian: siDebian,
    archlinux: siArchlinux,
    apple: siApple,
    bash: siGnubash,
    nushell: siNushell,
    fishshell: siFishshell,
    zsh: siZsh,
    cmake: siCmake,
    make: siMake,
    gradle: siGradle,
    maven: siApachemaven,
    npm: siNpm,
    pnpm: siPnpm,
    yarn: siYarn,
    poetry: siPoetry,
    uv: siUv,
    ruff: siRuff,
    gnu: siGnu,
    llvm: siLlvm,
    homebrew: siHomebrew,
    chocolatey: siChocolatey,
    vim: siVim,
    neovim: siNeovim,
    emacs: siGnuemacs,
    intellij: siIntellijidea,
    sublime: siSublimetext,
    figma: siFigma,
    blender: siBlender,
    notion: siNotion,
    obsidian: siObsidian,
    jira: siJira,
    linear: siLinear,
    trello: siTrello,
    confluence: siConfluence,
    postman: siPostman,
    insomnia: siInsomnia,
    numpy: siNumpy,
    pandas: siPandas,
    scikitlearn: siScikitlearn,
    tensorflow: siTensorflow,
    mlflow: siMlflow,
    huggingface: siHuggingface,
    langchain: siLangchain,
    pytorch: siPytorch,
    keras: siKeras,
    jupyter: siJupyter,
    anaconda: siAnaconda,
    opencv: siOpencv,
    spark: siApachespark,
    hadoop: siApachehadoop,
    flink: siApacheflink,
    airflow: siApacheairflow,
    databricks: siDatabricks,
    looker: siLooker,
    flutter: siFlutter,
    reactquery: siReactquery,
    expo: siExpo,
    electron: siElectron,
    tauri: siTauri,
    qt: siQt,
    android: siAndroid,
    unity: siUnity,
    unrealengine: siUnrealengine,
    godot: siGodotengine,
    wordpress: siWordpress,
    shopify: siShopify,
    stripe: siStripe,
    html5: siHtml5,
    css: siCss,
    sass: siSass,
    less: siLess,
    markdown: siMarkdown,
    json: siJson,
    yaml: siYaml,
    webassembly: siWebassembly,
    rabbitmq: siRabbitmq,
    kafka: siApachekafka,
    grafana: siGrafana,
    prometheus: siPrometheus,
    sentry: siSentry,
    datadog: siDatadog,
    newrelic: siNewrelic,
    jenkins: siJenkins,
    githubactions: siGithubactions,
    circleci: siCircleci,
};

const SIMPLE_BRAND_ICONS: Record<string, BrandIcon> = Object.fromEntries(
    Object.entries(BRAND_SOURCE).map(([key, icon]) => [
        key,
        { title: icon.title, Comp: makeBrandIcon(icon), hex: `#${icon.hex}` },
    ])
);

// Some useful developer marks are not available from simple-icons. These are
// intentionally compact text tokens, not official logos, but they work in auto
// matching, manual picker search, accent colour, brand-ish colour, and export.
const FALLBACK_BRANDS: Record<string, BrandIcon> = {
    csharp: { title: "C#", Comp: makeTokenIcon("C#"), hex: "#512BD4" },
    tex: { title: "TeX", Comp: makeTokenIcon("TeX"), hex: "#008080" },
    aws: { title: "AWS", Comp: makeTokenIcon("AWS"), hex: "#FF9900" },
    azure: { title: "Azure", Comp: makeTokenIcon("AZ"), hex: "#0078D4" },
    vscode: { title: "VS Code", Comp: makeTokenIcon("VS"), hex: "#007ACC" },
    powershell: { title: "PowerShell", Comp: makeTokenIcon("PS"), hex: "#5391FE" },
    batchfile: { title: "Batchfile", Comp: makeTokenIcon("BAT"), hex: "#4D4D4D" },
    rxjs: { title: "RxJS", Comp: makeTokenIcon("Rx"), hex: "#B7178C" },
    slack: { title: "Slack", Comp: makeTokenIcon("SLK"), hex: "#4A154B" },
    openai: { title: "OpenAI", Comp: makeTokenIcon("AI"), hex: "#111111" },
    playwright: { title: "Playwright", Comp: makeTokenIcon("PW"), hex: "#2EAD33" },
    photoshop: { title: "Photoshop", Comp: makeTokenIcon("Ps"), hex: "#31A8FF" },
    heroku: { title: "Heroku", Comp: makeTokenIcon("H"), hex: "#430098" },
    grpc: { title: "gRPC", Comp: makeTokenIcon("gRPC"), hex: "#244C5A" },
    protobuf: { title: "Protocol Buffers", Comp: makeTokenIcon("PB"), hex: "#4285F4" },
    sql: { title: "SQL", Comp: makeTokenIcon("SQL"), hex: "#336791" },
    ninja: { title: "Ninja", Comp: makeTokenIcon("NIN"), hex: "#222222" },
    meson: { title: "Meson", Comp: makeTokenIcon("MES"), hex: "#007ACC" },
    scons: { title: "SCons", Comp: makeTokenIcon("SC"), hex: "#4B8BBE" },
};

/** Fully-built registry: key -> { title, Comp, hex }. */
export const BRAND_ICONS: Record<string, BrandIcon> = {
    ...SIMPLE_BRAND_ICONS,
    ...FALLBACK_BRANDS,
};

// Normalise a user-typed name to an index key: lowercase, strip spaces/dots/
// dashes/underscores/slashes, but KEEP `+` and `#` so "C++"/"C#"/"F#" stay
// distinct from "C". e.g. "Node.js" -> "nodejs", "C++" -> "c++".
function normKey(value: string): string {
    return value.toLowerCase().replace(/[\s._\-/]+/g, "");
}

// normalised name -> BrandIcon. Built from each brand's key + its title, plus
// hand-added aliases for common spellings. First writer wins so canonical keys
// take precedence over title collisions.
const AUTO_INDEX: Record<string, BrandIcon> = {};
const MATCH_TERMS: { term: string; entry: BrandIcon }[] = [];
function indexBrand(name: string, entry: BrandIcon) {
    const k = normKey(name);
    if (!k) return;
    if (!(k in AUTO_INDEX)) AUTO_INDEX[k] = entry;
    MATCH_TERMS.push({ term: k, entry });
}
for (const [key, entry] of Object.entries(BRAND_ICONS)) {
    indexBrand(key, entry);
    indexBrand(entry.title, entry);
}

// Common spellings that don't fall out of key/title normalisation.
const EXTRA_ALIASES: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    golang: "go",
    cpp: "cplusplus",
    "c++": "cplusplus",
    "c#": "csharp",
    "f#": "fsharp",
    "net": "dotnet",
    aspnet: "dotnet",
    dotnetcore: "dotnet",
    node: "nodejs",
    "next.js": "nextjs",
    nuxtjs: "nuxt",
    vuejs: "vue",
    reactnative: "react",
    tailwind: "tailwindcss",
    postgres: "postgresql",
    postgre: "postgresql",
    mongo: "mongodb",
    k8s: "kubernetes",
    gcp: "googlecloud",
    "amazonwebservices": "aws",
    "visualstudiocode": "vscode",
    sklearn: "scikitlearn",
    tf: "tensorflow",
    gha: "githubactions",
    githubworkflow: "githubactions",
    githubworkflows: "githubactions",
    githubci: "githubactions",
    rubyonrails: "rails",
    "three.js": "threejs",
    tex: "tex",
    plaintex: "tex",
    "latex": "latex",
    ps1: "powershell",
    pwsh: "powershell",
    shellscript: "bash",
    shellscripting: "bash",
    shell: "bash",
    fish: "fishshell",
    zshell: "zsh",
    bat: "batchfile",
    cmd: "batchfile",
    batch: "batchfile",
    batchfile: "batchfile",
    makefile: "make",
    gmake: "make",
    ninja: "ninja",
    ninjabuild: "ninja",
    mesonbuild: "meson",
    scons: "scons",
    apachemaven: "maven",
    maven: "maven",
    apachegroovy: "groovy",
    gradlebuildtool: "gradle",
    cmakelists: "cmake",
    nu: "nushell",
    "nu-shell": "nushell",
    objectivec: "c",
    objc: "c",
    "objective-c": "c",
    googlecloudplatform: "googlecloud",
    azure: "azure",
    dynamodb: "aws",
    awslambda: "aws",
    lambdafunctions: "aws",
    s3: "aws",
    ec2: "aws",
    cloudformation: "aws",
    cloudfront: "aws",
    protocolbuffers: "protobuf",
    proto: "protobuf",
    restapi: "openapi",
    restapis: "openapi",
    swaggerui: "swagger",
    rxjs: "rxjs",
    tanstackquery: "reactquery",
    reactquery: "reactquery",
    zod: "zod",
    drizzle: "postgresql",
    sqlalchemy: "python",
    prismaorm: "prisma",
    psql: "postgresql",
    nosql: "mongodb",
    cicd: "githubactions",
    ci: "githubactions",
    devops: "docker",
    llm: "openai",
    genai: "openai",
    ai: "openai",
    machinelearning: "tensorflow",
    deeplearning: "pytorch",
    computervision: "opencv",
    dataengineering: "airflow",
    datascience: "python",
};
for (const [alias, target] of Object.entries(EXTRA_ALIASES)) {
    const entry = AUTO_INDEX[normKey(target)];
    if (entry) {
        indexBrand(alias, entry);
    }
}

const UNIQUE_MATCH_TERMS = Array.from(
    new Map(MATCH_TERMS.map((item) => [item.term, item])).values()
).sort((a, b) => b.term.length - a.term.length);

function tokenKeys(value: string): string[] {
    return (value.toLowerCase().match(/[a-z0-9+#]+/g) ?? []).map(normKey).filter(Boolean);
}

function contiguousTokenJoins(tokens: string[]): Set<string> {
    const joins = new Set<string>();
    for (let start = 0; start < tokens.length; start++) {
        let joined = "";
        for (let end = start; end < tokens.length; end++) {
            joined += tokens[end];
            joins.add(joined);
        }
    }
    return joins;
}

/** Resolve an explicit `brand:<key>` value to its icon, else null. */
export function resolveBrandValue(value: string): BrandIcon | null {
    if (!value.startsWith("brand:")) return null;
    return BRAND_ICONS[value.slice("brand:".length)] ?? null;
}

/** Best-effort match of a free-text skill/link name to a brand icon. */
export function autoMatchBrand(name: string): BrandIcon | null {
    if (!name) return null;
    const compact = normKey(name);
    const exact = AUTO_INDEX[compact];
    if (exact) return exact;

    for (const token of tokenKeys(name)) {
        const tokenMatch = AUTO_INDEX[token];
        if (tokenMatch) return tokenMatch;
    }

    // Multi-word terms must line up with whole words: "Prototyping" must not
    // match "proto" (Protocol Buffers), but "CI/CD pipelines" still matches "cicd".
    const phrases = contiguousTokenJoins(tokenKeys(name));
    for (const { term, entry } of UNIQUE_MATCH_TERMS) {
        if (term.length >= 4 && phrases.has(term)) return entry;
    }

    return null;
}

/** Picker choices for the "Tech & Brands" category, sorted by label. */
export const BRAND_ICON_CHOICES: { value: string; label: string }[] = Object.entries(BRAND_ICONS)
    .map(([key, entry]) => ({ value: `brand:${key}`, label: entry.title }))
    .sort((a, b) => a.label.localeCompare(b.label));
