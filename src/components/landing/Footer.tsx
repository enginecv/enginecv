"use client";

import Image from "next/image";
import Link from "next/link";
import { IntentPrefetchLink } from "@/components/ui/IntentPrefetchLink";
import { usePathname } from "next/navigation";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { FooterSupportLinks } from "@/components/landing/FooterSupportLinks";
import { CONTACT_EMAILS, FEEDBACK_REPO_URL } from "@/lib/contact";
import { useTranslation } from "@/lib/i18n";
import { APP_VERSION } from "@/lib/app-version";
import { getKofiUrl } from "@/lib/support";
import { isLegalNoticeReady } from "@/lib/legal-operator";
import { localizedPath } from "@/lib/i18n/locales";
import { roleExamplePath, indexLocales } from "@/lib/role-examples/rules";
import { GALLERY_PATH } from "@/lib/templates/gallery";
import { TOOLS_PATH } from "@/lib/tools/registry";
import { RESOURCES_PATH } from "@/lib/resources";
import { blogIndexPath } from "@/lib/blog-articles";

export function Footer() {
        const { t, locale } = useTranslation();
        const pathname = usePathname();
        const homeHref = localizedPath("/", locale);

        const resolveHref = (href: string) => {
                if (href.startsWith("#") && pathname !== homeHref) {
                        return `${homeHref}${href}`;
                }

                return href;
        };


        const linkGroups = [
                {
                        title: t("footer.group.product"),
                        links: [
                                { label: t("nav.startBuilding"), href: "/dashboard" },
                                { label: t("footer.templates"), href: localizedPath(GALLERY_PATH, locale) },
                                ...((indexLocales() as string[]).includes(locale) ? [{ label: t("footer.examples"), href: roleExamplePath(locale) }] : []),
                                { label: t("footer.features"), href: "#features" },
                                { label: t("howItWorks.title"), href: "#how-it-works" },
                        ],
                },
                {
                        title: t("footer.group.resources"),
                        links: [
                                { label: t("footer.blog"), href: blogIndexPath(locale) },
                                { label: t("footer.tools"), href: localizedPath(TOOLS_PATH, locale) },
                                { label: t("footer.resourcesPage"), href: localizedPath(RESOURCES_PATH, locale) },
                                { label: t("footer.about"), href: "/about" },
                                { label: t("footer.changelog"), href: "/changelog" },
                                { label: t("footer.faq"), href: "#faq" },
                        ],
                },
                {
                        title: t("footer.group.legal"),
                        links: [
                                { label: t("footer.privacy"), href: "/privacy" },
                                { label: t("footer.terms"), href: "/terms" },
                                { label: t("footer.cookies"), href: "/cookies" },
                                { label: t("footer.yourData"), href: "/your-data" },
                                { label: t("footer.accessibility"), href: "/accessibility" },
                                ...(isLegalNoticeReady() ? [{ label: t("footer.impressum"), href: "/impressum" }] : []),
                        ],
                },
                {
                        title: t("footer.group.support"),
                        links: [
                                { label: t("footer.contact"), href: "/contact" },
                                { label: CONTACT_EMAILS.support, href: `mailto:${CONTACT_EMAILS.support}` },
                                {
                                        label: `${CONTACT_EMAILS.founder} (${t("contact.founder")})`,
                                        href: `mailto:${CONTACT_EMAILS.founder}`,
                                },
                                { label: t("footer.feedbackGithub"), href: FEEDBACK_REPO_URL },
                                { label: t("landing.support.cta"), href: getKofiUrl("footer") },
                                { label: t("supporters.title"), href: "/supporters" },
                        ],
                },
        ];

        const linkClass = "text-sm text-mid transition-colors hover:text-strong";

        return (
                <footer className="border-t border-edge bg-surface-1 px-6 py-16">
                        <div className="mx-auto max-w-7xl">
                                <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)] lg:gap-14">
                                        <div className="max-w-sm">
                                                <Link
                                                        href={homeHref}
                                                        className="flex items-center gap-3"
                                                        aria-label="EngineCV"
                                                >
                                                        <Image
                                                                src="/logo.svg"
                                                                alt="EngineCV"
                                                                width={800}
                                                                height={600}
                                                                style={{ width: "auto" }}
                                                                className="h-10 logo-adaptive"
                                                        />
                                                        <div>
                                                                <span className="text-lg font-semibold tracking-tight text-strong">
                                                                        EngineCV
                                                                </span>
                                                                <p className="text-sm text-dim">
                                                                        {t("landing.footer.tagline")}
                                                                </p>
                                                        </div>
                                                </Link>

                                                <p className="mt-6 text-sm leading-7 text-mid">
                                                        {t("footer.dataLocal")}
                                                </p>
                                        </div>

                                        <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 lg:content-start">
                                                {linkGroups.map((group) => (
                                                        <div key={group.title}>
                                                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-strong">
                                                                        {group.title}
                                                                </p>
                                                                <div className="mt-5 flex flex-col gap-3">
                                                                        {group.links.map((link) => {
                                                                                const resolvedHref = resolveHref(
                                                                                        link.href,
                                                                                );
                                                                                // /go/* are counted outbound redirects: a plain <a> so Next never prefetches (and counts) them.
                                                                                const opensNewTab =
                                                                                        resolvedHref.startsWith(
                                                                                                "http",
                                                                                        ) ||
                                                                                        resolvedHref.startsWith("/go/");

                                                                                return resolvedHref.startsWith("/") &&
                                                                                        !opensNewTab ? (
                                                                                        <IntentPrefetchLink
                                                                                                key={`${group.title}-${link.href}`}
                                                                                                href={resolvedHref}
                                                                                                className={linkClass}
                                                                                        >
                                                                                                {link.label}
                                                                                        </IntentPrefetchLink>
                                                                                ) : (
                                                                                        <a
                                                                                                key={`${group.title}-${link.href}`}
                                                                                                href={resolvedHref}
                                                                                                target={
                                                                                                        opensNewTab
                                                                                                                ? "_blank"
                                                                                                                : undefined
                                                                                                }
                                                                                                rel={
                                                                                                        opensNewTab
                                                                                                                ? "noreferrer"
                                                                                                                : undefined
                                                                                                }
                                                                                                className={linkClass}
                                                                                        >
                                                                                                {link.label}
                                                                                        </a>
                                                                                );
                                                                        })}
                                                                </div>
                                                        </div>
                                                ))}
                                        </div>
                                </div>

                                <div className="mt-14 flex flex-col gap-4 border-t border-edge pt-6 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-xs text-faint">
                                                &copy; {new Date().getFullYear()} EngineCV.
                                                <span className="ml-2 text-faint">v{APP_VERSION}</span>
                                        </p>
                                        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                                                {/* <FeedbackButton variant="link" /> */}
                                                <FooterSupportLinks />
                                                <span className="inline-flex items-center gap-2 rounded-full border border-success-tint2 bg-success-tint px-3 py-1.5 text-xs text-faint">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                                        {t("footer.allSystems")}
                                                </span>
                                        </div>
                                </div>
                        </div>
                </footer>
        );
}
