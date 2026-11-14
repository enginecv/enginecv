"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import type { ReactNode } from "react";
import { Footer } from "@/components/landing/Footer";
import { Navbar } from "@/components/landing/Navbar";

const LAST_UPDATED = new Date("2026-10-25T12:00:00Z");

export function LegalPage({
    eyebrow,
    title,
    description,
    children,
}: {
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
}) {
    const { t, locale } = useTranslation();
    return (
        <div className="min-h-screen bg-surface-2 text-strong">
            <Navbar />
            <main id="main-content" className="px-6 pb-20 pt-28">
                <div className="mx-auto max-w-4xl">
                    <header className="border-b border-edge pb-8">
                        <p className="text-sm font-medium uppercase tracking-[0.24em] text-faint">
                            {eyebrow}
                        </p>
                        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-strong sm:text-5xl">
                            {title}
                        </h1>
                        <p className="mt-4 max-w-3xl text-lg leading-8 text-mid">
                            {description}
                        </p>
                        <p className="mt-5 text-sm text-faint">
                            {t("legal.lastUpdated", { date: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(LAST_UPDATED) })}
                        </p>
                        <div className="mt-6 flex flex-wrap gap-3 text-sm">
                            <Link href="/privacy" className="rounded-full border border-edge px-4 py-2 text-bright transition-colors hover:border-faint hover:text-strong">
                                {t("footer.privacy")}
                            </Link>
                            <Link href="/terms" className="rounded-full border border-edge px-4 py-2 text-bright transition-colors hover:border-faint hover:text-strong">
                                {t("footer.terms")}
                            </Link>
                            <Link href="/cookies" className="rounded-full border border-edge px-4 py-2 text-bright transition-colors hover:border-faint hover:text-strong">
                                {t("footer.cookies")}
                            </Link>
                            <Link href="/accessibility" className="rounded-full border border-edge px-4 py-2 text-bright transition-colors hover:border-faint hover:text-strong">
                                {t("footer.accessibility")}
                            </Link>
                        </div>
                    </header>

                    <article className="mt-10 space-y-10 text-bright">
                        {children}
                    </article>
                </div>
            </main>
            <Footer />
        </div>
    );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight text-strong">{title}</h2>
            <div className="space-y-4 text-base leading-8">
                {children}
            </div>
        </section>
    );
}
