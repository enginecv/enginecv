import type { GallerySlug } from "../gallery";
import { prose as atsPlain } from "./ats-plain";
import { prose as developer } from "./developer";
import { prose as executive } from "./executive";
import { prose as lebenslauf } from "./lebenslauf";
import { prose as modern } from "./modern";
import { prose as photoHeader } from "./photo-header";
import { prose as sidebar } from "./sidebar";
import { prose as timeline } from "./timeline";
import type { TemplateProse } from "./types";

export type { TemplateProse } from "./types";

const TEMPLATE_PROSE: Record<GallerySlug, TemplateProse> = {
    modern,
    "ats-plain": atsPlain,
    sidebar,
    "photo-header": photoHeader,
    lebenslauf,
    timeline,
    executive,
    developer,
};

/** Section headings shared by every template page. English only, like the text they introduce. */
export const TEMPLATE_PROSE_HEADINGS = {
    about: "About this template",
    build: "How it is built",
    tips: "Getting the most out of it",
    alternatives: "When another template fits better",
} as const;

export function getTemplateProse(slug: string): TemplateProse | undefined {
    return (TEMPLATE_PROSE as Record<string, TemplateProse | undefined>)[slug];
}

/** Every paragraph of a template's long-form text, in reading order. Used by the content tests. */
export function templateProseParagraphs(prose: TemplateProse): string[] {
    return [...prose.overview, ...prose.build, ...prose.tips, ...prose.alternatives];
}
