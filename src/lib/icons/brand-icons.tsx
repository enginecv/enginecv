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
    siZsh, siHashicorp, siJinja, siOpenjdk, siTailscale, siWebgpu, siWgpu,
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

// A single-path glyph from a source with its own viewBox (Devicon uses 128x128).
function makePathIcon(name: string, path: string, viewBox: string): IconComponent {
    const Glyph = ({ className, style }: { className?: string; style?: CSSProperties }) => (
        <svg role="img" viewBox={viewBox} className={className} style={style} fill="currentColor" aria-hidden="true">
            <path d={path} />
        </svg>
    );
    Glyph.displayName = `Brand(${name})`;
    return Glyph;
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
    java: siOpenjdk,
    jinja: siJinja,
    hashicorp: siHashicorp,
    tailscale: siTailscale,
    webgpu: siWebgpu,
    wgpu: siWgpu,
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
    // Not in simple-icons: NetworkX is the Devicon (MIT) glyph; the rest are text
    // tokens, not official logos.
    networkx: { title: "NetworkX", Comp: makePathIcon("networkx", "M112.709.008a13.345 13.345 0 0 0-9.396 3.433c-4.613 4.16-5.611 10.839-2.715 15.94l-7.776 7.002a32.376 32.376 0 0 0-18.312-6.574 32.996 32.996 0 0 0-12.766 2.033C45.761 27.748 36.87 44.689 41.047 60.588l-9.69 3.584c-2.254-3.508-6.105-5.663-10.254-5.83a13.196 13.196 0 0 0-3.302.34l-1.979-5.58c3.314-2.07 4.918-6.184 3.586-9.944l.002-.002c-1.151-3.246-4.174-5.293-7.463-5.437a8.554 8.554 0 0 0-3.318.515c-4.386 1.604-6.742 6.412-5.207 10.743 1.33 3.753 5.161 5.898 9.013 5.359l1.965 5.543c-5.7 2.998-8.565 9.74-6.373 15.855 2.39 6.664 9.893 10.022 16.641 7.528 5.843-2.16 9.321-8.016 8.6-13.873l9.66-3.569c6.355 13.711 21.803 20.877 36.687 17.283l3.998 11.155a18.588 18.588 0 0 0-8.922 10.601L69.414 104a8.206 8.206 0 0 0-6.896-7.797c-4.576-.747-8.992 2.32-9.864 6.861-.871 4.54 2.185 8.885 6.762 9.631 3.973.649 7.82-1.578 9.336-5.15l5.166.842c-.304 2.62-.05 5.331.892 7.96 3.334 9.304 13.808 13.984 23.231 10.503 9.421-3.481 14.453-13.842 11.117-23.147a17.286 17.286 0 0 0-5.021-7.295l10.59-18.412-.05-.027c3.783.788 7.795-1.098 9.536-4.725 2.034-4.158.212-9.228-4.002-11.078h-.004a8.405 8.405 0 0 0-3.25-.732h-.002c-2.648-.059-5.227 1.14-6.924 3.244l-6.678-3.207c2.243-6.597 2.403-13.899-.097-20.875A30.885 30.885 0 0 0 96.95 30.14l7.393-6.659c4.856 3.372 11.67 3.015 16.299-1.162 5.34-4.816 5.85-13.017 1.056-18.226-2.398-2.605-5.661-3.972-8.99-4.086zm-.135 3.455c2.442.08 4.823 1.086 6.569 2.982 3.49 3.793 3.156 9.705-.827 13.297-3.981 3.593-10.012 3.37-13.504-.422-3.49-3.793-3.158-9.705.827-13.299a9.861 9.861 0 0 1 6.935-2.556v-.002zm-.183 2.926c-.853-.033-1.73.1-2.586.416-3.428 1.266-5.232 5.008-4.033 8.357 1.2 3.35 4.952 5.039 8.38 3.772v-.002c3.427-1.267 5.233-5.007 4.032-8.354-.901-2.513-3.237-4.092-5.793-4.19zM74.26 26.553c10.023.362 19.098 6.525 22.612 16.332 4.687 13.076-2.338 27.727-15.857 32.722v.002h-.002c-13.522 4.995-28.092-1.607-32.778-14.681-4.685-13.075 2.34-27.726 15.86-32.723a26.522 26.522 0 0 1 10.166-1.652zm-1.66 6.506a19.329 19.329 0 0 0-6.506 1.207c-9.84 3.636-15.023 14.377-11.576 23.992 3.445 9.615 14.217 14.461 24.054 10.826 9.841-3.634 15.024-14.378 11.578-23.992-2.69-7.512-9.853-12.113-17.55-12.033zm-60.743 6.9c2.415.093 4.59 1.584 5.428 3.947l-.002.002c1.118 3.152-.583 6.676-3.853 7.871-3.272 1.198-6.768-.402-7.885-3.554-1.118-3.153.585-6.677 3.857-7.873h.002a6.4 6.4 0 0 1 2.453-.393zm9.12 21.836c3.723.131 7.08 2.42 8.384 6.057 1.739 4.849-.864 10.29-5.898 12.15-5.034 1.86-10.428-.59-12.166-5.44-1.74-4.849.865-10.29 5.898-12.15a9.886 9.886 0 0 1 3.782-.617zm95.92 1.89h.001a6.18 6.18 0 0 1 2.393.538l.008.002c3.054 1.335 4.38 4.991 2.89 8.03l-.003.01c-1.487 3.1-5.214 4.481-8.307 3.098l-.008-.004c-3.054-1.335-4.38-4.993-2.89-8.033l.003-.008c1.116-2.325 3.49-3.682 5.912-3.633zM20.743 64.73a6.693 6.693 0 0 0-2.586.416c-3.429 1.267-5.233 5.009-4.033 8.357 1.2 3.35 4.952 5.038 8.379 3.771 3.429-1.267 5.23-5.008 4.031-8.357-.9-2.511-3.234-4.09-5.79-4.187zm81.193.287 6.446 2.88c-.83 3.22.386 6.663 3.035 8.624l-10.252 17.822a18.214 18.214 0 0 0-8.102-2.28 18.42 18.42 0 0 0-1.955.116L86.894 80.42a33.295 33.295 0 0 0 15.043-15.404zm-9.05 31.869c5.197.183 9.89 3.375 11.709 8.453 2.427 6.77-1.206 14.37-8.235 16.967-7.03 2.597-14.562-.824-16.988-7.594-2.428-6.772 1.206-14.37 8.236-16.965a13.797 13.797 0 0 1 5.278-.861zM60.898 98.35c.414-.016.834.007 1.256.076h.002c3.378.553 5.55 3.646 4.908 6.984-.642 3.341-3.907 5.615-7.287 5.063-3.381-.552-5.552-3.646-4.91-6.985.562-2.923 3.133-5.026 6.031-5.138zm31.653 2.77a9.22 9.22 0 0 0-3.553.571c-4.71 1.74-7.191 6.882-5.543 11.483 1.65 4.603 6.806 6.923 11.514 5.183h.002c4.71-1.74 7.19-6.883 5.54-11.484-1.237-3.452-4.447-5.62-7.96-5.754z", "0 0 128 128"), hex: "#2C7FB8" },
    mpi: { title: "MPI", Comp: makeTokenIcon("MPI"), hex: "#4A6FA5" },
    valkey: { title: "Valkey", Comp: makeTokenIcon("VK"), hex: "#6983FF" },
    neoforge: { title: "NeoForge", Comp: makeTokenIcon("NF"), hex: "#D7771B" },
    fabricmc: { title: "Fabric", Comp: makeTokenIcon("FAB"), hex: "#8C7B58" },
    minecraftforge: { title: "Minecraft Forge", Comp: makeTokenIcon("MCF"), hex: "#1F3A5F" },
    simpy: { title: "SimPy", Comp: makeTokenIcon("SIM"), hex: "#3776AB" },
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
    openjdk: "java",
    jdk: "java",
    jvm: "java",
    html: "html5",
    scss: "sass",
    dockerfile: "docker",
    dockercompose: "docker",
    hcl: "hashicorp",
    hashicorpconfiglanguage: "hashicorp",
    jinja2: "jinja",
    openmpi: "mpi",
    mpich: "mpi",
    messagepassinginterface: "mpi",
    redisfork: "valkey",
    wgpurs: "wgpu",
    fabricmod: "fabricmc",
    fabricloader: "fabricmc",
    forge: "minecraftforge",
    forgemodloader: "minecraftforge",
    networkxlibrary: "networkx",
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
