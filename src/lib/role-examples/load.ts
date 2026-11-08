import { buildExampleResume } from "@/lib/onboarding/create-example";
import { resolveExampleContent } from "@/lib/onboarding/examples";
import type { Resume } from "@/lib/schema";
import { getGalleryTemplate, type GalleryTemplate } from "@/lib/templates/gallery";
import { applyTemplateToResume } from "@/lib/templates/template-apply";
import type { RoleProse } from "./registry";
import type { RoleExampleEntry } from "./rules";
import { exampleTextHtml } from "./text-version";

export interface LoadedRoleExample {
    prose: RoleProse;
    /** The example CV in its own template, ready for the live preview. */
    previewResume: Resume;
    paperSize: "a4" | "letter";
    gallery: GalleryTemplate;
    /** The same CV as semantic HTML for the page body. */
    textHtml: string;
}

/**
 * Everything a role page needs, built once at build time. The resume is
 * deterministic (fixed id and timestamp), so the static page is stable across builds.
 */
export async function loadRoleExample(entry: RoleExampleEntry): Promise<LoadedRoleExample> {
    const { role, locale, version } = entry;
    const gallery = getGalleryTemplate(role.template);
    if (!gallery) throw new Error(`Role example "${role.id}" uses unknown template "${role.template}".`);

    const [proseByLocale, content] = await Promise.all([role.loadProse(), role.loadContent()]);
    const prose = proseByLocale[locale];
    if (!prose) throw new Error(`Role example "${role.id}" has no ${locale} prose.`);

    const { locale: contentLocale, input } = resolveExampleContent(content, locale);
    if (contentLocale !== locale) throw new Error(`Role example "${role.id}" has no ${locale} CV content.`);

    const base = buildExampleResume(input, contentLocale, version.title, Date.parse(version.date), `role-example-${role.id}-${locale}`);
    const { resume: previewResume } = applyTemplateToResume(base, gallery.template);

    return {
        prose,
        previewResume,
        paperSize: gallery.template.paperSize ?? "a4",
        gallery,
        textHtml: exampleTextHtml(previewResume, gallery.template.settings.colors.accent),
    };
}
