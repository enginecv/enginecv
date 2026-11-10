import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CRAWL_DISALLOWED_PATHS, PUBLIC_ROUTES, SITE_URL } from "@/lib/site";
import { getEnabledTools } from "@/lib/tools/registry";
import robots from "./robots";
import sitemap from "./sitemap";

vi.mock("@/lib/blog", () => ({
    getAllBlogPostMeta: async () => [
        { slug: "how-to-write-a-resume-in-2026", article: "how-to-write-a-resume-in-2026", locale: "en", date: "2026-01-18", path: "/blog/how-to-write-a-resume-in-2026", draft: false },
        { slug: "cefr-language-levels-on-your-cv", article: "cefr", locale: "en", date: "2026-10-09", updated: "2026-10-12", path: "/blog/cefr-language-levels-on-your-cv", draft: false },
        { slug: "sprachniveau-im-lebenslauf-angeben", article: "cefr", locale: "de", date: "2026-10-09", path: "/de/blog/sprachniveau-im-lebenslauf-angeben", draft: false },
        { slug: "nivo-jezika-u-cv-u", article: "cefr", locale: "bs", date: "2026-10-09", path: "/bs/blog/nivo-jezika-u-cv-u", draft: true },
    ],
}));

vi.mock("@/lib/guides/guides", () => ({
    getPublishedGuideMeta: async () => [
        { slug: "work-experience-section", date: "2026-11-10", updated: "2026-11-12", path: "/guides/work-experience-section", draft: false },
    ],
}));

/** Static pages that are deliberately not in the sitemap, with the reason. */
const NOT_INDEXED: Record<string, string> = {
    "/dashboard": "app shell; content lives in the visitor's IndexedDB",
    "/your-data": "tool that reads the visitor's own browser storage; renders empty for crawlers, noindex",
    "/resume-summary-generator": "retired route that returns 404",
    "/impressum": "listed by the sitemap only once LEGAL_OPERATOR is filled in",
    "/guides": "listed by the sitemap once the first section guide is published",
};

function staticPageRoutes(dir = path.join(process.cwd(), "src", "app"), base = ""): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        if (entry.isFile() && entry.name === "page.tsx") return [base || "/"];
        // Dynamic segments are listed separately (blog posts) or never indexed.
        if (!entry.isDirectory() || entry.name.startsWith("[") || entry.name.startsWith("(")) return [];
        return staticPageRoutes(path.join(dir, entry.name), `${base}/${entry.name}`);
    });
}

