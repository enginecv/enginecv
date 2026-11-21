import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { MemoryStorage, seededAdapters } from "@/lib/storage-registry/__fixtures__/adapters";
import CookiesPage from "@/app/(site)/cookies/page";
import { YourDataContent } from "./YourDataContent";

const inventorySource = vi.hoisted(() => ({ overrides: {} as Record<string, unknown>, fail: false }));

vi.mock("@/components/landing/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/components/landing/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/integrations/AdConsentManager", () => ({ AdConsentManager: () => null }));
vi.mock("@/lib/storage-registry/inventory", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/storage-registry/inventory")>();
    return {
        ...actual,
        collectInventory: () => inventorySource.fail
            ? Promise.reject(new Error("boom"))
            : actual.collectInventory({ ...seededAdapters(), ...inventorySource.overrides }),
    };
});

describe("Your data page", () => {
    beforeEach(() => {
        inventorySource.overrides = {};
        inventorySource.fail = false;
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(cleanup);

    it("shows a reading state, then every stored item with counts", async () => {
        render(<YourDataContent />);
        expect(screen.getByTestId("your-data-reading")).toBeTruthy();

        const summary = await screen.findByTestId("your-data-summary");
        expect(within(summary).getByText("3 CVs")).toBeTruthy();
        expect(within(summary).getByText("2 saved versions")).toBeTruthy();

        const table = screen.getByTestId("your-data-inventory");
        expect(within(table).getAllByText("enginecv-preferences").length).toBeGreaterThan(0);
        expect(within(table).getAllByText("enginecv-locale").length).toBeGreaterThan(0);
    });

    it("marks items EngineCV does not know", async () => {
        render(<YourDataContent />);
        const table = await screen.findByTestId("your-data-inventory");
        const fooRow = within(table).getAllByText("foo")[0].closest("tr")!;
        expect(within(fooRow).getByText("Unrecognised")).toBeTruthy();
    });

    it("shows an empty state in a fresh browser", async () => {
        inventorySource.overrides = {
            indexedDB: { databases: async () => [] },
            localStorage: new MemoryStorage(),
            sessionStorage: new MemoryStorage(),
            cookies: () => "",
        };
        render(<YourDataContent />);
        expect(await screen.findByTestId("your-data-empty")).toBeTruthy();
        expect(screen.queryByTestId("your-data-inventory")).toBeNull();
    });

    it("says which storage it could not read", async () => {
        inventorySource.overrides = { localStorage: null };
        render(<YourDataContent />);
        expect(await screen.findByText(/did not let EngineCV read its Browser storage/)).toBeTruthy();
    });

    it("lists third-party cookies and what EngineCV keeps on its servers", async () => {
        render(<YourDataContent />);
        await screen.findByTestId("your-data-inventory");
        expect(screen.getByText("__cf_bm")).toBeTruthy();
        expect(screen.getByText(/No accounts, and none of your CV content/)).toBeTruthy();
    });

    it("renders in German", async () => {
        useI18nStore.setState({ locale: "de", _hydrated: true });
        render(<YourDataContent />);
        expect(await screen.findByText("3 Lebensläufe")).toBeTruthy();
        expect(screen.getByRole("heading", { level: 1, name: "Ihre Daten" })).toBeTruthy();
    });
});

describe("cookie policy", () => {
    afterEach(cleanup);

    it("lists every stored item from the registry, including ones the old policy missed", () => {
        render(<CookiesPage />);
        const storage = screen.getByTestId("cookie-policy-storage");
        expect(within(storage).getByText("enginecv-readme-credit")).toBeTruthy();
        expect(within(storage).getByText("enginecv-locale-suggestion-dismissed")).toBeTruthy();
        expect(within(screen.getByTestId("cookie-policy-cookies")).getByText("enginecv-locale")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Your data" }).getAttribute("href")).toBe("/your-data");
    });
});

describe("Your data page: workspace folder files", () => {
    beforeEach(() => {
        inventorySource.overrides = {
            readEngineCvContent: async () => ({
                resumes: [], resumeHistory: [], templates: [],
                workspace: [{ id: "current" }],
            }),
        };
        inventorySource.fail = false;
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });
    afterEach(cleanup);

    it("lists the workspace table and says the files stay on the computer", async () => {
        render(<YourDataContent />);
        const table = await screen.findByTestId("your-data-inventory");
        expect(within(table).getAllByText("workspace").length).toBeGreaterThan(0);
        const note = screen.getByTestId("your-data-files");
        expect(note.textContent).toMatch(/not in this browser/);
        expect(note.textContent).toMatch(/does not delete them/);
    });

    it("says it in German too", async () => {
        useI18nStore.setState({ locale: "de", _hydrated: true });
        render(<YourDataContent />);
        expect((await screen.findByTestId("your-data-files")).textContent).toMatch(/nicht in diesem Browser/);
    });
});

describe("Your data page: developer tools", () => {
    beforeEach(() => {
        inventorySource.overrides = {};
        inventorySource.fail = false;
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });
    afterEach(cleanup);

    it("explains how to open developer tools and gives every row a path to find it", async () => {
        render(<YourDataContent />);
        const table = await screen.findByTestId("your-data-inventory");
        expect(screen.getByTestId("your-data-devtools-steps").textContent).toMatch(/F12/);
        const rows = within(table).getAllByTestId("your-data-row");
        const paths = within(table).getAllByTestId("your-data-devtools-path");
        expect(paths).toHaveLength(rows.length);
        for (const path of paths) expect(path.textContent).toMatch(/^Find it in DevTools:Application›/);
        const prefs = rows.find((row) => row.textContent?.includes("enginecv-preferences"))!;
        const pathCell = (prefs.nextElementSibling as HTMLElement).querySelector('[data-testid="your-data-devtools-path"]')!;
        expect(pathCell.textContent).toBe(`Find it in DevTools:Application›Local storage›${window.location.origin}›enginecv-preferences`);
    });

    it("is translated", async () => {
        useI18nStore.setState({ locale: "de", _hydrated: true });
        render(<YourDataContent />);
        await screen.findByTestId("your-data-inventory");
        expect(screen.getByTestId("your-data-devtools-steps").textContent).toMatch(/Entwicklertools/);
        expect(screen.getAllByText(/In den DevTools finden/)).toBeTruthy();
    });
});
