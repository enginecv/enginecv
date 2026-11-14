"use client";

import { ArrowUpRight, FileInput, FileJson, FileText, Github, Languages, Linkedin, type LucideIcon } from "lucide-react";
import { IntentPrefetchLink } from "@/components/ui/IntentPrefetchLink";
import { useTranslation } from "@/lib/i18n";
import { localizedPath } from "@/lib/i18n/locales";
import { indexLocales, roleExamplePath } from "@/lib/role-examples/rules";
import { TOOLS_PATH, getEnabledTools, toolPath, type ToolSlug } from "@/lib/tools/registry";

const TOOL_ICONS: Record<ToolSlug, LucideIcon> = {
    "europass-to-cv": FileInput,
    "linkedin-to-cv": Linkedin,
    "github-to-cv": Github,
    "json-resume-editor": FileJson,
    "cefr-level": Languages,
};

function IconBadge({ Icon }: { Icon: LucideIcon }) {
    return (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-edge bg-surface-2 text-accent">
            <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
    );
}

const linkClass =
    "group flex min-h-14 items-center gap-4 rounded-lg border border-edge bg-surface-1 px-5 py-4 transition-colors hover:border-edge-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** Acquisition links to the free tools and the role examples, so they are one click from the homepage. */
export function FreeToolsSection() {
    const { t, locale } = useTranslation();
    const tools = getEnabledTools();
    const hasExamples = (indexLocales() as string[]).includes(locale);

    return (
        <section className="border-t border-edge px-6 py-20 sm:py-24" data-testid="landing-free-tools">
            <div className="mx-auto max-w-7xl">
                <p className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-accent">
                    {t("landing.freeTools.kicker")}
                </p>
                <h2 className="mt-5 max-w-3xl text-3xl font-black leading-tight tracking-[-0.04em] text-strong sm:text-5xl">
                    {t("landing.freeTools.title")}
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-mid sm:text-lg">
                    {t("landing.freeTools.description")}
                </p>

                <ul className="mt-10 grid gap-3 sm:grid-cols-2">
                    {tools.map((tool) => (
                        <li key={tool.slug}>
                            <IntentPrefetchLink href={localizedPath(toolPath(tool.slug), locale)} className={linkClass}>
                                <IconBadge Icon={TOOL_ICONS[tool.slug]} />
                                <span className="min-w-0 flex-1 text-base font-semibold text-strong">{t(`${tool.keyPrefix}.title`)}</span>
                                <ArrowUpRight className="h-4 w-4 shrink-0 text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                            </IntentPrefetchLink>
                        </li>
                    ))}
                    {hasExamples && (
                        <li className="sm:col-span-2">
                            <IntentPrefetchLink href={roleExamplePath(locale)} className={linkClass}>
                                <IconBadge Icon={FileText} />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-base font-semibold text-strong">{t("landing.freeTools.examplesTitle")}</span>
                                    <span className="mt-1 block text-sm leading-6 text-mid">{t("landing.freeTools.examplesDesc")}</span>
                                </span>
                                <ArrowUpRight className="h-4 w-4 shrink-0 text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                            </IntentPrefetchLink>
                        </li>
                    )}
                </ul>

                <p className="mt-6">
                    <IntentPrefetchLink
                        href={localizedPath(TOOLS_PATH, locale)}
                        className="text-sm font-semibold text-bright underline decoration-edge-strong underline-offset-4 transition-colors hover:text-accent focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        {t("landing.freeTools.allTools")}
                    </IntentPrefetchLink>
                </p>
            </div>
        </section>
    );
}
