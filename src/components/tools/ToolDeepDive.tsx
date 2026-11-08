import { getToolProse, TOOL_PROSE_HEADINGS } from "@/lib/tools/prose";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Long-form explanation under a tool: what it does, what goes in, what happens
 * to the data, and where it stops. English only for now, so every other locale
 * renders nothing here and keeps its translated page as it was. Server-rendered,
 * like the rest of the page, so crawlers and visitors without JavaScript get it.
 */
export function ToolDeepDive({ locale, slug }: { locale: Locale; slug: string }) {
    if (locale !== "en") return null;
    const prose = getToolProse(slug);
    if (!prose) return null;

    return (
        <div className="mt-14 max-w-3xl space-y-10" data-testid="tool-deep-dive">
            <section aria-labelledby="tool-about">
                <h2 id="tool-about" className="text-xl font-semibold">{TOOL_PROSE_HEADINGS.about}</h2>
                <div className="mt-4 space-y-4 text-base leading-7 text-mid">
                    {prose.overview.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                    ))}
                </div>
            </section>

            <section aria-labelledby="tool-formats">
                <h2 id="tool-formats" className="text-xl font-semibold">{prose.formatsHeading}</h2>
                <dl className="mt-4 space-y-4 text-base leading-7 text-mid">
                    {prose.formats.map((format) => (
                        <div key={format.name}>
                            <dt className="font-medium text-strong">{format.name}</dt>
                            <dd>{format.detail}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            <section aria-labelledby="tool-privacy">
                <h2 id="tool-privacy" className="text-xl font-semibold">{TOOL_PROSE_HEADINGS.privacy}</h2>
                <div className="mt-4 space-y-4 text-base leading-7 text-mid">
                    {prose.privacy.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                    ))}
                </div>
            </section>

            <section aria-labelledby="tool-limits">
                <h2 id="tool-limits" className="text-xl font-semibold">{TOOL_PROSE_HEADINGS.limits}</h2>
                <ul className="mt-4 list-disc space-y-3 pl-5 text-base leading-7 text-mid">
                    {prose.limits.map((limit) => (
                        <li key={limit}>{limit}</li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
