"use client";

import { useEffect, useState } from "react";
import type { BlogTocItem } from "@/lib/blog";
import { translateBlog } from "@/lib/blog-i18n";
import { useTranslation } from "@/lib/i18n";

function getItemId(url: string) {
    return url.startsWith("#") ? url.slice(1) : url;
}

function depthPadding(depth: number) {
    if (depth <= 2) return "ps-3";
    if (depth === 3) return "ps-6";
    return "ps-8";
}

export function PostTableOfContents({ items }: { items: BlogTocItem[] }) {
    const { locale } = useTranslation();
    const [activeId, setActiveId] = useState<string | null>(null);

    useEffect(() => {
        if (items.length === 0 || typeof window === "undefined") {
            return;
        }

        const ids = items.map((item) => getItemId(item.url)).filter(Boolean);
        if (ids.length === 0) {
            return;
        }

        const elements = ids
            .map((id) => document.getElementById(id))
            .filter((element): element is HTMLElement => element !== null);

        if (elements.length === 0) {
            return;
        }

        const visibleIds = new Set<string>();

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        visibleIds.add(entry.target.id);
                    } else {
                        visibleIds.delete(entry.target.id);
                    }
                });

                const firstVisible = ids.find((id) => visibleIds.has(id));
                if (firstVisible) {
                    setActiveId(firstVisible);
                }
            },
            { rootMargin: "0px 0px -70% 0px", threshold: 0 }
        );

        elements.forEach((element) => observer.observe(element));
        return () => observer.disconnect();
    }, [items]);

    if (items.length === 0) {
        return null;
    }

    return (
        <section className="rounded-2xl bg-surface-2 p-5">
            <h3 className="mb-3 text-sm font-medium text-dim">
                {translateBlog(locale, "toc")}
            </h3>
            <nav>
                <ul className="flex flex-col border-s border-edge">
                    {items.map((item) => {
                        const id = getItemId(item.url);
                        const isActive = activeId === id;
                        return (
                            <li key={item.url}>
                                <a
                                    href={item.url}
                                    data-active={isActive ? "true" : undefined}
                                    className={`block py-1.5 text-sm transition-colors ${depthPadding(item.depth)} ${isActive ? "text-accent" : "text-mid hover:text-strong"}`}
                                >
                                    {item.title}
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </nav>
        </section>
    );
}
