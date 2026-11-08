import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { RememberRouteLocale } from "./RememberRouteLocale";

describe("remembering a localized route", () => {
    beforeEach(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    afterEach(cleanup);

    it("stores the route language after preferences hydrate", () => {
        useI18nStore.setState({ _hydrated: false });
        render(<RememberRouteLocale locale="bs" />);
        expect(useI18nStore.getState().locale).toBe("en");
        act(() => useI18nStore.setState({ _hydrated: true }));
        expect(useI18nStore.getState().locale).toBe("bs");
    });

    it("does not undo an explicit choice while navigation to another language is pending", () => {
        render(<RememberRouteLocale locale="bs" />);
        act(() => useI18nStore.getState().setLocale("en"));
        expect(useI18nStore.getState().locale).toBe("en");
    });

    it("remembers the next route when its locale changes", () => {
        const { rerender } = render(<RememberRouteLocale locale="bs" />);
        rerender(<RememberRouteLocale locale="fr" />);
        expect(useI18nStore.getState().locale).toBe("fr");
    });
});
