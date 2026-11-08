import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { PREFIXED_LOCALES } from "@/lib/i18n/locales";
import { RouteLocaleProvider } from "@/lib/i18n/route-locale";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/" } }));

vi.mock("next/navigation", () => ({
    usePathname: () => pathname.current,
    useRouter: () => ({ prefetch: vi.fn() }),
}));

describe("localized site navigation", () => {
    beforeEach(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    afterEach(cleanup);

    it.each(PREFIXED_LOCALES)("keeps %s in blog, logo and section links", (locale) => {
        pathname.current = `/${locale}/tools/cefr-level`;
        const { container } = render(
            <RouteLocaleProvider locale={locale}>
                <Navbar />
                <Footer />
            </RouteLocaleProvider>,
        );

        for (const link of screen.getAllByRole("link", { name: "EngineCV", exact: true })) {
            expect(link).toHaveAttribute("href", `/${locale}`);
        }
        expect(container.querySelectorAll(`a[href="/${locale}/blog"]`)).toHaveLength(2);
        expect(container.querySelectorAll('a[href="/blog"]')).toHaveLength(0);
        expect(container.querySelector(`a[href="/${locale}#features"]`)).toBeInTheDocument();
        expect(container.querySelector(`a[href="/${locale}#faq"]`)).toBeInTheDocument();
        expect(container.querySelector(`a[href="/${locale}#how-it-works"]`)).toBeInTheDocument();
        expect(container.querySelector('a[href="/#faq"]')).not.toBeInTheDocument();
    });

    it("keeps section links on the current localized landing page", () => {
        pathname.current = "/bs";
        const { container } = render(<RouteLocaleProvider locale="bs"><Navbar /><Footer /></RouteLocaleProvider>);
        expect(container.querySelector('a[href="#faq"]')).toBeInTheDocument();
        expect(container.querySelector('a[href="/#faq"]')).not.toBeInTheDocument();
    });

    it("uses the stored language when returning from a shared page", () => {
        pathname.current = "/contact";
        useI18nStore.setState({ locale: "bs", _hydrated: true });
        const { container } = render(<><Navbar /><Footer /></>);
        expect(container.querySelector('a[aria-label="EngineCV"]')).toHaveAttribute("href", "/bs");
        expect(container.querySelector('a[href="/bs/blog"]')).toBeInTheDocument();
        expect(container.querySelector('a[href="/bs#faq"]')).toBeInTheDocument();
    });
});
