import { chromium, type FullConfig } from "@playwright/test";
import { reportRequested, resetParseCases } from "./helpers/parse-report";
import { writeConsentDecidedState } from "./helpers/storage-state";

/**
 * Next's dev server compiles each route on its first request. Against a cold
 * server that first compile (often 10s+) lands inside a test and times out
 * navigation assertions, which made the suite fail or pass depending on whether
 * the server happened to be warm. Load every route the suite visits once, in a
 * real browser so client chunks compile too, before any test starts.
 *
 * Production servers (`next start`) have nothing to compile; this is then a
 * few quick page loads.
 */
const WARM_ROUTES = [
    "/",
    "/dashboard",
    "/dashboard?tab=templates",
    "/editor/e2e-warmup",
    "/templates/enginecv-modern",
    "/blog",
    "/privacy",
    "/cookies",
];

const ROUTE_WARMUP_TIMEOUT_MS = 180_000;

export default async function globalSetup(config: FullConfig) {
    if (reportRequested()) await resetParseCases();

    const mainBaseURL = config.projects.find((project) => project.name === "chromium")?.use.baseURL;
    if (mainBaseURL) writeConsentDecidedState(mainBaseURL);

    const baseURLs = new Set(
        config.projects
            .map((project) => project.use.baseURL)
            .filter((url): url is string => Boolean(url)),
    );

    const browser = await chromium.launch();
    try {
        for (const baseURL of baseURLs) {
            // Projects whose server was not started for this run (e.g. chromium-ads)
            // are skipped rather than warmed.
            const reachable = await fetch(baseURL, { method: "HEAD" }).then(() => true, () => false);
            if (!reachable) continue;

            const page = await browser.newPage({ baseURL });
            for (const route of WARM_ROUTES) {
                try {
                    await page.goto(route, { waitUntil: "load", timeout: ROUTE_WARMUP_TIMEOUT_MS });
                } catch (error) {
                    // Warm-up is best effort; the tests that visit the route report real failures.
                    console.warn(`[e2e warmup] ${baseURL}${route}: ${(error as Error).message.split("\n")[0]}`);
                }
            }
            await page.close();
        }
    } finally {
        await browser.close();
    }
}