describe("sitemap", () => {
    it("lists every public route and each blog post under the canonical origin", async () => {
        const urls = (await sitemap()).map((entry) => entry.url);

        expect(urls).toContain(SITE_URL);
        for (const route of PUBLIC_ROUTES.filter((r) => r !== "/")) {
            expect(urls).toContain(`${SITE_URL}${route}`);
        }
        expect(urls).toContain(`${SITE_URL}/blog/how-to-write-a-resume-in-2026`);
        expect(urls.every((url) => url.startsWith(SITE_URL))).toBe(true);
    });

    it("accounts for every static page: public or deliberately not indexed", () => {
        const known = new Set<string>([...PUBLIC_ROUTES, ...Object.keys(NOT_INDEXED)]);
        const unaccounted = staticPageRoutes().filter((route) => !known.has(route));

        expect(unaccounted).toEqual([]);
    });

    it("lists the guides hub and published guides with their updated date, on the canonical origin", async () => {
        const byUrl = new Map((await sitemap()).map((entry) => [entry.url, entry]));
        expect(byUrl.has(`${SITE_URL}/guides`)).toBe(true);
        expect(byUrl.get(`${SITE_URL}/guides/work-experience-section`)?.lastModified).toBe("2026-11-12");
        expect([...byUrl.keys()].some((url) => /\/(go|r)\//.test(url))).toBe(false);
    });

    it("lists the tools index and each enabled tool in English only", async () => {
        const urls = (await sitemap()).map((entry) => entry.url);
        const tools = urls.filter((url) => new URL(url).pathname.split("/").includes("tools"));
        expect(tools).toHaveLength(1 + getEnabledTools().length);
        expect(tools).toEqual(expect.arrayContaining([
            `${SITE_URL}/tools`,
            ...getEnabledTools().map(({ slug }) => `${SITE_URL}/tools/${slug}`),
        ]));
    });

    it("lists template gallery pages in English only, localized homepages still listed", async () => {
        const urls = (await sitemap()).map((url) => url.url);
        expect(urls.filter((url) => /\/(de|bs|fr|es)\/(cv-templates|tools|resources)/.test(url))).toEqual([]);
        expect(urls).toContain(`${SITE_URL}/cv-templates`);
        expect(urls).toContain(`${SITE_URL}/de`);
    });

    it("lists each published blog version with its language siblings, and no drafts", async () => {
        const entries = await sitemap();
        const byUrl = new Map(entries.map((entry) => [entry.url, entry]));

        expect(byUrl.has(`${SITE_URL}/bs/blog/nivo-jezika-u-cv-u`)).toBe(false);
        expect(byUrl.has(`${SITE_URL}/bs/blog`)).toBe(false);
        expect(byUrl.get(`${SITE_URL}/blog/how-to-write-a-resume-in-2026`)?.alternates).toBeUndefined();

        const siblings = {
            en: `${SITE_URL}/blog/cefr-language-levels-on-your-cv`,
            de: `${SITE_URL}/de/blog/sprachniveau-im-lebenslauf-angeben`,
            "x-default": `${SITE_URL}/blog/cefr-language-levels-on-your-cv`,
        };
        expect(byUrl.get(siblings.en)?.alternates?.languages).toEqual(siblings);
        expect(byUrl.get(siblings.de)?.alternates?.languages).toEqual(siblings);
        expect(byUrl.get(siblings.en)?.lastModified).toBe("2026-10-12");

        const indexes = { en: `${SITE_URL}/blog`, de: `${SITE_URL}/de/blog`, "x-default": `${SITE_URL}/blog` };
        expect(byUrl.get(indexes.en)?.alternates?.languages).toEqual(indexes);
        expect(byUrl.get(indexes.de)?.alternates?.languages).toEqual(indexes);
        expect(entries.filter((entry) => entry.url === indexes.en)).toHaveLength(1);
    });

    it("lists published role examples with their date, and no drafts", async () => {
        const entries = await sitemap();
        const byUrl = new Map(entries.map((entry) => [entry.url, entry]));

        for (const slug of ["nurse", "software-developer"]) {
            const entry = byUrl.get(`${SITE_URL}/cv-examples/${slug}`);
            expect(entry?.lastModified).toBe("2026-11-02");
            // Their German siblings are drafts, so a lone page declares no alternates.
            expect(entry?.alternates).toBeUndefined();
        }
        // Only English has published examples, so only its index is listed, without alternates.
        expect(byUrl.get(`${SITE_URL}/cv-examples`)?.alternates).toBeUndefined();
        expect(byUrl.has(`${SITE_URL}/de/cv-examples`)).toBe(false);
        for (const draft of ["/de/cv-examples/pflegefachkraft", "/de/cv-examples/softwareentwickler"]) {
            expect(byUrl.has(`${SITE_URL}${draft}`)).toBe(false);
        }
    });

    it("lists a role's published versions as each other's alternates", async () => {
        vi.resetModules();
        vi.doMock("@/lib/role-examples/registry", async (importOriginal) => {
            const actual = await importOriginal<typeof import("@/lib/role-examples/registry")>();
            return {
                ...actual,
                ROLE_EXAMPLES: actual.ROLE_EXAMPLES.map((role) => role.id === "nurse"
                    ? { ...role, versions: { ...role.versions, de: { ...role.versions.de!, status: "published" as const } } }
                    : role),
            };
        });
        const { default: freshSitemap } = await import("./sitemap");
        const byUrl = new Map((await freshSitemap()).map((entry) => [entry.url, entry]));
        vi.doUnmock("@/lib/role-examples/registry");

        const siblings = {
            en: `${SITE_URL}/cv-examples/nurse`,
            de: `${SITE_URL}/de/cv-examples/pflegefachkraft`,
            "x-default": `${SITE_URL}/cv-examples/nurse`,
        };
        expect(byUrl.get(siblings.en)?.alternates?.languages).toEqual(siblings);
        expect(byUrl.get(siblings.de)?.alternates?.languages).toEqual(siblings);
        const indexes = { en: `${SITE_URL}/cv-examples`, de: `${SITE_URL}/de/cv-examples`, "x-default": `${SITE_URL}/cv-examples` };
        expect(byUrl.get(indexes.en)?.alternates?.languages).toEqual(indexes);
        expect(byUrl.get(indexes.de)?.alternates?.languages).toEqual(indexes);
        // The other role is unaffected.
        expect(byUrl.has(`${SITE_URL}/de/cv-examples/softwareentwickler`)).toBe(false);
    });

    it("lists only final canonical URLs: About present, no redirect routes, no draft locales", async () => {
        const urls = (await sitemap()).map((entry) => entry.url);

        expect(urls).toContain(`${SITE_URL}/about`);
        expect(urls.every((url) => url.startsWith(`${SITE_URL}/`) || url === SITE_URL)).toBe(true);
        expect(urls.some((url) => /^https:\/\/enginecv\.app\/(go|r)(\/|$)/.test(url))).toBe(false);
        expect(urls.some((url) => /^https?:\/\/(www\.|http)/.test(url.replace("https://enginecv.app", "")))).toBe(false);
        expect(urls.filter((url) => url.includes("/bs/blog/nivo-jezika") || url.includes("/de/cv-examples"))).toEqual([]);
    });

    it("never lists a path robots.txt disallows", async () => {
        const paths = (await sitemap()).map((entry) => new URL(entry.url).pathname);

        for (const disallowed of CRAWL_DISALLOWED_PATHS) {
            expect(paths.some((p) => p.startsWith(disallowed))).toBe(false);
        }
    });
});

describe("robots", () => {
    it("points crawlers at the sitemap and keeps them out of app routes", () => {
        const result = robots();
        const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;

        expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
        expect(rules.disallow).toEqual(expect.arrayContaining(["/editor/", "/api/"]));
        // Query variants that burn crawl budget, but never the bare dashboard
        // route, which must stay readable so its noindex tag is seen.
        expect(rules.disallow).toEqual(expect.arrayContaining(["/dashboard?", "/*?_rsc="]));
        expect(rules.disallow).not.toContain("/dashboard");
    });
});
