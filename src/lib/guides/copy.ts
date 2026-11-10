/**
 * English-only interface copy for the section guides pages (feature 079).
 * Guides are English by decision, so this text is editorial content like the
 * guide prose itself and stays out of the translation files. The one string
 * shown to non-English visitors ("guides.englishOnly") is translated.
 */
export const GUIDE_COPY = {
    breadcrumb: "Guides",
    notFoundTitle: "Guide not found",
    draftNotice: "Draft under review: this guide is not published yet and may still change.",
    faqTitle: "Frequently asked questions",
    relatedTitle: "Keep going",
    relatedNextPrefix: "Next:",
    minRead: "min read",
    hub: {
        eyebrow: "EngineCV Guides",
        title: "CV section guides",
        metaTitle: "CV Section Guides",
        description:
            "One practical guide for each part of a CV: what recruiters and applicant tracking systems look for, how to fill in each field, and before and after rewrites you can adapt.",
        metaDescription:
            "Practical guides for every part of a CV: work experience, education, skills, summary and more, with before and after examples.",
        empty: "The first guides are on their way. Check back soon.",
    },
    related: {
        examples: { before: "See complete examples by role in the ", link: "CV examples", after: "." },
        templates: { before: "Pick a layout in the ", link: "CV templates", after: "." },
        hub: { before: "All section guides are in the ", link: "guides hub", after: "." },
    },
} as const;
