import { ArrowUpRight } from "lucide-react";
import { IntentPrefetchLink } from "@/components/ui/IntentPrefetchLink";
import { getAllBlogPostMeta } from "@/lib/blog";
import { blogIndexPath, publishedVersions } from "@/lib/blog-articles";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/translate";

/** Blog `article` ids shown on the landing page, in order. Each needs a published version. */
export const POPULAR_GUIDE_ARTICLES = ["cv-vs-resume", "resume-with-no-experience", "common-resume-mistakes"] as const;

const linkClass =
    "group flex h-full flex-col gap-2 rounded-lg border border-edge bg-surface-1 px-5 py-4 transition-colors hover:border-edge-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/**
 * Links to the most useful blog guides, so they are one click from the homepage.
 * A guide appears in the page's language when it has one, otherwise in English.
 */
export async function PopularGuidesSection({ locale }: { locale: Locale }) {
    const published = publishedVersions(await getAllBlogPostMeta());
    const guides = POPULAR_GUIDE_ARTICLES.flatMap((article) => {
        const versions = published.filter((post) => post.article === article);
        const post = versions.find((candidate) => candidate.locale === locale) ?? versions.find((candidate) => candidate.locale === DEFAULT_LOCALE);
        return post ? [post] : [];
    });
    if (guides.length === 0) return null;

    const text = (key: string) => translate(locale, key);

    return (
        <section className="border-t border-edge px-6 py-20 sm:py-24" data-testid="landing-popular-guides">
            <div className="mx-auto max-w-7xl">
                <p className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-accent">
                    {text("landing.popularGuides.kicker")}
                </p>
                <h2 className="mt-5 max-w-3xl text-3xl font-black leading-tight tracking-[-0.04em] text-strong sm:text-5xl">
                    {text("landing.popularGuides.title")}
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-mid sm:text-lg">
                    {text("landing.popularGuides.description")}
                </p>

                <ul className="mt-10 grid gap-3 md:grid-cols-3">
                    {guides.map((post) => (
                        <li key={post.path}>
                            <IntentPrefetchLink href={post.path} lang={post.locale === locale ? undefined : post.locale} className={linkClass}>
                                <span className="flex items-start gap-3 text-base font-semibold text-strong">
                                    <span className="min-w-0 flex-1">{post.title}</span>
                                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                                </span>
                                <span className="text-sm leading-6 text-mid">{post.description}</span>
                            </IntentPrefetchLink>
                        </li>
                    ))}
                </ul>

                <p className="mt-6">
                    <IntentPrefetchLink
                        href={blogIndexPath(locale)}
                        className="text-sm font-semibold text-bright underline decoration-edge-strong underline-offset-4 transition-colors hover:text-accent focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        {text("landing.popularGuides.allGuides")}
                    </IntentPrefetchLink>
                </p>
            </div>
        </section>
    );
}
