"use client";

import { useTranslation } from "@/lib/i18n";

/**
 * First focusable element on every page (WCAG 2.4.1 Bypass Blocks). Hidden
 * until focused. Targets `#main-content`, falling back to the page's first
 * `<main>` landmark, and moves focus there so the next Tab continues inside it.
 */
export function SkipLink() {
    const { t } = useTranslation();

    return (
        <a
            href="#main-content"
            data-testid="skip-link"
            onClick={(event) => {
                const target = document.getElementById("main-content") ?? document.querySelector<HTMLElement>("main");
                if (!target) return;
                event.preventDefault();
                if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
                target.focus();
                target.scrollIntoView({ block: "start" });
            }}
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[300] focus:rounded-lg focus:border focus:border-edge focus:bg-surface-4 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-strong focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-accent"
        >
            {t("a11y.skipToContent")}
        </a>
    );
}
