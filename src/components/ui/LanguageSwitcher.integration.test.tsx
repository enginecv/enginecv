import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { LanguageLinksProvider, RouteLocaleProvider } from "@/lib/i18n/route-locale";
import { LanguageSwitcher } from "./LanguageSwitcher";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/de/blog/sprachniveau-im-lebenslauf-angeben" } }));

vi.mock("next/navigation", () => ({
    usePathname: () => pathname.current,
}));

function openMenu() {
    fireEvent.click(screen.getByRole("button"));
}

describe("LanguageSwitcher on locale URLs", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(cleanup);

    it("follows the links a page provides, so a blog post keeps the reader on the same article", () => {
        render(
            <RouteLocaleProvider locale="de">
                <LanguageLinksProvider
                    links={{
                        en: "/blog/cefr-language-levels-on-your-cv",
                        de: "/de/blog/sprachniveau-im-lebenslauf-angeben",
                        bs: "/bs/blog/nivo-jezika-u-cv-u",
                        fr: "/fr",
                        es: "/es",
                    }}
                >
                    <LanguageSwitcher />
                </LanguageLinksProvider>
            </RouteLocaleProvider>,
        );
        openMenu();

        expect(screen.getByRole("link", { name: "Bosanski" })).toHaveAttribute("href", "/bs/blog/nivo-jezika-u-cv-u");
        expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", "/blog/cefr-language-levels-on-your-cv");
        expect(screen.getByRole("link", { name: "Français" })).toHaveAttribute("href", "/fr");
    });

    it("swaps the prefix when the page provides no links", () => {
        pathname.current = "/de/tools/cefr-level";
        render(
            <RouteLocaleProvider locale="de">
                <LanguageSwitcher />
            </RouteLocaleProvider>,
        );
        openMenu();

        expect(screen.getByRole("link", { name: "Bosanski" })).toHaveAttribute("href", "/bs/tools/cefr-level");
        expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", "/tools/cefr-level");
    });
});
