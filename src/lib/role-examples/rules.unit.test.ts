import { describe, expect, it } from "vitest";
import type { RoleExample, RoleExampleStatus, RoleExampleVersion } from "./registry";
import {
    entriesFor,
    exampleAlternates,
    findEntry,
    indexAlternates,
    indexGroups,
    indexLanguageLinks,
    indexLocales,
    languageLinks,
    publishedEntries,
    roleExamplePath,
} from "./rules";

function version(slug: string, status: RoleExampleStatus): RoleExampleVersion {
    return { slug, status, name: `Name ${slug}`, title: `Title ${slug}`, description: "d".repeat(130), date: "2026-11-02" };
}

function role(id: string, field: RoleExample["field"], versions: RoleExample["versions"]): RoleExample {
    return {
        id,
        field,
        template: "modern",
        relatedArticle: "cefr-language-levels",
        versions,
        loadContent: async () => ({ en: () => { throw new Error("unused"); } }),
        loadProse: async () => ({}),
    };
}

const nurse = role("nurse", "care", { en: version("nurse", "published"), de: version("pflegefachkraft", "published") });
const dev = role("dev", "tech", { en: version("dev", "published"), de: version("entwickler", "draft") });
const cook = role("cook", "hospitality", { de: version("koch", "draft") });
const roles = [dev, nurse, cook];

describe("paths", () => {
    it("keeps English unprefixed and prefixes German", () => {
        expect(roleExamplePath("en")).toBe("/cv-examples");
        expect(roleExamplePath("en", "nurse")).toBe("/cv-examples/nurse");
        expect(roleExamplePath("de", "pflegefachkraft")).toBe("/de/cv-examples/pflegefachkraft");
    });
});

describe("published and draft versions", () => {
    it("lists every version, and published ones separately", () => {
        expect(entriesFor(roles)).toHaveLength(5);
        expect(publishedEntries(roles).map((entry) => `${entry.role.id}/${entry.locale}`)).toEqual(["dev/en", "nurse/en", "nurse/de"]);
    });

    it("finds a version only in its own language", () => {
        expect(findEntry("de", "pflegefachkraft", roles)?.role.id).toBe("nurse");
        expect(findEntry("en", "pflegefachkraft", roles)).toBeUndefined();
        expect(findEntry("bs", "nurse", roles)).toBeUndefined();
    });

    it("still finds a draft, so it can be reached by URL", () => {
        expect(findEntry("de", "koch", roles)?.version.status).toBe("draft");
    });
});

describe("exampleAlternates", () => {
    it("lists published siblings with English as x-default", () => {
        expect(exampleAlternates(nurse)).toEqual({
            en: "/cv-examples/nurse",
            de: "/de/cv-examples/pflegefachkraft",
            "x-default": "/cv-examples/nurse",
        });
    });

    it("is empty while only one version is published", () => {
        expect(exampleAlternates(dev)).toEqual({});
        expect(exampleAlternates(cook)).toEqual({});
    });

    it("never names a draft", () => {
        expect(Object.values(exampleAlternates(dev)).join()).not.toContain("entwickler");
    });
});

describe("index", () => {
    it("has a language only when it has a published role", () => {
        expect(indexLocales(roles)).toEqual(["en", "de"]);
        expect(indexLocales([cook])).toEqual([]);
        expect(indexLocales([dev])).toEqual(["en"]);
    });

    it("groups published roles by field in a fixed order and drops empty groups", () => {
        expect(indexGroups("en", roles).map((group) => [group.field, group.entries.map((entry) => entry.role.id)])).toEqual([
            ["tech", ["dev"]],
            ["care", ["nurse"]],
        ]);
        expect(indexGroups("de", roles).map((group) => group.field)).toEqual(["care"]);
    });

    it("declares index alternates only when two languages have one", () => {
        expect(indexAlternates(roles)).toEqual({ en: "/cv-examples", de: "/de/cv-examples", "x-default": "/cv-examples" });
        expect(indexAlternates([dev])).toEqual({});
    });
});

describe("languageLinks", () => {
    it("points to the published sibling and falls back to an index or the page itself", () => {
        const links = languageLinks(findEntry("en", "nurse", roles)!, roles);
        expect(links.en).toBe("/cv-examples/nurse");
        expect(links.de).toBe("/de/cv-examples/pflegefachkraft");
        // bs, fr and es have no examples at all: the switcher stays on this page.
        expect(links.bs).toBe("/cv-examples/nurse");
    });

    it("sends a draft's switcher to published siblings only, else to the language index", () => {
        const links = languageLinks(findEntry("de", "entwickler", roles)!, roles);
        expect(links.en).toBe("/cv-examples/dev");
        expect(links.de).toBe("/de/cv-examples/entwickler");
    });

    it("falls back to the other language's index when the role has no published version there", () => {
        const links = languageLinks(findEntry("de", "koch", roles)!, roles);
        expect(links.en).toBe("/cv-examples");
    });
});

describe("indexLanguageLinks", () => {
    it("sends each language with an index to it, and every other language to the current index", () => {
        const links = indexLanguageLinks("en", roles);
        expect(links.en).toBe("/cv-examples");
        expect(links.de).toBe("/de/cv-examples");
        expect(links.fr).toBe("/cv-examples");
    });

    it("stays on the current index while no other language has one", () => {
        const links = indexLanguageLinks("en", [dev]);
        expect(links.de).toBe("/cv-examples");
        expect(links.en).toBe("/cv-examples");
    });
});
