"use client";

import { AppEntryLink } from "@/components/ui/AppEntryLink";
import { translateBlog } from "@/lib/blog-i18n";
import { useTranslation } from "@/lib/i18n";

interface CTAProps {
    variant?: "inline" | "end";
}

export function CTA({ variant = "end" }: CTAProps) {
    const { locale } = useTranslation();
    const compact = variant === "inline";

    return (
        <section
            className={`rounded-2xl border border-edge bg-surface-4 ${
                compact ? "my-8 px-5 py-5" : "mt-12 px-6 py-7 sm:px-8"
            }`}
        >
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.24em] text-faint">
                {translateBlog(locale, "cta.eyebrow")}
            </p>
            <h2 className={`mt-3 font-semibold tracking-tight text-strong ${compact ? "text-xl" : "text-2xl"}`}>
                {translateBlog(locale, "cta.title")}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-mid sm:text-base">
                {translateBlog(locale, "cta.description")}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
                <AppEntryLink
                    href="/dashboard"
                    className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-soft"
                >
                    {translateBlog(locale, "cta.button")}
                </AppEntryLink>
                <span className="text-sm text-faint">{translateBlog(locale, "cta.note")}</span>
            </div>
        </section>
    );
}
