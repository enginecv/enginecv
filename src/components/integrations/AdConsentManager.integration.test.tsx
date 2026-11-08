import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONSENT_STORAGE_KEY, readAdConsent } from "@/lib/consent";
import { useI18nStore } from "@/lib/i18n";
import { AdConsentManager } from "./AdConsentManager";

function storeDecision(ads: "granted" | "denied") {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ version: 2, ads, decidedAt: "2026-09-16T00:00:00.000Z" }));
}

describe("AdConsentManager", () => {
    beforeEach(() => {
        localStorage.clear();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(() => {
        cleanup();
    });

    it("reports an unanswered state and offers both choices", () => {
        render(<AdConsentManager />);

        expect(screen.getByTestId("ad-consent-status")).toHaveAttribute("data-status", "unanswered");
        expect(screen.getByRole("button", { name: "Allow ads" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Withdraw consent" })).toBeInTheDocument();
    });

    it("withdraws granted consent", async () => {
        const user = userEvent.setup();
        storeDecision("granted");
        render(<AdConsentManager />);

        await user.click(screen.getByRole("button", { name: "Withdraw consent" }));

        expect(readAdConsent()).toMatchObject({ ads: "denied" });
        expect(screen.getByTestId("ad-consent-status")).toHaveAttribute("data-status", "denied");
        expect(screen.queryByRole("button", { name: "Withdraw consent" })).toBeNull();
    });

    it("lets a visitor who declined allow ads again", async () => {
        const user = userEvent.setup();
        storeDecision("denied");
        render(<AdConsentManager />);

        await user.click(screen.getByRole("button", { name: "Allow ads" }));

        expect(readAdConsent()).toMatchObject({ ads: "granted" });
        expect(screen.getByTestId("ad-consent-status")).toHaveAttribute("data-status", "granted");
    });

    it("announces the status in the active locale", () => {
        storeDecision("denied");
        act(() => useI18nStore.setState({ locale: "fr", _hydrated: true }));
        render(<AdConsentManager />);

        expect(screen.getByRole("status")).toHaveTextContent("La publicité n'est pas autorisée.");
    });
});
