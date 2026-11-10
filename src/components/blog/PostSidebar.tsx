"use client";

import { AdSlot } from "@/components/blog/AdSlot";
import { PostTableOfContents } from "@/components/blog/PostTableOfContents";
import type { BlogPostMeta } from "@/lib/blog";
import { translateBlog } from "@/lib/blog-i18n";
import { useTranslation } from "@/lib/i18n";
import styles from "./PostSidebar.module.css";

export function PostSidebar({ post }: { post: Pick<BlogPostMeta, "toc" | "adSlots"> }) {
    const { locale } = useTranslation();

    return (
        <aside className={styles.sidebar}>
            <div className="space-y-5 md:max-h-[calc(100svh-7rem)] md:overflow-y-auto md:pr-1">
                <PostTableOfContents items={post.toc} />
                {post.adSlots.includes("sidebar-square") ? (
                    <section className="rounded-2xl bg-surface-4 p-5">
                        <p className="text-[0.7rem] font-medium uppercase tracking-[0.24em] text-faint">
                            {translateBlog(locale, "sidebar.sponsoredSpace")}
                        </p>
                        <div className="mt-4">
                            <AdSlot slot="sidebar-square" />
                        </div>
                    </section>
                ) : null}
            </div>
        </aside>
    );
}
