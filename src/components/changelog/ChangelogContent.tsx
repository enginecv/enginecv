"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { Changelog, ChangelogSection } from "@/lib/changelog/parse";
import { useTranslation, type Locale } from "@/lib/i18n";

const INLINE_ELEMENTS = ["p", "a", "code", "em", "strong", "del"];

function formatSectionDate(date: string, locale: Locale): string {
    const [year, month, day] = date.split("-").map(Number);

    return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
}

function EntryMarkdown({ markdown }: { markdown: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            allowedElements={INLINE_ELEMENTS}
            unwrapDisallowed
            components={{
                p: ({ children }) => <>{children}</>,
                a: ({ href, children }) => (
                    <a
                        href={href}
                        className="text-accent underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent"
                        target={href?.startsWith("http") ? "_blank" : undefined}
                        rel={href?.startsWith("http") ? "noreferrer" : undefined}
                    >
                        {children}
                    </a>
                ),
                code: ({ children }) => (
                    <code className="rounded bg-surface-3 px-1.5 py-0.5 text-[0.85em] text-bright">
                        {children}
                    </code>
                ),
            }}
        >
            {markdown}
        </ReactMarkdown>
    );
}

function ChangelogSectionBlock({
    section,
    heading,
}: {
    section: ChangelogSection;
    heading: string;
}) {
    return (
        <section id={section.slug} className="scroll-mt-28 border-b border-edge pb-10">
            <h2 className="text-2xl font-semibold tracking-tight text-strong">
                <Link
                    href={`#${section.slug}`}
                    className="transition-colors hover:text-accent"
                >
                    {heading}
                </Link>
            </h2>

            <div className="mt-6 space-y-8">
                {section.groups.map((group, groupIndex) => (
                    <div key={`${section.slug}-${group.category}-${groupIndex}`}>
                        <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-dim">
                            {group.category}
                        </h3>
                        <ul className="mt-4 space-y-3">
                            {group.entries.map((entry, entryIndex) => (
                                <li
                                    key={`${section.slug}-${group.category}-${entryIndex}`}
                                    className="flex gap-3 break-words text-base leading-8 text-bright"
                                >
                                    <span
                                        aria-hidden
                                        className="mt-3.5 h-1 w-1 shrink-0 rounded-full bg-accent"
                                    />
                                    <span className="min-w-0 break-words">
                                        <EntryMarkdown markdown={entry.markdown} />
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    );
}

export function ChangelogContent({
    changelog,
    showUnreleased,
}: {
    changelog: Changelog;
    showUnreleased: boolean;
}) {
    const { t, locale } = useTranslation();

    return (
        <main className="px-6 pb-20 pt-28">
            <div className="mx-auto max-w-4xl">
                <header className="border-b border-edge pb-8">
                    <p className="text-sm font-medium uppercase tracking-[0.24em] text-faint">
                        EngineCV
                    </p>
                    <h1 className="mt-4 text-4xl font-semibold tracking-tight text-strong sm:text-5xl">
                        {t("changelog.title")}
                    </h1>
                    <p className="mt-4 max-w-3xl text-lg leading-8 text-mid">
                        {t("changelog.subtitle")}
                    </p>
                </header>

                <div className="mt-10 space-y-10">
                    {showUnreleased && changelog.unreleased && (
                        <ChangelogSectionBlock
                            section={changelog.unreleased}
                            heading="Unreleased"
                        />
                    )}

                    {changelog.sections.map((section) => (
                        <ChangelogSectionBlock
                            key={section.slug}
                            section={section}
                            heading={formatSectionDate(section.date, locale)}
                        />
                    ))}
                </div>
            </div>
        </main>
    );
}
