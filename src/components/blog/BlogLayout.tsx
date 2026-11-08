"use client";

import { useTranslation } from "@/lib/i18n";
import type { ReactNode } from "react";
import { Footer } from "@/components/landing/Footer";
import { Navbar } from "@/components/landing/Navbar";

interface BlogLayoutProps {
    children: ReactNode;
    title?: string;
    description?: string;
}

export function BlogLayout({ children, title, description }: BlogLayoutProps) {
    const { t } = useTranslation();
    return (
        <div className="flex min-h-screen flex-col bg-surface-2 text-strong">
            <Navbar />
            <main className="flex-1 px-6 pb-20 pt-28">
                <div className="mx-auto max-w-6xl">
                    {title || description ? (
                        <header className="max-w-3xl border-b border-edge pb-10">
                            <p className="text-sm font-medium uppercase tracking-[0.24em] text-faint">
                                EngineCV {t("footer.blog")}
                            </p>
                            {title ? (
                                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-strong sm:text-5xl">
                                    {title}
                                </h1>
                            ) : null}
                            {description ? (
                                <p className="mt-4 text-lg leading-8 text-mid">
                                    {description}
                                </p>
                            ) : null}
                        </header>
                    ) : null}

                    {children}
                </div>
            </main>
            <Footer />
        </div>
    );
}
