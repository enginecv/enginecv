"use client";

import Link from "next/link";
import { PostInlineTableOfContents } from "@/components/blog/PostInlineTableOfContents";
import { authorRole } from "@/lib/blog-authors";
import { formatBlogDate } from "@/lib/blog-format";
import { translateBlog } from "@/lib/blog-i18n";
import type { BlogPostMeta } from "@/lib/blog";
import { useTranslation } from "@/lib/i18n";

/** `indexHref`: the blog index for this post's language, or the English one when it has none. */
export function PostHeader({ post, indexHref }: { post: BlogPostMeta; indexHref: string }) {
    const { locale } = useTranslation();
    const initials = post.author.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2);

    return (
        <header className="border-b border-edge pb-10">
            <div className="flex flex-wrap items-center gap-3 text-sm text-faint">
                <Link href={indexHref} className="transition-colors hover:text-strong">
                    {translateBlog(locale, "breadcrumb")}
                </Link>
                <span aria-hidden="true">/</span>
                {post.sponsored ? (
                    <span className="rounded-full border border-edge bg-surface-4 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.18em] text-accent">
                        {translateBlog(locale, "sponsored")}
                    </span>
                ) : null}
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-strong sm:text-5xl">
                {post.title}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-dim">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-4 text-xs font-semibold uppercase tracking-[0.18em] text-strong">
                    {initials}
                </div>
                <div className="min-w-0">
                    <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-faint">
                        {translateBlog(locale, "author")}
                    </p>
                    <p className="font-medium text-bright">{post.author.name}</p>
                    <p>{authorRole(post.author, locale)}</p>
                </div>
                <span aria-hidden="true" className="text-edge-strong">&bull;</span>
                <span>{formatBlogDate(post.date, locale)}</span>
                {post.updated && post.updated !== post.date ? (
                    <>
                        <span aria-hidden="true" className="text-edge-strong">&bull;</span>
                        <span>{translateBlog(locale, "updated", { date: formatBlogDate(post.updated, locale) })}</span>
                    </>
                ) : null}
                <span aria-hidden="true" className="text-edge-strong">&bull;</span>
                <span>{translateBlog(locale, "readingTime", { minutes: post.readingTimeMinutes })}</span>
            </div>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-mid">
                {post.description}
            </p>

            {post.sponsored ? (
                <p className="mt-6 max-w-3xl text-sm leading-6 text-dim">
                    {translateBlog(locale, "sponsoredDisclosure")}
                </p>
            ) : null}

            <PostInlineTableOfContents items={post.toc} />
        </header>
    );
}
