"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { BlogTocItem } from "@/lib/blog";
import { translateBlog } from "@/lib/blog-i18n";
import { useTranslation } from "@/lib/i18n";
import styles from "./PostInlineTableOfContents.module.css";

function getItemId(url: string) {
    return url.startsWith("#") ? url.slice(1) : url;
}

function depthPadding(depth: number) {
    if (depth <= 2) return "pl-4";
    if (depth === 3) return "pl-7";
    return "pl-9";
}

export function PostInlineTableOfContents({ items }: { items: BlogTocItem[] }) {
    const { locale } = useTranslation();
    const [open, setOpen] = useState(false);

    if (items.length === 0) {
        return null;
    }

    const title = translateBlog(locale, "toc");

    return (
        <section
            className={`${styles.mobileOnly} mt-6 rounded-2xl border border-edge bg-surface-2 text-bright`}
            aria-label={title}
        >
            <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-bright transition-colors hover:text-strong"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
            >
                <span>{title}</span>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
                    aria-hidden="true"
                />
            </button>

            {open ? (
                <nav className="border-t border-edge px-4 py-3">
                    <ul className="flex flex-col border-l border-edge">
                        {items.map((item) => (
                            <li key={item.url}>
                                <a
                                    href={item.url}
                                    className={`block py-1.5 text-sm text-mid transition-colors hover:text-strong ${depthPadding(item.depth)}`}
                                    onClick={() => setOpen(false)}
                                >
                                    {item.title || getItemId(item.url)}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
            ) : null}
        </section>
    );
}
