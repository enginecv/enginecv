import type { ExampleContent } from "@/lib/onboarding/examples/types";
import type { GallerySlug } from "@/lib/templates/gallery";

/*
 * Registry of role example pages (#64). A role has one CV (example content,
 * shared with the onboarding module) and one page version per language. A
 * version is `draft` until a native speaker has reviewed its text: drafts load
 * by URL but are noindex and stay out of the sitemap, index and hreflang.
 */

export const ROLE_EXAMPLE_LOCALES = ["en", "de"] as const;
export type RoleExampleLocale = (typeof ROLE_EXAMPLE_LOCALES)[number];

export function isRoleExampleLocale(value: string): value is RoleExampleLocale {
    return (ROLE_EXAMPLE_LOCALES as readonly string[]).includes(value);
}

export const ROLE_FIELDS = ["tech", "care", "trades", "hospitality", "other"] as const;
export type RoleField = (typeof ROLE_FIELDS)[number];

export type RoleExampleStatus = "draft" | "published";

/** Page-level text for one language. */
export interface RoleProse {
    intro: string;
    /** 3–5 role-specific tips. */
    tips: string[];
    /** Typical skills for the role, at least six. */
    skills: string[];
    /**
     * Longer written sections (why the example works, role keywords, common
     * mistakes). Optional so German drafts, which have none yet, stay valid.
     * Headings live here, not in the translation files, because this text is
     * English only for now.
     */
    sections?: { heading: string; paragraphs: string[] }[];
}

export interface RoleExampleVersion {
    /** Unique within its language; part of an indexed URL, so never rename without a redirect. */
    slug: string;
    status: RoleExampleStatus;
    /** Short role name, used in the title of the CV a visitor creates from the example. */
    name: string;
    title: string;
    /** Meta description, 120–160 characters. */
    description: string;
    /** ISO date the text was last reviewed or changed. */
    date: string;
}

export interface RoleExample {
    id: string;
    field: RoleField;
    /** Gallery template slug used for the preview. */
    template: GallerySlug;
    /** Blog `article` id of a related post (must have a published version). */
    relatedArticle: string;
    versions: Partial<Record<RoleExampleLocale, RoleExampleVersion>>;
    /** CV content; loaded on demand so no role ships with the dashboard bundle. */
    loadContent: () => Promise<ExampleContent>;
    loadProse: () => Promise<Partial<Record<RoleExampleLocale, RoleProse>>>;
}

