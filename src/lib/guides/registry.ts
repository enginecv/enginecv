/**
 * Section guides registry (feature 079). The single list of guides: the editor's
 * Get Tips link, the hub, the sitemap and the tests all read it.
 *
 * Kept free of collection and fs imports so client code (the editor) can use it
 * without bundling any guide text.
 *
 * Add a guide: add an entry here with `published: false`, create
 * `content/guides/<slug>.mdx` with `draft: true`, write it, run
 * `npx vitest run src/lib/content-depth src/lib/guides`.
 * Release a batch (3-4 per week): per guide set `draft: false` and `updated` in the
 * MDX, and `published: true` here. A test fails if the two disagree.
 */

export interface GuideRegistryEntry {
    slug: string;
    /** The editor section this guide covers, or null when no editor section has a Get Tips control for it. */
    sectionId: string | null;
    /** Must equal `!draft` in the guide's front matter. */
    published: boolean;
    /** Position in the hub. */
    order: number;
}

export const GUIDE_REGISTRY: readonly GuideRegistryEntry[] = [
    { slug: "work-experience-section", sectionId: "experience", published: true, order: 1 },
    { slug: "education-section", sectionId: "education", published: true, order: 2 },
    { slug: "skills-section", sectionId: "skills", published: true, order: 3 },
    { slug: "professional-summary-section", sectionId: null, published: false, order: 4 },
    { slug: "projects-section", sectionId: "projects", published: false, order: 5 },
    { slug: "certifications-section", sectionId: "certificates", published: false, order: 6 },
    { slug: "languages-section", sectionId: "languages", published: false, order: 7 },
    { slug: "awards-section", sectionId: "awards", published: false, order: 8 },
    { slug: "publications-section", sectionId: "publications", published: false, order: 9 },
    { slug: "courses-section", sectionId: "courses", published: false, order: 10 },
    { slug: "references-section", sectionId: "references", published: false, order: 11 },
    { slug: "volunteering-section", sectionId: "organisations", published: false, order: 12 },
    { slug: "personal-details-section", sectionId: null, published: false, order: 13 },
];

/** Editor sections with no Get Tips guide: `basics` has no Get Tips control, the rest have no guide. */
export const SECTIONS_WITHOUT_GUIDE: readonly string[] = ["basics", "interests", "declaration", "custom"];

export function getGuideEntry(slug: string): GuideRegistryEntry | undefined {
    return GUIDE_REGISTRY.find((entry) => entry.slug === slug);
}

/** The published guide for an editor section, or null so the Get Tips control can hide. */
export function getGuideForSection(sectionId: string): GuideRegistryEntry | null {
    return GUIDE_REGISTRY.find((entry) => entry.sectionId === sectionId && entry.published) ?? null;
}

export function getPublishedGuideEntries(): GuideRegistryEntry[] {
    return GUIDE_REGISTRY.filter((entry) => entry.published).sort((a, b) => a.order - b.order);
}
