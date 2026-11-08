"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatBlogDate } from "@/lib/blog-format";
import { translateBlog } from "@/lib/blog-i18n";
import type { BlogPostMeta } from "@/lib/blog";
import { useTranslation } from "@/lib/i18n";
import { DEFAULT_LOCALE, localizedPath } from "@/lib/i18n/locales";
import { blogIndexPath } from "@/lib/blog-articles";
import { TOOLS_PATH } from "@/lib/tools/registry";

export function BlogIndexContent({ posts, showEnglishLink }: { posts: BlogPostMeta[]; showEnglishLink: boolean }) {
    const { t, locale } = useTranslation();
    const englishLink = showEnglishLink ? (
        <Link
            href={blogIndexPath(DEFAULT_LOCALE)}
            hrefLang="en"
            data-testid="blog-more-english"
            className="inline-flex items-center gap-2 rounded-sm text-sm font-medium text-accent underline underline-offset-4 transition-colors hover:text-accent-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
            {translateBlog(locale, "index.moreEnglish")}
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
    ) : null;

    return (
        <div className="mt-12 max-w-4xl">
            <header className="max-w-3xl border-b border-edge pb-10">
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-faint">
                    {translateBlog(locale, "eyebrow")}
                </p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-strong sm:text-5xl">
                    {translateBlog(locale, "index.title")}
                </h1>
                <p className="mt-4 text-lg leading-8 text-mid">
                    {translateBlog(locale, "index.description")}
                </p>
            </header>

            {posts.length === 0 ? (
                <div className="mt-8 rounded-xl border border-edge bg-surface-4 p-6" data-testid="blog-empty-state">
                    <p className="text-base leading-8 text-mid">{translateBlog(locale, "index.empty")}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                        {englishLink}
                        <Link href={localizedPath(TOOLS_PATH, locale)} className="text-sm font-medium text-accent underline underline-offset-4">
                            {t("footer.tools")}
                        </Link>
                    </div>
                </div>
            ) : null}

            <div className="mt-4 divide-y divide-edge">
                {posts.map((post) => (
                    <article key={post.slug} className="py-8">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-faint">
                            <time dateTime={post.date}>{formatBlogDate(post.date, locale)}</time>
                            <span aria-hidden="true">&bull;</span>
                            <span>{translateBlog(locale, "readingTime", { minutes: post.readingTimeMinutes })}</span>
                            {post.sponsored ? (
                                <>
                                    <span aria-hidden="true">&bull;</span>
                                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
                                        {translateBlog(locale, "sponsored")}
                                    </span>
                                </>
                            ) : null}
                        </div>

                        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-strong">
                            <Link href={post.path} className="transition-colors hover:text-accent">
                                {post.title}
                            </Link>
                        </h2>

                        <p className="mt-3 max-w-3xl text-base leading-8 text-mid">
                            {post.description}
                        </p>

                        {post.tags.length ? (
                            <ul className="mt-4 flex flex-wrap gap-2">
                                {post.tags.map((tag) => (
                                    <li
                                        key={tag}
                                        className="rounded-full border border-edge bg-surface-4 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-mid"
                                    >
                                        {tag}
                                    </li>
                                ))}
                            </ul>
                        ) : null}

                        <div className="mt-5">
                            <Link
                                href={post.path}
                                className="text-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 transition-colors hover:text-accent-soft"
                            >
                                {translateBlog(locale, "readArticle")}
                            </Link>
                        </div>
                    </article>
                ))}
            </div>
            {posts.length > 0 && englishLink ? (
                <div className="mt-8 border-t border-edge pt-6">{englishLink}</div>
            ) : null}
        </div>
    );
}
