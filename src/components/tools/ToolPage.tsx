import Link from "next/link";
import { ArrowRight, ChevronRight, Lock } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { GalleryPage } from "@/components/templates/gallery/GalleryPage";
import { ToolDeepDive } from "@/components/tools/ToolDeepDive";
import { ToolFaq } from "@/components/tools/ToolFaq";
import { ToolPanelSlot } from "@/components/tools/ToolPanelSlot";
import { localizedPath, type Locale } from "@/lib/i18n/locales";
import { RESOURCES_PATH } from "@/lib/resources";
import { translate } from "@/lib/i18n/translate";
import { SITE_NAME } from "@/lib/site";
import { faqJsonLd, toolBreadcrumbJsonLd } from "@/lib/structured-data";
import { TOOLS_PATH, relatedTools, toolPath, type ToolDefinition } from "@/lib/tools/registry";

export const TOOL_TITLE_ID = "tool-title";

/**
 * A public tool page. Everything but the tool itself is server-rendered, so
 * crawlers and visitors without JavaScript get the explanation, steps and FAQ.
 */
export function ToolPage({ locale, tool }: { locale: Locale; tool: ToolDefinition }) {
    const t = (key: string) => translate(locale, key);
    const p = tool.keyPrefix;
    const related = relatedTools(tool.slug);

    return (
        <GalleryPage locale={locale}>
            <JsonLd nodes={[toolBreadcrumbJsonLd(locale, tool), faqJsonLd(locale, tool.faq)]} />

            <nav aria-label={t("tools.breadcrumb")} className="text-sm text-mid">
                <ol className="flex flex-wrap items-center gap-1.5">
                    <li><Link href={localizedPath("/", locale)} className="hover:text-strong">{SITE_NAME}</Link></li>
                    <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
                    <li><Link href={localizedPath(TOOLS_PATH, locale)} className="hover:text-strong">{t("tools.breadcrumb")}</Link></li>
                </ol>
            </nav>

            <div className="mt-6 max-w-3xl">
                <h1 id={TOOL_TITLE_ID} className="text-3xl font-semibold tracking-tight sm:text-4xl">{t(`${p}.title`)}</h1>
                <p className="mt-4 text-base leading-7 text-mid">{t(`${p}.intro`)}</p>
                <p className="mt-4 flex items-start gap-2 text-sm text-mid">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    <span>{t(`${p}.privacy`)}</span>
                </p>
            </div>

            <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-start">
                <div className="min-w-0 rounded-2xl border border-edge bg-surface-4 p-5 sm:p-7">
                    <ToolPanelSlot panel={tool.panel} worksOffline={tool.worksOffline} labelledBy={TOOL_TITLE_ID} />
                </div>

                <section aria-labelledby="tool-steps" className="min-w-0">
                    <h2 id="tool-steps" className="text-lg font-semibold">{t("tools.howItWorks")}</h2>
                    <ol className="mt-4 space-y-4">
                        {Array.from({ length: tool.stepCount }, (_, i) => (
                            <li key={i} className="flex gap-3 text-sm leading-6 text-mid">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent" aria-hidden="true">
                                    {i + 1}
                                </span>
                                <span>{t(`${p}.steps.${i + 1}`)}</span>
                            </li>
                        ))}
                    </ol>
                </section>
            </div>

            {tool.resourcesSection && (
                <aside className="mt-12 flex flex-col gap-3 rounded-2xl border border-edge bg-surface-3 p-5 sm:flex-row sm:items-center sm:justify-between" data-testid="tool-resources-next">
                    <p className="text-sm leading-6 text-mid">{t(`resources.next.${tool.resourcesSection}`)}</p>
                    <Link
                        href={`${localizedPath(RESOURCES_PATH, locale)}#${tool.resourcesSection}`}
                        className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-accent"
                    >
                        {t("resources.next.cta")}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                </aside>
            )}

            <ToolDeepDive locale={locale} slug={tool.slug} />

            <ToolFaq locale={locale} keys={tool.faq} />

            {related.length > 0 && (
                <section className="mt-16" aria-labelledby="tool-related">
                    <h2 id="tool-related" className="text-xl font-semibold">{t("tools.moreTools")}</h2>
                    <ul className="mt-5 grid gap-4 sm:grid-cols-3">
                        {related.map((other) => (
                            <li key={other.slug}>
                                <Link
                                    href={localizedPath(toolPath(other.slug), locale)}
                                    className="group block h-full rounded-2xl border border-edge bg-surface-3 p-5 transition-colors hover:border-accent/60"
                                >
                                    <span className="font-medium text-strong">{t(`${other.keyPrefix}.title`)}</span>
                                    <span className="mt-2 block text-sm leading-6 text-mid">{t(`${other.keyPrefix}.card`)}</span>
                                    <ArrowRight className="mt-3 h-4 w-4 text-accent transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </GalleryPage>
    );
}
