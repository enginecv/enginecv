import { getIndexGuide, type IndexGuideId } from "@/lib/index-guides";
import type { Locale } from "@/lib/i18n/locales";

/**
 * A short written guide under a hub page. English only, so other locales render
 * nothing and keep their translated page as it was. Server-rendered, so
 * crawlers and visitors without JavaScript get it.
 */
export function IndexGuide({ locale, id }: { locale: Locale; id: IndexGuideId }) {
    if (locale !== "en") return null;
    const guide = getIndexGuide(id);

    return (
        <section className="mt-16 max-w-3xl" aria-labelledby={`index-guide-${id}`} data-testid="index-guide">
            <h2 id={`index-guide-${id}`} className="text-xl font-semibold">{guide.heading}</h2>
            <div className="mt-4 space-y-4 text-base leading-7 text-mid">
                {guide.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                ))}
            </div>
        </section>
    );
}
