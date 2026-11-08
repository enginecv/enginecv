"use client";

import { Coffee, Github, Globe, Heart, Bug, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
        ENGINECV_GITHUB_PROFILE_URL,
        ENGINECV_PORTFOLIO_URL,
        getGithubSponsorsUrl,
        getKofiUrl,
        githubSponsorsEnabled,
} from "@/lib/support";

type FooterSupportLink = {
        id: string;
        href: string;
        /** Translation key used for both the accessible name and the tooltip. */
        labelKey: string;
        Icon: LucideIcon;
        /** Optional gate for destinations that are not live yet. */
        enabled?: () => boolean;
};

/**
 * Icon links shown next to "Send feedback" in the footer. To add another
 * destination, append an entry here: the renderer takes care of the icon
 * button, external-link attributes and the accessible label.
 */
const FOOTER_SUPPORT_LINKS: FooterSupportLink[] = [
        {
                id: "kofi",
                href: getKofiUrl("footer-icons"),
                labelKey: "footer.support.kofi",
                Icon: Coffee,
        },
        {
                id: "github-sponsors",
                href: getGithubSponsorsUrl("footer-icons"),
                labelKey: "footer.support.githubSponsors",
                Icon: Heart,
                enabled: githubSponsorsEnabled,
        },
        {
                id: "github",
                href: ENGINECV_GITHUB_PROFILE_URL,
                labelKey: "footer.support.github",
                Icon: Github,
        },
        {
                id: "portfolio",
                href: ENGINECV_PORTFOLIO_URL,
                labelKey: "footer.support.portfolio",
                Icon: Globe,
        },
        {
                id: "report-bug",
                href: ENGINECV_PORTFOLIO_URL,
                labelKey: "footer.support.portfolio",
                Icon: Bug,
        },
];

const linkClass =
        "inline-flex h-9 w-9 items-center justify-center rounded-xl text-faint transition-colors hover:bg-edge hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1";

export function FooterSupportLinks() {
        const { t } = useTranslation();

        return (
                <nav aria-label={t("footer.support.links")} className="flex items-center gap-1">
                        {FOOTER_SUPPORT_LINKS.filter((link) => !link.enabled || link.enabled()).map(
                                ({ id, href, labelKey, Icon }) => {
                                        const label = t(labelKey);

                                        return (
                                                <a
                                                        key={id}
                                                        href={href}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        aria-label={label}
                                                        title={label}
                                                        className={linkClass}
                                                >
                                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                                </a>
                                        );
                                },
                        )}
                </nav>
        );
}
