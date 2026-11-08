import { defineConfig, devices } from "@playwright/test";
import { CONSENT_DECIDED_STATE_PATH } from "./e2e/helpers/storage-state";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

// The ads-enabled project needs NEXT_PUBLIC_* values inlined at compile time, so
// it runs its own dev server with a separate distDir (see next.config.ts).
const ADS_PORT = Number(process.env.PLAYWRIGHT_ADS_PORT ?? 3200);
const adsBaseURL = `http://localhost:${ADS_PORT}`;
const adsProjectSelected = process.argv.some((arg) => arg === "--project=chromium-ads" || arg === "chromium-ads");

export default defineConfig({
    testDir: "./e2e",
    globalSetup: "./e2e/global-setup.ts",
    globalTeardown: "./e2e/global-teardown.ts",
    fullyParallel: false,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    timeout: 30_000,
    expect: {
        timeout: 5_000,
    },
    reporter: "list",
    use: {
        baseURL,
        trace: "on-first-retry",
    },
    webServer: [
        {
            command: `npm run dev -- --port ${PORT}`,
            url: baseURL,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
        },
        ...(adsProjectSelected
            ? [{
                command: `npx next dev --port ${ADS_PORT}`,
                url: adsBaseURL,
                reuseExistingServer: !process.env.CI,
                timeout: 180_000,
                env: {
                    NEXT_DIST_DIR: ".next-ads",
                    NEXT_PUBLIC_ENABLE_ADS: "true",
                    NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-0000000000000000",
                    NEXT_PUBLIC_CMP_SCRIPT_SRC: "https://fundingchoicesmessages.google.com/i/pub-0000000000000000?test=1",
                },
            }]
            : []),
    ],
    projects: [
        {
            name: "chromium",
            testIgnore: ["**/parse-pdf.spec.ts", "**/*.ads.spec.ts"],
            use: {
                ...devices["Desktop Chrome"],
                storageState: CONSENT_DECIDED_STATE_PATH,
            },
        },
        {
            name: "chromium-ads",
            testMatch: "**/*.ads.spec.ts",
            use: {
                ...devices["Desktop Chrome"],
                baseURL: adsBaseURL,
            },
        },
        {
            name: "parse",
            testMatch: "**/parse-pdf.spec.ts",
            timeout: 180_000,
            use: {
                ...devices["Desktop Chrome"],
                storageState: CONSENT_DECIDED_STATE_PATH,
            },
        },
    ],
});
