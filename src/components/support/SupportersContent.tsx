"use client";

import { useTranslation } from "@/lib/i18n";
import { ArrowUpRight, Coffee, Github, Heart } from "lucide-react";
import { Footer } from "@/components/landing/Footer";
import { Navbar } from "@/components/landing/Navbar";
import { CONTACT_EMAILS } from "@/lib/contact";
import { getGithubSponsorsUrl, getKofiUrl, githubSponsorsEnabled } from "@/lib/support";
import { orderedSupporters } from "@/lib/supporters";


export function SupportersContent() {
    const { t } = useTranslation();
    const supporters = orderedSupporters();

    return (
        <div className="min-h-screen bg-surface-2 text-strong">
            <Navbar />
            <main id="main-content" className="px-6 pb-20 pt-24">
                <div className="mx-auto max-w-4xl">
                    <section className="border-b border-edge pb-12 pt-8 sm:pb-16 sm:pt-14">
                        <p className="text-sm font-medium uppercase tracking-[0.24em] text-accent">{t("supporters.title")}</p>
                        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-strong sm:text-6xl">
                            {t("supporters.thanks")}
                        </h1>
                        <p className="mt-5 max-w-3xl text-lg leading-8 text-mid">
                            {t("supporters.intro")}
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <a
                                href={getKofiUrl("supporters")}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-surface-2 transition-colors hover:bg-accent-soft"
                            >
                                <Coffee className="h-4 w-4" aria-hidden="true" />
                                {t("supporters.support")}
                                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                            </a>
                            {githubSponsorsEnabled() && (
                                <a
                                    href={getGithubSponsorsUrl("supporters")}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 rounded-lg border border-edge px-5 py-3 text-sm font-semibold text-bright transition-colors hover:border-faint hover:text-strong"
                                >
                                    <Github className="h-4 w-4" aria-hidden="true" />
                                    {t("landing.support.githubSponsors")}
                                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                                </a>
                            )}
                        </div>
                    </section>

                    <section className="py-12" aria-labelledby="supporters-list-heading">
                        <h2 id="supporters-list-heading" className="text-2xl font-semibold tracking-tight text-strong">
                            {t("supporters.title")}
                        </h2>
                        {supporters.length === 0 ? (
                            <p className="mt-5 rounded-lg border border-edge bg-surface-3 p-6 text-sm leading-7 text-mid">
                                {t("supporters.empty")}
                            </p>
                        ) : (
                            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                                {supporters.map((supporter) => (
                                    <li
                                        key={supporter.name}
                                        className="flex items-center gap-3 rounded-lg border border-edge bg-surface-3 px-4 py-3"
                                    >
                                        <Heart className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                                        {supporter.url ? (
                                            <a
                                                href={supporter.url}
                                                target="_blank"
                                                rel="noreferrer nofollow"
                                                className="font-semibold text-strong underline decoration-edge-strong underline-offset-4 hover:text-accent"
                                            >
                                                {supporter.name}
                                            </a>
                                        ) : (
                                            <span className="font-semibold text-strong">{supporter.name}</span>
                                        )}
                                        {supporter.monthly && <span className="ml-auto text-xs text-faint">{t("supporters.monthly")}</span>}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="mt-6 text-sm leading-6 text-faint">
                            {t("supporters.permission")}{" "}
                            <a href={`mailto:${CONTACT_EMAILS.support}`} className="underline underline-offset-4 hover:text-strong">
                                {CONTACT_EMAILS.support}
                            </a>
                            .
                        </p>
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    );
}
