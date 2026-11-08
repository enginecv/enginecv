import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdBanner } from "@/components/AdBanner";
import { GalleryPage } from "@/components/templates/gallery/GalleryPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAllBlogPostMeta } from "@/lib/blog";
import { publishedVersions } from "@/lib/blog-articles";
import { DEFAULT_LOCALE, OG_LOCALES, localizedPath, type Locale } from "@/lib/i18n/locales";
import { LanguageLinksProvider } from "@/lib/i18n/route-locale";
import { translate } from "@/lib/i18n/translate";
import { loadRoleExample } from "@/lib/role-examples/load";
import {
    entryPath,
    exampleAlternates,
    findEntry,
    indexLocales,
    languageLinks,
    roleExamplePath,
    type RoleExampleEntry,
} from "@/lib/role-examples/rules";
import { isRoleExampleLocale } from "@/lib/role-examples/registry";
import { pageMetadata } from "@/lib/site";
import { roleExampleBreadcrumbJsonLd } from "@/lib/structured-data";
import { galleryTemplatePath } from "@/lib/templates/gallery";
import { EditExampleButton } from "./EditExampleButton";
import { ExamplePreview } from "./ExamplePreview";

/** Metadata for one example page: canonical, hreflang between published siblings, noindex while a draft. */
export function roleExampleMetadata(locale: Locale, slug: string): Metadata {
    const entry = findEntry(locale, slug);
    if (!entry) return { title: translate(locale, "roleExamples.indexTitle") };

    const isDraft = entry.version.status === "draft";
    const languages = isDraft ? {} : exampleAlternates(entry.role);
    const base = pageMetadata({
        title: entry.version.title,
        description: entry.version.description,
        path: entryPath(entry),
        ogLocale: OG_LOCALES[locale],
        languages: Object.keys(languages).length > 0 ? languages : undefined,
    });
    // Drafts are reachable by link for reviewers, never indexed.
    return isDraft ? { ...base, robots: { index: false, follow: true } } : base;
}

/** The related blog post: a published version in the page's language, else in English. */
async function relatedPost(entry: RoleExampleEntry) {
    const versions = publishedVersions(await getAllBlogPostMeta()).filter((post) => post.article === entry.role.relatedArticle);
    return versions.find((post) => post.locale === entry.locale) ?? versions.find((post) => post.locale === DEFAULT_LOCALE) ?? null;
}