export const ROLE_EXAMPLES: readonly RoleExample[] = [
    {
        id: "software-developer",
        field: "tech",
        template: "developer",
        relatedArticle: "best-cv-formats-for-ats-systems",
        versions: {
            en: {
                slug: "software-developer",
                status: "published",
                name: "Software Developer",
                title: "Software Developer CV Example (with Tips and Skills)",
                description:
                    "A complete software developer CV example you can edit for free: structure, skills to list, what to put in projects and how to show your language levels.",
                date: "2026-11-02",
            },
            de: {
                slug: "softwareentwickler",
                status: "draft",
                name: "Softwareentwickler",
                title: "Lebenslauf Softwareentwickler: Muster mit Tipps und Skills",
                description:
                    "Ein vollständiger Lebenslauf als Softwareentwickler zum kostenlosen Bearbeiten: Aufbau, Skills, Projekte und die richtige Angabe Ihrer Sprachkenntnisse.",
                date: "2026-11-02",
            },
        },
        loadContent: async () => {
            const [{ content }, { de }] = await Promise.all([
                import("@/lib/onboarding/examples/software-developer"),
                import("@/lib/onboarding/examples/software-developer.de"),
            ]);
            return { ...content, de };
        },
        loadProse: () => import("./prose/software-developer").then((module) => module.prose),
    },
    {
        id: "nurse",
        field: "care",
        template: "lebenslauf",
        relatedArticle: "cefr-language-levels",
        versions: {
            en: {
                slug: "nurse",
                status: "published",
                name: "Nurse",
                title: "Nurse CV Example for Germany and Abroad",
                description:
                    "A registered nurse CV example you can edit for free: what employers in Germany expect, how to list clinical skills and how to show your German level.",
                date: "2026-11-02",
            },
            de: {
                slug: "pflegefachkraft",
                status: "draft",
                name: "Pflegefachkraft",
                title: "Lebenslauf Pflegefachkraft: Muster mit Tipps und Kenntnissen",
                description:
                    "Ein Lebenslauf-Muster für Pflegefachkräfte zum kostenlosen Bearbeiten: Aufbau, Fachkenntnisse, Anerkennung und die richtige Angabe des Sprachniveaus.",
                date: "2026-11-02",
            },
        },
        loadContent: async () => {
            const [{ content }, { de }] = await Promise.all([
                import("@/lib/onboarding/examples/nurse"),
                import("@/lib/onboarding/examples/nurse.de"),
            ]);
            return { ...content, de };
        },
        loadProse: () => import("./prose/nurse").then((module) => module.prose),
    },
    {
        id: "frontend-developer",
        field: "tech",
        template: "modern",
        relatedArticle: "how-to-write-a-resume-in-2026",
        versions: {
            en: {
                slug: "frontend-developer",
                status: "published",
                name: "Frontend Developer",
                title: "Frontend Developer CV Example (with Tips and Skills)",
                description:
                    "A frontend developer CV example you can edit for free: how to show shipped interfaces, accessibility and performance, and how to list your language levels.",
                date: "2026-11-02",
            },
            de: {
                slug: "frontend-entwickler",
                status: "draft",
                name: "Frontend-Entwickler",
                title: "Lebenslauf Frontend-Entwickler: Muster mit Tipps und Skills",
                description:
                    "Lebenslauf-Muster für Frontend-Entwickler zum kostenlosen Bearbeiten: Projekte, Barrierefreiheit, Performance und die richtige Angabe der Sprachkenntnisse.",
                date: "2026-11-02",
            },
        },
        loadContent: () => import("@/lib/onboarding/examples/frontend-developer").then((module) => module.content),
        loadProse: () => import("./prose/frontend-developer").then((module) => module.prose),
    },
    {
        id: "backend-developer",
        field: "tech",
        template: "ats-plain",
        relatedArticle: "common-resume-mistakes",
        versions: {
            en: {
                slug: "backend-developer",
                status: "published",
                name: "Backend Developer",
                title: "Backend Developer CV Example (Java, with Tips and Skills)",
                description:
                    "A backend developer CV example you can edit for free: how to show scale, reliability and ownership, plus the German level employers want to see.",
                date: "2026-11-02",
            },
            de: {
                slug: "backend-entwickler",
                status: "draft",
                name: "Backend-Entwickler",
                title: "Lebenslauf Backend-Entwickler: Muster mit Tipps und Skills",
                description:
                    "Lebenslauf-Muster für Backend-Entwickler zum kostenlosen Bearbeiten: Systemgröße, Zuverlässigkeit, Verantwortung und das erwartete Deutschniveau.",
                date: "2026-11-02",
            },
        },
        loadContent: () => import("@/lib/onboarding/examples/backend-developer").then((module) => module.content),
        loadProse: () => import("./prose/backend-developer").then((module) => module.prose),
    },
    {
        id: "devops-engineer",
        field: "tech",
        template: "developer",
        relatedArticle: "best-cv-formats-for-ats-systems",
        versions: {
            en: {
                slug: "devops-engineer",
                status: "published",
                name: "DevOps Engineer",
                title: "DevOps Engineer CV Example (Kubernetes, with Tips)",
                description:
                    "A DevOps engineer CV example you can edit for free: show deployment speed, stability and cloud cost with numbers, and list your tools in the right order.",
                date: "2026-11-02",
            },
            de: {
                slug: "devops-engineer",
                status: "draft",
                name: "DevOps-Engineer",
                title: "Lebenslauf DevOps-Engineer: Muster mit Tipps und Skills",
                description:
                    "Lebenslauf-Muster für DevOps-Engineers zum kostenlosen Bearbeiten: Deployment-Tempo, Stabilität und Cloud-Kosten mit Zahlen belegen, Werkzeuge richtig ordnen.",
                date: "2026-11-02",
            },
        },
        loadContent: () => import("@/lib/onboarding/examples/devops-engineer").then((module) => module.content),
        loadProse: () => import("./prose/devops-engineer").then((module) => module.prose),
    },
    {
        id: "data-analyst",
        field: "tech",
        template: "sidebar",
        relatedArticle: "how-to-write-a-resume-in-2026",
        versions: {
            en: {
                slug: "data-analyst",
                status: "published",
                name: "Data Analyst",
                title: "Data Analyst CV Example (SQL, Power BI, with Tips)",
                description:
                    "A data analyst CV example you can edit for free: how to show business impact, name your tools precisely and prove that you can explain results clearly.",
                date: "2026-11-02",
            },
            de: {
                slug: "datenanalyst",
                status: "draft",
                name: "Datenanalystin",
                title: "Lebenslauf Datenanalyst: Muster mit Tipps und Skills",
                description:
                    "Ein Lebenslauf-Muster für Datenanalysten zum kostenlosen Bearbeiten: geschäftliche Wirkung zeigen, Werkzeuge genau nennen und Ergebnisse verständlich belegen.",
                date: "2026-11-02",
            },
        },
        loadContent: () => import("@/lib/onboarding/examples/data-analyst").then((module) => module.content),
        loadProse: () => import("./prose/data-analyst").then((module) => module.prose),
    },
    {
        id: "qa-tester",
        field: "tech",
        template: "timeline",
        relatedArticle: "common-resume-mistakes",
        versions: {
            en: {
                slug: "qa-tester",
                status: "published",
                name: "QA Tester",
                title: "QA Tester CV Example (Test Automation, with Tips)",
                description:
                    "A QA engineer CV example you can edit for free: show the move from manual testing to automation, put numbers on your test suite and list your toolchain.",
                date: "2026-11-02",
            },
            de: {
                slug: "softwaretester",
                status: "draft",
                name: "Softwaretester",
                title: "Lebenslauf Softwaretester: Muster mit Tipps und Skills",
                description:
                    "Lebenslauf-Muster für Softwaretester zum kostenlosen Bearbeiten: Weg zur Automatisierung, Testzahlen mit Kontext und die ganze Werkzeugkette richtig darstellen.",
                date: "2026-11-02",
            },
        },
        loadContent: () => import("@/lib/onboarding/examples/qa-tester").then((module) => module.content),
        loadProse: () => import("./prose/qa-tester").then((module) => module.prose),
    },
    {
        id: "it-support",
        field: "tech",
        template: "ats-plain",
        relatedArticle: "cefr-language-levels",
        versions: {
            en: {
                slug: "it-support",
                status: "published",
                name: "IT Support",
                title: "IT Support CV Example (Helpdesk, with Tips and Skills)",
                description:
                    "An IT support CV example you can edit for free: use ticket numbers a team lead understands, name your systems and show your German level with a certificate.",
                date: "2026-11-02",
            },
            de: {
                slug: "it-support",
                status: "draft",
                name: "IT-Support",
                title: "Lebenslauf IT-Support: Muster mit Tipps und Skills",
                description:
                    "Ein Lebenslauf-Muster für den IT-Support zum kostenlosen Bearbeiten: Ticketzahlen nennen, Systeme benennen und das Deutschniveau mit Zertifikat belegen.",
                date: "2026-11-02",
            },
        },
        loadContent: () => import("@/lib/onboarding/examples/it-support").then((module) => module.content),
        loadProse: () => import("./prose/it-support").then((module) => module.prose),
    },
];

export function getRoleExample(id: string): RoleExample | undefined {
    return ROLE_EXAMPLES.find((role) => role.id === id);
}
