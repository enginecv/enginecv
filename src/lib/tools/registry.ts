import type { ResourceSectionId } from "@/lib/resources";

/** Base path of the free tools; locale URLs prefix it ("/de/tools"). */
export const TOOLS_PATH = "/tools";

// Public slug of each tool, in display order. Slugs are part of indexed URLs:
// never rename one without a redirect.
export const TOOL_SLUGS = ["europass-to-cv", "linkedin-to-cv", "github-to-cv", "cefr-level"] as const;

export type ToolSlug = (typeof TOOL_SLUGS)[number];

/** Which client panel a tool page mounts. */
export type ToolPanelId = "europass" | "linkedin" | "github" | "cefr";

export type ToolFaqKey = { q: string; a: string };

export type ToolDefinition = {
    slug: ToolSlug;
    /** Translation key prefix: `${keyPrefix}.title`, `.intro`, `.steps.1`, ... */
    keyPrefix: string;
    /** Number of numbered how-to steps (`${keyPrefix}.steps.1..n`). */
    stepCount: number;
    /** Visible FAQ and FAQPage structured data read the same keys. */
    faq: readonly ToolFaqKey[];
    panel: ToolPanelId;
    /** False when the tool needs the network (GitHub). */
    worksOffline: boolean;
    /** Lets tools ship one at a time: a disabled tool 404s and is listed nowhere. */
    enabled: boolean;
    /** Section of /resources offered as the next step (`resources.next.<id>`). */
    resourcesSection?: ResourceSectionId;
};

function faqKeys(keyPrefix: string, count: number): ToolFaqKey[] {
    return Array.from({ length: count }, (_, i) => ({
        q: `${keyPrefix}.faq.q${i + 1}`,
        a: `${keyPrefix}.faq.a${i + 1}`,
    }));
}

const TOOLS: readonly ToolDefinition[] = [
    {
        slug: "europass-to-cv",
        keyPrefix: "tools.europass",
        stepCount: 3,
        faq: faqKeys("tools.europass", 5),
        panel: "europass",
        worksOffline: true,
        enabled: true,
    },
    {
        slug: "linkedin-to-cv",
        keyPrefix: "tools.linkedin",
        stepCount: 3,
        faq: faqKeys("tools.linkedin", 5),
        panel: "linkedin",
        worksOffline: true,
        enabled: true,
    },
    {
        slug: "github-to-cv",
        keyPrefix: "tools.github",
        stepCount: 3,
        faq: faqKeys("tools.github", 5),
        panel: "github",
        worksOffline: false,
        enabled: true,
    },
    {
        slug: "cefr-level",
        keyPrefix: "tools.cefr",
        resourcesSection: "language",
        stepCount: 3,
        faq: faqKeys("tools.cefr", 5),
        panel: "cefr",
        worksOffline: true,
        enabled: true,
    },
];

/** Every tool, enabled or not (for key-parity tests). */
export function getTools(): readonly ToolDefinition[] {
    return TOOLS;
}

export function getEnabledTools(): ToolDefinition[] {
    return TOOLS.filter((tool) => tool.enabled);
}

/** An enabled tool by slug; undefined for unknown or not-yet-enabled slugs. */
export function getTool(slug: string): ToolDefinition | undefined {
    return getEnabledTools().find((tool) => tool.slug === slug);
}

export function toolPath(slug: ToolSlug): string {
    return `${TOOLS_PATH}/${slug}`;
}

/** The other enabled tools, so each page links onward. */
export function relatedTools(slug: ToolSlug): ToolDefinition[] {
    return getEnabledTools().filter((tool) => tool.slug !== slug);
}
