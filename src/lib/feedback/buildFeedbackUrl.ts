export type FeedbackKind = "bug" | "quirk" | "feature";

export interface FeedbackContext {
    version: string;
    userAgent: string;
    viewport: string;
    route: string;
    locale: string;
    consoleOutput?: string;
}

export interface RedactionFlags {
    version?: boolean;
    userAgent?: boolean;
    viewport?: boolean;
    route?: boolean;
    locale?: boolean;
}

const TEMPLATE_BY_KIND: Record<FeedbackKind, string> = {
    bug: "bug-report.yml",
    quirk: "quirk-report.yml",
    feature: "feature-request.yml",
};

export const URL_BUDGET = 8000;
export const CONSOLE_FIELD_BUDGET = 6000;

export function truncateConsole(input: string, max = CONSOLE_FIELD_BUDGET): string {
    if (input.length <= max) return input;
    const head = input.slice(0, Math.max(0, max - 24));
    return `${head}\n... [truncated]`;
}

function buildIssueParams(
    kind: FeedbackKind,
    ctx: FeedbackContext,
    redactions: RedactionFlags,
): URLSearchParams {
    const params = new URLSearchParams();
    params.set("template", TEMPLATE_BY_KIND[kind]);

    if (kind === "feature") {
        return params;
    }

    if (!redactions.version && ctx.version) params.set("version", ctx.version);
    if (!redactions.userAgent && ctx.userAgent) params.set("browser", ctx.userAgent);
    if (!redactions.viewport && ctx.viewport) params.set("viewport", ctx.viewport);
    if (!redactions.route && ctx.route) params.set("route", ctx.route);
    if (!redactions.locale && ctx.locale) params.set("locale", ctx.locale);
    if (ctx.consoleOutput) params.set("console", truncateConsole(ctx.consoleOutput));

    return params;
}

export function buildFeedbackUrl(
    kind: FeedbackKind,
    ctx: FeedbackContext,
    repo: string,
    redactions: RedactionFlags = {},
): string {
    const params = buildIssueParams(kind, ctx, redactions);
    const base = `https://github.com/${repo}/issues/new`;
    let url = `${base}?${params.toString()}`;

    if (url.length > URL_BUDGET && params.has("console")) {
        params.delete("console");
        url = `${base}?${params.toString()}`;
    }

    return url;
}

export function buildFeedbackMailto(
    kind: FeedbackKind,
    ctx: FeedbackContext,
    address: string,
    redactions: RedactionFlags = {},
): string {
    const subjectByKind: Record<FeedbackKind, string> = {
        bug: "EngineCV bug report",
        quirk: "EngineCV quirk report",
        feature: "EngineCV feature request",
    };

    const lines: string[] = [];

    if (kind !== "feature") {
        if (!redactions.version && ctx.version) lines.push(`Version: ${ctx.version}`);
        if (!redactions.userAgent && ctx.userAgent) lines.push(`Browser: ${ctx.userAgent}`);
        if (!redactions.viewport && ctx.viewport) lines.push(`Viewport: ${ctx.viewport}`);
        if (!redactions.route && ctx.route) lines.push(`Route: ${ctx.route}`);
        if (!redactions.locale && ctx.locale) lines.push(`Locale: ${ctx.locale}`);
        lines.push("", "---", "");
    }

    lines.push("Describe the issue:", "");

    const params = new URLSearchParams({
        subject: subjectByKind[kind],
        body: lines.join("\n"),
    });

    return `mailto:${address}?${params.toString()}`;
}
