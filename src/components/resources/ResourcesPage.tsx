import Link from "next/link";
import { ArrowRight, ArrowUpRight, Info } from "lucide-react";
import { GalleryPage } from "@/components/templates/gallery/GalleryPage";
import { localizedPath, type Locale } from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/translate";
import { RESOURCE_SECTIONS, hasSponsoredResources, internalResourcesFor, resourceLinkRel } from "@/lib/resources";

/**
 * Hand-picked official and free resources for the Balkans → DACH job seeker.
 * Server-rendered; outbound links carry no tracking parameters.
 */
export function ResourcesPage({ locale }: { locale: Locale }) {
    const t = (key: string) => translate(locale, key);

    return (
        <GalleryPage locale={locale}>
            <div className="max-w-3xl">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("resources.title")}</h1>
                <p className="mt-4 text-base leading-7 text-mid">{t("resources.intro")}</p>
                <p className="mt-4 flex items-start gap-2 text-sm text-mid" data-testid="resources-disclosure">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    <span>{t(hasSponsoredResources() ? "resources.disclosure.partner" : "resources.disclosure.none")}</span>
                </p>
            </div>

            {RESOURCE_SECTIONS.map((section) => (
                <section key={section.id} id={section.id} aria-labelledby={`resources-${section.id}`} className="mt-14 scroll-mt-28">
                    <h2 id={`resources-${section.id}`} className="text-xl font-semibold">{t(`resources.section.${section.id}.title`)}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-mid">{t(`resources.section.${section.id}.intro`)}</p>

                    <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                        {section.links.map((link) => (
                            <li key={link.id}>
                                <a
                                    href={link.url}
                                    target="_blank"
                                    rel={resourceLinkRel(link)}
                                    className="group flex h-full flex-col rounded-2xl border border-edge bg-surface-3 p-5 transition-colors hover:border-accent/60"
                                >
                                    <span className="flex items-start justify-between gap-3">
                                        <span className="font-medium text-strong">{link.name}</span>
                                        <ArrowUpRight className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                                    </span>
                                    <span className="mt-2 flex-1 text-sm leading-6 text-mid">{t(`resources.link.${link.id}`)}</span>
                                    <span className="mt-3 flex flex-wrap gap-2 text-xs text-faint">
                                        <span className="rounded-full border border-edge px-2 py-0.5">{t(`resources.region.${link.region}`)}</span>
                                        {link.sponsored && (
                                            <span className="rounded-full border border-accent/50 px-2 py-0.5 text-accent">{t("resources.partnerLink")}</span>
                                        )}
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>

                    {internalResourcesFor(section, locale).length > 0 && (
                        <div className="mt-4 rounded-2xl border border-dashed border-edge p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-faint">{t("resources.inEngineCV")}</p>
                            <ul className="mt-3 space-y-2">
                                {internalResourcesFor(section, locale).map((item) => (
                                    <li key={item.id}>
                                        <Link
                                            href={localizedPath(item.path, locale)}
                                            className="group inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline hover:underline-offset-4"
                                        >
                                            {t(`resources.internal.${item.id}`)}
                                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>
            ))}
        </GalleryPage>
    );
}
