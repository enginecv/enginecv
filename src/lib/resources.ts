import type { Locale } from "@/lib/i18n/locales";
import { ROLE_EXAMPLES_PATH, indexLocales } from "@/lib/role-examples/rules";

/** Base path of the resources page; locale URLs prefix it ("/de/resources"). */
export const RESOURCES_PATH = "/resources";

export type ResourceRegion = "de" | "at" | "ch" | "eu";

export type ResourceSectionId = "language" | "recognition" | "work";

export type ExternalResource = {
    /** Translation key `resources.link.<id>` holds the description. */
    id: string;
    /** Proper noun, shown as is in every language. */
    name: string;
    url: string;
    region: ResourceRegion;
    /**
     * Only for an approved affiliate partner. Sponsored links get a visible
     * "Partner link" label and rel="sponsored"; never mark a link before the
     * partner has accepted the application.
     */
    sponsored?: boolean;
};

export type InternalResource = {
    /** Translation key `resources.internal.<id>`. */
    id: string;
    /** Unprefixed path; the page localizes it. */
    path: string;
};

export type ResourceSection = {
    id: ResourceSectionId;
    links: readonly ExternalResource[];
    /** Next steps inside EngineCV. */
    internal: readonly InternalResource[];
};

export const RESOURCE_SECTIONS: readonly ResourceSection[] = [
    {
        id: "language",
        links: [
            { id: "dw", name: "DW Learn German", url: "https://learngerman.dw.com", region: "de" },
            { id: "goethe", name: "Goethe-Institut", url: "https://www.goethe.de/en/spr/prf.html", region: "de" },
            { id: "telc", name: "telc", url: "https://www.telc.net", region: "de" },
            { id: "osd", name: "ÖSD", url: "https://www.osd.at", region: "at" },
        ],
        internal: [{ id: "cefr", path: "/tools/cefr-level" }],
    },
    {
        id: "recognition",
        links: [
            { id: "anerkennung", name: "Anerkennung in Deutschland", url: "https://www.anerkennung-in-deutschland.de", region: "de" },
            { id: "berufsanerkennung", name: "berufsanerkennung.at", url: "https://www.berufsanerkennung.at", region: "at" },
            { id: "sbfi", name: "SBFI", url: "https://www.sbfi.admin.ch/en/recognition-of-professional-qualifications", region: "ch" },
        ],
        internal: [],
    },
    {
        id: "work",
        links: [
            {
                id: "westbalkan",
                name: "Make it in Germany",
                url: "https://www.make-it-in-germany.com/en/visa-residence/types/western-balkans-regulation",
                region: "de",
            },
            { id: "ba", name: "Bundesagentur für Arbeit", url: "https://www.arbeitsagentur.de/jobsuche/", region: "de" },
            { id: "ams", name: "AMS", url: "https://www.ams.at", region: "at" },
            { id: "jobroom", name: "Job-Room", url: "https://www.job-room.ch", region: "ch" },
            { id: "eures", name: "EURES", url: "https://eures.europa.eu", region: "eu" },
        ],
        internal: [
            { id: "europass", path: "/tools/europass-to-cv" },
            { id: "templates", path: "/cv-templates" },
            { id: "examples", path: "/cv-examples" },
        ],
    },
];

/** rel for an outbound resource link: sponsored links say so to crawlers too. */
export function resourceLinkRel(link: ExternalResource): string {
    return link.sponsored ? "sponsored noopener noreferrer" : "noopener noreferrer";
}

export function hasSponsoredResources(sections: readonly ResourceSection[] = RESOURCE_SECTIONS): boolean {
    return sections.some((section) => section.links.some((link) => link.sponsored));
}

/**
 * A section's next steps that exist in this language. Role examples have no index in a
 * language without published examples, so the link is left out rather than sent to a 404.
 */
export function internalResourcesFor(section: ResourceSection, locale: Locale): readonly InternalResource[] {
    const examplesAvailable = (indexLocales() as string[]).includes(locale);
    return section.internal.filter((item) => !item.path.startsWith(ROLE_EXAMPLES_PATH) || examplesAvailable);
}
