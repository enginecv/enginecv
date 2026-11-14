"use client";

import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import {
    BriefcaseBusiness,
    Clock3,
    Github,
    LifeBuoy,
    Mail,
    MessageSquareText,
    UserRound,
} from "lucide-react";
import { Footer } from "@/components/landing/Footer";
import { Navbar } from "@/components/landing/Navbar";
import { CONTACT_EMAILS, FEEDBACK_ISSUES_URL, FEEDBACK_REPO_URL } from "@/lib/contact";


const mailto = (address: string, subject: string) =>
    `mailto:${address}?subject=${encodeURIComponent(subject)}`;

const inboxes = [
    {
        title: "contact.general",
        address: CONTACT_EMAILS.hello,
        description: "contact.generalDesc",
        subject: "EngineCV question",
        icon: Mail,
    },
    {
        title: "contact.support",
        address: CONTACT_EMAILS.support,
        description: "contact.supportDesc",
        subject: "EngineCV support request",
        icon: LifeBuoy,
    },
    {
        title: "contact.founder",
        address: CONTACT_EMAILS.founder,
        description: "contact.founderDesc",
        subject: "EngineCV founder note",
        icon: UserRound,
    },
    {
        title: "contact.jobs",
        address: CONTACT_EMAILS.jobs,
        description: "contact.jobsDesc",
        subject: "EngineCV jobs and collaboration",
        icon: BriefcaseBusiness,
    },
] as const;

const expectations = ["contact.responseTime", "contact.publicReports", "contact.privateData", "contact.partnershipTime"] as const;

export function ContactContent() {
    const { t } = useTranslation();
    return (
        <div className="min-h-screen bg-surface-2 text-strong">
            <Navbar />
            <main id="main-content" className="px-6 pb-20 pt-24">
                <div className="mx-auto max-w-7xl">
                    <section className="border-b border-edge pb-12 pt-8 sm:pb-16 sm:pt-14">
                        <p className="text-sm font-medium uppercase tracking-[0.24em] text-accent">
                            {t("footer.contact")}
                        </p>
                        <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.72fr)] lg:items-end">
                            <div>
                                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-strong sm:text-6xl">
                                    {t("contact.title")}
                                </h1>
                                <p className="mt-5 max-w-3xl text-lg leading-8 text-mid">
                                    {t("contact.intro")}
                                </p>
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                                <a
                                    href={mailto(CONTACT_EMAILS.support, "EngineCV support request")}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-surface-2 transition-colors hover:bg-accent-soft"
                                >
                                    <Mail className="h-4 w-4" />
                                    {t("contact.emailSupport")}
                                </a>
                                <a
                                    href={FEEDBACK_ISSUES_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-edge px-5 py-3 text-sm font-semibold text-strong transition-colors hover:border-accent hover:text-accent"
                                >
                                    <Github className="h-4 w-4" />
                                    {t("contact.githubIssues")}
                                </a>
                            </div>
                        </div>
                    </section>

                    <section className="grid gap-4 py-12 md:grid-cols-2 xl:grid-cols-4">
                        {inboxes.map(({ title, address, description, subject, icon: Icon }) => (
                            <a
                                key={address}
                                href={mailto(address, subject)}
                                className="group rounded-lg border border-edge bg-surface-3 p-5 transition-colors hover:border-accent"
                            >
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-edge bg-surface-4 text-accent">
                                    <Icon className="h-5 w-5" />
                                </span>
                                <h2 className="mt-5 text-lg font-semibold text-strong">{t(title)}</h2>
                                <p className="mt-2 break-all font-mono text-sm text-accent">{address}</p>
                                <p className="mt-4 text-sm leading-6 text-mid">{t(description)}</p>
                            </a>
                        ))}
                    </section>

                    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.68fr)]">
                        <div className="rounded-lg border border-edge bg-surface-3 p-6 sm:p-8">
                            <div className="flex items-center gap-3">
                                <Clock3 className="h-5 w-5 text-accent" />
                                <h2 className="text-2xl font-semibold tracking-tight text-strong">
                                    {t("contact.expectations")}
                                </h2>
                            </div>
                            <ul className="mt-6 space-y-4 text-sm leading-7 text-bright">
                                {expectations.map((item) => (
                                    <li key={item} className="flex gap-3">
                                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                                        <span>{t(item)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="rounded-lg border border-edge bg-surface-1 p-6 sm:p-8">
                            <div className="flex items-center gap-3">
                                <MessageSquareText className="h-5 w-5 text-accent" />
                                <h2 className="text-2xl font-semibold tracking-tight text-strong">
                                    {t("contact.feedbackRepo")}
                                </h2>
                            </div>
                            <p className="mt-5 text-sm leading-7 text-mid">
                                {t("contact.feedbackDesc")}
                            </p>
                            <div className="mt-6 flex flex-col gap-3">
                                <a
                                    href={FEEDBACK_REPO_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-edge px-4 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-accent hover:text-accent"
                                >
                                    <Github className="h-4 w-4" />
                                    {t("contact.viewRepo")}
                                </a>
                                <Link
                                    href="/privacy"
                                    className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-mid transition-colors hover:text-strong"
                                >
                                    {t("contact.privacy")}
                                </Link>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    );
}
