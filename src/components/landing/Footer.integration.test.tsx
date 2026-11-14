import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import {
    ENGINECV_GITHUB_PROFILE_URL,
    ENGINECV_PORTFOLIO_URL,
    getGithubSponsorsUrl,
    getKofiUrl,
} from "@/lib/support";
import { RouteLocaleProvider } from "@/lib/i18n/route-locale";
import { Footer } from "./Footer";

vi.mock("next/navigation", () => ({
    usePathname: () => "/",
    useRouter: () => ({ prefetch: vi.fn() }),
}));

describe("Footer repository link", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(() => {
        cleanup();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    it("has no changelog page link and points to the source repository", () => {
        render(<Footer />);

        expect(screen.queryByRole("link", { name: "Changelog" })).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Source code (open source)" })).toHaveAttribute(
            "href",
            "https://github.com/enginecv/enginecv",
        );
    });

    it("links to /about with a translated label", () => {
        const { unmount } = render(<Footer />);
        expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
        unmount();

        useI18nStore.setState({ locale: "de", _hydrated: true });
        render(<Footer />);
        expect(screen.getByRole("link", { name: "Über uns" })).toHaveAttribute("href", "/about");
    });

    it("links to Ko-fi from the support group", () => {
        render(<Footer />);

        expect(screen.getByRole("link", { name: "Support EngineCV on Ko-fi" })).toHaveAttribute(
            "href",
            getKofiUrl("footer"),
        );
        expect(screen.getByRole("link", { name: "Support EngineCV on Ko-fi" })).toHaveAttribute(
            "target",
            "_blank",
        );
    });
});

describe("Footer support icons", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllEnvs();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    it("shows Ko-fi, the GitHub profile and the portfolio next to feedback", () => {
        render(<Footer />);

        const supportLinks = screen.getByRole("navigation", {
            name: "Support and social links",
        });

        expect(supportLinks).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Ko-fi" })).toHaveAttribute(
            "href",
            getKofiUrl("footer-icons"),
        );
        expect(screen.getByRole("link", { name: "GitHub profile" })).toHaveAttribute(
            "href",
            ENGINECV_GITHUB_PROFILE_URL,
        );
        expect(
            screen.getByRole("link", { name: "Portfolio website (safet.click)" }),
        ).toHaveAttribute("href", ENGINECV_PORTFOLIO_URL);

        for (const link of supportLinks.querySelectorAll("a")) {
            expect(link).toHaveAttribute("target", "_blank");
            expect(link).toHaveAttribute("rel", "noreferrer");
        }
    });

    it("hides GitHub Sponsors until the build flag is enabled", () => {
        render(<Footer />);

        expect(
            screen.queryByRole("link", { name: "GitHub Sponsors" }),
        ).not.toBeInTheDocument();

        cleanup();
        vi.stubEnv("NEXT_PUBLIC_GITHUB_SPONSORS_ENABLED", "true");
        render(<Footer />);

        expect(screen.getByRole("link", { name: "GitHub Sponsors" })).toHaveAttribute(
            "href",
            getGithubSponsorsUrl("footer-icons"),
        );
    });

    it("localizes the icon labels", () => {
        useI18nStore.setState({ locale: "bs", _hydrated: true });

        render(<Footer />);

        expect(screen.getByRole("link", { name: "GitHub profil" })).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Portfolio web stranica (safet.click)" }),
        ).toBeInTheDocument();
    });
});

describe("Footer blog link", () => {
    afterEach(cleanup);

    it("links to the blog in the page's language when it has posts", () => {
        render(
            <RouteLocaleProvider locale="de">
                <Footer />
            </RouteLocaleProvider>,
        );

        expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute("href", "/de/blog");
        expect(screen.getByText("Ressourcen")).toBeInTheDocument();
    });

    it("keeps the page language when the blog has no published posts", () => {
        render(
            <RouteLocaleProvider locale="fr">
                <Footer />
            </RouteLocaleProvider>,
        );

        expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute("href", "/fr/blog");
    });
});

describe("Footer CV examples link", () => {
    afterEach(cleanup);

    it("links to the examples index in a language that has one", () => {
        render(
            <RouteLocaleProvider locale="en">
                <Footer />
            </RouteLocaleProvider>,
        );

        expect(screen.getByRole("link", { name: "CV examples" })).toHaveAttribute("href", "/cv-examples");
    });

    it("leaves the link out where the language has no published examples, instead of linking to a 404", () => {
        for (const locale of ["de", "bs", "fr", "es"] as const) {
            const { unmount } = render(
                <RouteLocaleProvider locale={locale}>
                    <Footer />
                </RouteLocaleProvider>,
            );
            expect(document.querySelector('a[href$="/cv-examples"]'), locale).toBeNull();
            unmount();
        }
    });
});
