import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore, useTranslation } from "@/lib/i18n";
import { RouteLocaleProvider } from "@/lib/i18n/route-locale";
import { DocumentLanguage } from "./DocumentLanguage";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/blog" } }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

function TranslationConsumer() {
    const { locale } = useTranslation();
    return <span>{locale}</span>;
}

describe("document language ownership", () => {
    beforeEach(() => {
        pathname.current = "/blog";
        useI18nStore.setState({ locale: "bs", _hydrated: true });
    });
    afterEach(cleanup);

    it("keeps an English blog document English despite shared controls using the saved language", () => {
        render(<>
            <DocumentLanguage />
            <RouteLocaleProvider locale="en"><TranslationConsumer /></RouteLocaleProvider>
            <TranslationConsumer />
        </>);
        expect(document.documentElement.lang).toBe("en");
        expect(useI18nStore.getState().locale).toBe("bs");
    });

    it("follows the saved language on shared pages and responds to an explicit change", () => {
        pathname.current = "/contact";
        render(<DocumentLanguage />);
        expect(document.documentElement.lang).toBe("bs");
        act(() => useI18nStore.setState({ locale: "fr" }));
        expect(document.documentElement.lang).toBe("fr");
    });

    it("updates after client navigation without changing the saved preference", () => {
        const { rerender } = render(<DocumentLanguage />);
        expect(document.documentElement.lang).toBe("en");
        pathname.current = "/contact";
        rerender(<DocumentLanguage />);
        expect(document.documentElement.lang).toBe("bs");
        pathname.current = "/de/tools";
        rerender(<DocumentLanguage />);
        expect(document.documentElement.lang).toBe("de");
        expect(useI18nStore.getState().locale).toBe("bs");
    });
});
