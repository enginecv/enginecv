import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_21_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

export interface A11yScanOptions {
    /** CSS selectors to scan instead of the whole page. */
    include?: string[];
    /** Third-party ad iframes only — never app UI. */
    exclude?: string[];
    /** Name used for the attached report. */
    label?: string;
}

/**
 * Runs axe with WCAG 2.1 A/AA rules and fails on serious or critical violations.
 * All violations (including moderate/minor) are attached to the test report.
 */
export async function expectNoA11yViolations(page: Page, options: A11yScanOptions = {}) {
    // Measure settled UI: a fade caught halfway reports blended, meaningless colours.
    await page.evaluate(() => Promise.race([
        Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined))),
        new Promise((resolve) => setTimeout(resolve, 2000)),
    ]));

    let builder = new AxeBuilder({ page }).withTags(WCAG_21_AA_TAGS);
    for (const selector of options.include ?? []) builder = builder.include(selector);
    for (const selector of options.exclude ?? []) builder = builder.exclude(selector);

    const results = await builder.analyze();
    const label = options.label ?? "a11y";

    await test.info().attach(`${label}-violations.json`, {
        body: JSON.stringify(results.violations, null, 2),
        contentType: "application/json",
    });

    const blocking = results.violations
        .filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ""))
        .map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            help: violation.help,
            targets: violation.nodes.map((node) => node.target.join(" ")),
        }));

    expect(blocking, `${label}: serious/critical WCAG 2.1 AA violations`).toEqual([]);
}

/**
 * Seeds the theme preference before any page script runs. Works whether or not the
 * preferences envelope (`enginecv-preferences`) already exists.
 */
export async function setTheme(page: Page, theme: "light" | "dark") {
    await page.addInitScript((value) => {
        const key = "enginecv-preferences";
        try {
            const raw = window.localStorage.getItem(key);
            if (raw) {
                const envelope = JSON.parse(raw);
                if (envelope?.preferences?.appearance) {
                    envelope.preferences.appearance.theme = value;
                    window.localStorage.setItem(key, JSON.stringify(envelope));
                    return;
                }
            }
            window.localStorage.setItem("enginecv-theme", value);
        } catch {
            // Storage unavailable: the app falls back to its default theme.
        }
    }, theme);
}

/** Waits until the document reflects the requested theme. */
export async function expectTheme(page: Page, theme: "light" | "dark") {
    if (theme === "light") {
        await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    } else {
        await expect(page.locator("html")).not.toHaveAttribute("data-theme", "light");
    }
}
