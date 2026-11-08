import type { Page } from "@playwright/test";

// Hosts the privacy contract allows.
// Analytics EngineCV does not use at all: any request to these is a regression.
export const ANALYTICS_HOSTS = [
    "www.googletagmanager.com",
    "www.google-analytics.com",
    "region1.google-analytics.com",
] as const;

// Cloudflare Web Analytics: cookieless page measurement, disclosed in /privacy
// section 2. It is injected by Cloudflare's edge on enginecv.app, so nothing in
// the app bundle may load it and no local build can produce these requests.
export const CLOUDFLARE_ANALYTICS_HOSTS = [
    "static.cloudflareinsights.com",
    "cloudflareinsights.com",
] as const;

// Ad hosts may only be contacted after the visitor grants ad consent.
export const AD_HOSTS = [
    "pagead2.googlesyndication.com",
    "googleads.g.doubleclick.net",
    "tpc.googlesyndication.com",
    "fundingchoicesmessages.google.com",
    // Observed alongside AdSense in the 022 data-flow capture.
    "adtrafficquality.google",
    "www.google.com",
] as const;

// Built-in fonts are self-hosted; only fonts a user adds by URL may load from these.
export const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"] as const;

/** Collects every request URL the page makes from now on. The array keeps filling as requests happen. */
export function recordRequests(page: Page): string[] {
    const urls: string[] = [];
    page.on("request", (request) => {
        urls.push(request.url());
    });
    return urls;
}

/** Returns the URLs whose hostname is one of `hosts` (or a subdomain of one). */
export function hostsHit(urls: readonly string[], hosts: readonly string[]): string[] {
    return urls.filter((url) => {
        let hostname: string;
        try {
            hostname = new URL(url).hostname;
        } catch {
            return false;
        }
        return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
    });
}
