import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({
    default: ({ children, ...props }: React.ScriptHTMLAttributes<HTMLScriptElement>) => (
        <script {...props}>{children}</script>
    ),
}));

const originalEnv = process.env;

async function renderSiteScripts(env: Record<string, string> = {}) {
    vi.resetModules();
    process.env = {
        ...originalEnv,
        NEXT_PUBLIC_ENABLE_ADS: "false",
        NEXT_PUBLIC_ADSENSE_CLIENT: "",
        ...env,
    };

    const { SiteScripts } = await import("./SiteScripts");
    return render(<SiteScripts />);
}

describe("SiteScripts", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        process.env = { ...originalEnv };
    });

    it("never renders analytics scripts, even with the retired analytics variables set", async () => {
        await renderSiteScripts({
            NEXT_PUBLIC_ENABLE_ANALYTICS: "true",
            NEXT_PUBLIC_GA4_ID: "G-TEST",
            NEXT_PUBLIC_ENABLE_CLOUDFLARE_WEB_ANALYTICS: "true",
            NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: "cf-token",
        });

        const sources = [...document.querySelectorAll("script")].map((script) => script.getAttribute("src") ?? "");
        expect(sources.some((src) => /cloudflareinsights|googletagmanager|google-analytics/.test(src))).toBe(false);
        expect(document.querySelector("#enginecv-cloudflare-web-analytics")).toBeNull();
        expect(document.querySelector("#enginecv-ga4-src")).toBeNull();
    });

    it("renders nothing when ads are not configured", async () => {
        const { container } = await renderSiteScripts();

        expect(container.querySelector("script")).toBeNull();
    });
});