/** One role's example page in one language; the URL's language drives every label around it. */
export async function RoleExamplePage({ locale, slug }: { locale: Locale; slug: string }) {
    const entry = isRoleExampleLocale(locale) ? findEntry(locale, slug) : undefined;
    if (!entry) notFound();

    const { role, version } = entry;
    const [loaded, post] = await Promise.all([loadRoleExample(entry), relatedPost(entry)]);
    const text = (key: string, params?: Record<string, string>) => translate(locale, key, params);
    const hasIndex = indexLocales().includes(entry.locale);

    return (
        <LanguageLinksProvider links={languageLinks(entry)}>
            <GalleryPage locale={locale}>
                <JsonLd nodes={[roleExampleBreadcrumbJsonLd(locale, entry)]} />

                {version.status === "draft" ? (
                    <p
                        role="note"
                        data-testid="role-example-draft-notice"
                        className="mb-8 rounded-2xl border border-warning-tint2 bg-warning-tint px-4 py-3 text-sm leading-6 text-strong"
                    >
                        {text("roleExamples.draftNotice")}
                    </p>
                ) : null}

                {hasIndex ? (
                    <Link
                        href={roleExamplePath(locale)}
                        className="inline-flex items-center gap-1.5 text-sm text-mid transition-colors hover:text-strong"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        {text("roleExamples.backToAll")}
                    </Link>
                ) : null}

                <article className="mt-6" data-testid="role-example" data-role={role.id} data-locale={locale}>
                    <header className="max-w-3xl">
                        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{version.title}</h1>
                        <p className="mt-4 text-base leading-7 text-mid">{loaded.prose.intro}</p>
                        <div className="mt-6">
                            <EditExampleButton roleId={role.id} locale={locale} name={version.name} />
                        </div>
                    </header>

                    <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
                        <section aria-labelledby="role-example-cv" className="min-w-0">
                            <h2 id="role-example-cv" className="sr-only">{text("roleExamples.cvHeading")}</h2>
                            <ExamplePreview resume={loaded.previewResume} paperSize={loaded.paperSize} />
                            <p className="mt-3 text-xs leading-5 text-faint">{text("roleExamples.fictionalNote")}</p>
                        </section>

                        <div className="min-w-0 space-y-10">
                            <section aria-labelledby="role-example-tips">
                                <h2 id="role-example-tips" className="text-xl font-semibold">{text("roleExamples.tipsHeading")}</h2>
                                <ol className="mt-4 space-y-4" data-testid="role-example-tips">
                                    {loaded.prose.tips.map((tip, index) => (
                                        <li key={tip} className="flex gap-3 text-base leading-7 text-mid">
                                            <span
                                                aria-hidden="true"
                                                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-surface-2"
                                            >
                                                {index + 1}
                                            </span>
                                            <span>{tip}</span>
                                        </li>
                                    ))}
                                </ol>
                            </section>

                            {/* Renders nothing, and leaves no gap, until ads are configured, consented to and allowed on this page. */}
                            <AdBanner slot="example_after_tips" className="mt-2" />

                            <section aria-labelledby="role-example-skills">
                                <h2 id="role-example-skills" className="text-xl font-semibold">{text("roleExamples.skillsHeading")}</h2>
                                <ul className="mt-4 flex flex-wrap gap-2" data-testid="role-example-skills">
                                    {loaded.prose.skills.map((skill) => (
                                        <li key={skill} className="rounded-full border border-edge bg-surface-3 px-3 py-1 text-sm text-mid">
                                            {skill}
                                        </li>
                                    ))}
                                </ul>
                            </section>

                            <nav aria-label={text("roleExamples.relatedTemplate", { name: loaded.gallery.template.meta.name })} className="space-y-2 text-sm">
                                <p>
                                    <Link
                                        href={localizedPath(galleryTemplatePath(loaded.gallery.slug), locale)}
                                        className="text-accent underline underline-offset-2 hover:text-accent-soft"
                                    >
                                        {text("roleExamples.relatedTemplate", { name: loaded.gallery.template.meta.name })}
                                    </Link>
                                </p>
                                {post ? (
                                    <p>
                                        <Link href={post.path} className="text-accent underline underline-offset-2 hover:text-accent-soft">
                                            {text("roleExamples.relatedArticle", { title: post.title })}
                                        </Link>
                                    </p>
                                ) : null}
                            </nav>
                        </div>
                    </div>

                    {loaded.prose.sections?.length ? (
                        <div className="mt-14 max-w-3xl space-y-10" data-testid="role-example-sections">
                            {loaded.prose.sections.map((section, index) => (
                                <section key={section.heading} aria-labelledby={`role-example-section-${index}`}>
                                    <h2 id={`role-example-section-${index}`} className="text-xl font-semibold">{section.heading}</h2>
                                    <div className="mt-4 space-y-4 text-base leading-7 text-mid">
                                        {section.paragraphs.map((paragraph) => (
                                            <p key={paragraph}>{paragraph}</p>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    ) : null}

                    <section aria-labelledby="role-example-text" className="mt-14 max-w-3xl">
                        <h2 id="role-example-text" className="text-xl font-semibold">{text("roleExamples.textVersionHeading")}</h2>
                        <div
                            data-testid="role-example-text"
                            className="mt-4 text-sm leading-6 text-mid [&_h3]:mb-2 [&_h3]:text-2xl [&_h3]:font-semibold [&_h4]:mb-1 [&_h4]:mt-6 [&_h4]:text-base [&_h4]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-2"
                            // Built from repository content through the document model, which escapes every field.
                            dangerouslySetInnerHTML={{ __html: loaded.textHtml }}
                        />
                    </section>
                </article>
            </GalleryPage>
        </LanguageLinksProvider>
    );
}
