import { describe, expect, it } from "vitest";
import {
    buildFeedbackUrl,
    buildFeedbackMailto,
    truncateConsole,
    CONSOLE_FIELD_BUDGET,
    URL_BUDGET,
    type FeedbackContext,
} from "./buildFeedbackUrl";

const REPO = "enginecv/enginecv";
const MAILTO = "support@enginecv.app";

const baseCtx: FeedbackContext = {
    version: "0.1.0",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    viewport: "1920x1080",
    route: "/editor/123",
    locale: "en",
};

describe("buildFeedbackUrl", () => {
    it("targets the correct repo issues/new endpoint", () => {
        const url = buildFeedbackUrl("bug", baseCtx, REPO);
        expect(url.startsWith(`https://github.com/${REPO}/issues/new?`)).toBe(true);
    });

    it("uses bug template for bug kind", () => {
        const url = new URL(buildFeedbackUrl("bug", baseCtx, REPO));
        expect(url.searchParams.get("template")).toBe("bug-report.yml");
    });

    it("uses quirk template for quirk kind", () => {
        const url = new URL(buildFeedbackUrl("quirk", baseCtx, REPO));
        expect(url.searchParams.get("template")).toBe("quirk-report.yml");
    });

    it("uses feature template for feature kind and omits env fields", () => {
        const url = new URL(buildFeedbackUrl("feature", baseCtx, REPO));
        expect(url.searchParams.get("template")).toBe("feature-request.yml");
        expect(url.searchParams.has("version")).toBe(false);
        expect(url.searchParams.has("browser")).toBe(false);
        expect(url.searchParams.has("viewport")).toBe(false);
        expect(url.searchParams.has("route")).toBe(false);
        expect(url.searchParams.has("locale")).toBe(false);
    });

    it("URL-encodes user agent and route values", () => {
        const url = buildFeedbackUrl("bug", baseCtx, REPO);
        expect(url).toContain("browser=Mozilla%2F5.0");
        expect(url).toContain("route=%2Feditor%2F123");
    });

    it("respects redaction flags", () => {
        const url = new URL(
            buildFeedbackUrl("bug", baseCtx, REPO, {
                userAgent: true,
                viewport: true,
            }),
        );
        expect(url.searchParams.get("version")).toBe("0.1.0");
        expect(url.searchParams.has("browser")).toBe(false);
        expect(url.searchParams.has("viewport")).toBe(false);
        expect(url.searchParams.get("route")).toBe("/editor/123");
        expect(url.searchParams.get("locale")).toBe("en");
    });

    it("redaction can hide every env field", () => {
        const url = new URL(
            buildFeedbackUrl("bug", baseCtx, REPO, {
                version: true,
                userAgent: true,
                viewport: true,
                route: true,
                locale: true,
            }),
        );
        expect(url.searchParams.has("version")).toBe(false);
        expect(url.searchParams.has("browser")).toBe(false);
        expect(url.searchParams.has("viewport")).toBe(false);
        expect(url.searchParams.has("route")).toBe(false);
        expect(url.searchParams.has("locale")).toBe(false);
    });

    it("truncates console output above the field budget", () => {
        const long = "x".repeat(CONSOLE_FIELD_BUDGET + 500);
        const url = new URL(
            buildFeedbackUrl("bug", { ...baseCtx, consoleOutput: long }, REPO),
        );
        const consoleParam = url.searchParams.get("console") ?? "";
        expect(consoleParam.length).toBeLessThanOrEqual(CONSOLE_FIELD_BUDGET);
        expect(consoleParam.endsWith("[truncated]")).toBe(true);
    });

    it("drops console field when total URL would exceed the budget", () => {
        const longUa = "u".repeat(URL_BUDGET);
        const url = new URL(
            buildFeedbackUrl(
                "bug",
                {
                    ...baseCtx,
                    userAgent: longUa,
                    consoleOutput: "console output that should be dropped",
                },
                REPO,
            ),
        );
        expect(url.searchParams.has("console")).toBe(false);
    });

    it("never POSTs anywhere — output is always a github.com URL", () => {
        const url = new URL(buildFeedbackUrl("bug", baseCtx, REPO));
        expect(url.host).toBe("github.com");
        expect(url.protocol).toBe("https:");
    });
});

describe("buildFeedbackMailto", () => {
    it("produces a mailto: URL with subject and body", () => {
        const url = buildFeedbackMailto("bug", baseCtx, MAILTO);
        expect(url.startsWith(`mailto:${MAILTO}?`)).toBe(true);
        const params = new URLSearchParams(url.split("?")[1]);
        expect(params.get("subject")).toBe("EngineCV bug report");
        expect(params.get("body")).toContain("Version: 0.1.0");
        expect(params.get("body")).toContain("Locale: en");
    });

    it("respects redaction flags in body", () => {
        const url = buildFeedbackMailto("bug", baseCtx, MAILTO, {
            userAgent: true,
            locale: true,
        });
        const body = new URLSearchParams(url.split("?")[1]).get("body") ?? "";
        expect(body).not.toContain("Browser:");
        expect(body).not.toContain("Locale:");
        expect(body).toContain("Version: 0.1.0");
    });

    it("omits env fields for feature kind", () => {
        const url = buildFeedbackMailto("feature", baseCtx, MAILTO);
        const body = new URLSearchParams(url.split("?")[1]).get("body") ?? "";
        expect(body).not.toContain("Version:");
        expect(body).not.toContain("Browser:");
        expect(body).toContain("Describe the issue");
    });
});

describe("truncateConsole", () => {
    it("returns input unchanged when under the limit", () => {
        const input = "small string";
        expect(truncateConsole(input)).toBe(input);
    });

    it("trims and marks output when over the limit", () => {
        const input = "a".repeat(10_000);
        const out = truncateConsole(input, 1000);
        expect(out.length).toBeLessThanOrEqual(1000);
        expect(out.endsWith("[truncated]")).toBe(true);
    });
});
