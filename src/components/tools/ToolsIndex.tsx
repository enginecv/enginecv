import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { IndexGuide } from "@/components/seo/IndexGuide";
import { JsonLd } from "@/components/seo/JsonLd";
import { GalleryPage } from "@/components/templates/gallery/GalleryPage";
import { localizedPath, type Locale } from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/translate";
import { toolBreadcrumbJsonLd } from "@/lib/structured-data";
import { getEnabledTools, toolPath } from "@/lib/tools/registry";

/** The /tools index: one card per live tool. */
export function ToolsIndex({ locale }: { locale: Locale }) {
    const t = (key: string) => translate(locale, key);

    return (
        <GalleryPage locale={locale}>
            <JsonLd nodes={[toolBreadcrumbJsonLd(locale)]} />
            <div className="max-w-3xl">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("tools.index.title")}</h1>
                <p className="mt-4 text-base leading-7 text-mid">{t("tools.index.intro")}</p>
                <p className="mt-4 flex items-start gap-2 text-sm text-mid">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    <span>{t("tools.privacyBadge")}</span>
                </p>
            </div>

            <ul className="mt-10 grid gap-5 sm:grid-cols-2" data-testid="tools-index">
                {getEnabledTools().map((tool) => (
                    <li key={tool.slug}>
                        <Link
                            href={localizedPath(toolPath(tool.slug), locale)}
                            className="group flex h-full flex-col rounded-2xl border border-edge bg-surface-3 p-6 transition-colors hover:border-accent/60"
                        >
                            <h2 className="text-lg font-semibold text-strong">{t(`${tool.keyPrefix}.title`)}</h2>
                            <p className="mt-2 flex-1 text-sm leading-6 text-mid">{t(`${tool.keyPrefix}.card`)}</p>
                            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                                {t("tools.openTool")}
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>

            <IndexGuide locale={locale} id="tools" />
        </GalleryPage>
    );
}
