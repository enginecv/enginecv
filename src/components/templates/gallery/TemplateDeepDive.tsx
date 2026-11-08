import { getTemplateProse, TEMPLATE_PROSE_HEADINGS } from "@/lib/templates/prose";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Long-form explanation under a template: what it is, how the page is built,
 * how to fill it in and when to pick another. English only for now, so every
 * other locale renders nothing here and keeps its translated page as it was.
 * Server-rendered, so crawlers and visitors without JavaScript get it.
 */
export function TemplateDeepDive({ locale, slug }: { locale: Locale; slug: string }) {
    if (locale !== "en") return null;
    const prose = getTemplateProse(slug);
    if (!prose) return null;

    return (
        <div className="mt-16 max-w-3xl space-y-10" data-testid="template-deep-dive">
            <section aria-labelledby="template-about">
                <h2 id="template-about" className="text-xl font-semibold">{TEMPLATE_PROSE_HEADINGS.about}</h2>
                <div className="mt-4 space-y-4 text-base leading-7 text-mid">
                    {prose.overview.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                    ))}
                </div>
            </section>

            <section aria-labelledby="template-build">
                <h2 id="template-build" className="text-xl font-semibold">{TEMPLATE_PROSE_HEADINGS.build}</h2>
                <div className="mt-4 space-y-4 text-base leading-7 text-mid">
                    {prose.build.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                    ))}
                </div>
            </section>

            <section aria-labelledby="template-tips">
                <h2 id="template-tips" className="text-xl font-semibold">{TEMPLATE_PROSE_HEADINGS.tips}</h2>
                <ul className="mt-4 list-disc space-y-3 pl-5 text-base leading-7 text-mid">
                    {prose.tips.map((tip) => (
                        <li key={tip}>{tip}</li>
                    ))}
                </ul>
            </section>

            <section aria-labelledby="template-alternatives">
                <h2 id="template-alternatives" className="text-xl font-semibold">{TEMPLATE_PROSE_HEADINGS.alternatives}</h2>
                <ul className="mt-4 list-disc space-y-3 pl-5 text-base leading-7 text-mid">
                    {prose.alternatives.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
