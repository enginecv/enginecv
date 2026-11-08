import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { AD_CONSENT_CHANGE_EVENT, CONSENT_STORAGE_KEY, readAdConsent } from "@/lib/consent";

const adsState = vi.hoisted(() => ({ configured: true }));

vi.mock("next/navigation", () => ({ usePathname: () => "/blog" }));

vi.mock("@/lib/ads", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/lib/ads")>();
    return { ...original, isAdsConfigured: () => adsState.configured };
});

vi.mock("next/link", () => ({
    default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
        <a href={href} {...props}>{children}</a>
    ),
}));

import { AdConsentPrompt } from "./AdConsentPrompt";

describe("AdConsentPrompt", () => {
    beforeEach(() => {
        adsState.configured = true;
        localStorage.clear();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(() => {
        cleanup();
    });

    it("renders nothing when the deployment has no ads configured", () => {
        adsState.configured = false;
        render(<AdConsentPrompt />);

        expect(screen.queryByTestId("ad-consent-prompt")).toBeNull();
    });

    it("renders nothing once a decision is stored", () => {
        localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ version: 2, ads: "denied", decidedAt: "2026-09-16T00:00:00.000Z" }));
        render(<AdConsentPrompt />);

        expect(screen.queryByTestId("ad-consent-prompt")).toBeNull();
    });

    it("stores granted consent and announces it when accepted", async () => {
        const user = userEvent.setup();
        const listener = vi.fn();
        window.addEventListener(AD_CONSENT_CHANGE_EVENT, listener);
        render(<AdConsentPrompt />);

        await user.click(screen.getByRole("button", { name: "Allow ads" }));

        expect(readAdConsent()).toMatchObject({ version: 2, ads: "granted" });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("ad-consent-prompt")).toBeNull();
        window.removeEventListener(AD_CONSENT_CHANGE_EVENT, listener);
    });

    it("stores denied consent when declined, with equal prominence to accepting", async () => {
        const user = userEvent.setup();
        render(<AdConsentPrompt />);

        const accept = screen.getByRole("button", { name: "Allow ads" });
        const decline = screen.getByRole("button", { name: "No thanks" });
        expect(decline.className).toBe(accept.className);

        await user.click(decline);

        expect(readAdConsent()).toMatchObject({ version: 2, ads: "denied" });
        expect(screen.queryByTestId("ad-consent-prompt")).toBeNull();
    });

    it("is labelled by its heading and translated in a non-default locale", () => {
        act(() => useI18nStore.setState({ locale: "de", _hydrated: true }));
        render(<AdConsentPrompt />);

        expect(screen.getByRole("region", { name: "Werbung auf EngineCV" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Werbung erlauben" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Nein, danke" })).toBeInTheDocument();
    });
});
