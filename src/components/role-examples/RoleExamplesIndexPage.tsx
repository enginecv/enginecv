import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GalleryPage } from "@/components/templates/gallery/GalleryPage";
import { IndexGuide } from "@/components/seo/IndexGuide";
import { JsonLd } from "@/components/seo/JsonLd";
import { OG_LOCALES, localizedPath, type Locale } from "@/lib/i18n/locales";
import { LanguageLinksProvider } from "@/lib/i18n/route-locale";
import { translate } from "@/lib/i18n/translate";
import { isRoleExampleLocale } from "@/lib/role-examples/registry";
import { entryPath, indexAlternates, indexGroups, indexLanguageLinks, roleExamplePath } from "@/lib/role-examples/rules";
import { pageMetadata, SITE_NAME } from "@/lib/site";
import { breadcrumbJsonLd } from "@/lib/structured-data";

/** Metadata for the index of one language: canonical, and hreflang between languages that have an index. */
export function roleExamplesIndexMetadata(locale: Locale): Metadata {
    const languages = indexAlternates();
    return pageMetadata({
        title: translate(locale, "roleExamples.indexTitle"),
        description: translate(locale, "roleExamples.indexIntro"),
        path: roleExamplePath(locale),
        ogLocale: OG_LOCALES[locale],
        languages: Object.keys(languages).length > 0 ? languages : undefined,
    });
}

/** All published examples of one language, grouped by field. A language with none has no index (404). */
export function RoleExamplesIndexPage({ locale }: { locale: Locale }) {
    const groups = isRoleExampleLocale(locale) ? indexGroups(locale) : [];
    if (groups.length === 0) notFound();

    const text = (key: string) => translate(locale, key);

    return (
        <LanguageLinksProvider links={indexLanguageLinks(locale)}>
            <GalleryPage locale={locale}>
                <JsonLd
                    nodes={[
                        breadcrumbJsonLd([
                            { name: SITE_NAME, path: localizedPath("/", locale) },
                            { name: text("roleExamples.indexTitle"), path: roleExamplePath(locale) },
                        ]),
                    ]}
                />
                <header className="max-w-2xl">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{text("roleExamples.indexTitle")}</h1>
                    <p className="mt-4 text-base leading-7 text-mid">{text("roleExamples.indexIntro")}</p>
                </header>

                {groups.map((group) => (
                    <section key={group.field} aria-labelledby={`role-group-${group.field}`} className="mt-12" data-testid={`role-group-${group.field}`}>
                        <h2 id={`role-group-${group.field}`} className="text-xl font-semibold">{text(`roleExamples.group.${group.field}`)}</h2>
                        <ul className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {group.entries.map((entry) => (
                                <li key={entry.role.id} data-testid="role-example-card" data-role={entry.role.id} className="rounded-2xl border border-edge bg-surface-4/80 p-5">
                                    <h3 className="text-base font-semibold tracking-tight">
                                        <Link href={entryPath(entry)} className="hover:text-accent">
                                            {entry.version.name}
                                        </Link>
                                    </h3>
                                    <p className="mt-2 text-sm leading-6 text-mid">{entry.version.title}</p>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}

                <IndexGuide locale={locale} id="examples" />
            </GalleryPage>
        </LanguageLinksProvider>
    );
}
