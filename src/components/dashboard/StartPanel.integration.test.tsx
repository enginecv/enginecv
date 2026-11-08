import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartPanel } from "@/components/dashboard/StartPanel";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { de } from "@/lib/i18n/de";
import { registerDictionary } from "@/lib/i18n/dictionaries";
import { createId } from "@/lib/id";
import { createEmptyResume } from "@/lib/schema";
import { TooltipProvider } from "@/components/ui/tooltip";

const { pushMock, replaceMock } = vi.hoisted(() => ({ pushMock: vi.fn(), replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock, replace: replaceMock, prefetch: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/dashboard",
}));

const EXPECTED_ORDER = ["blank", "example", "ai", "linkedin", "europass", "github", "json"];

describe("StartPanel", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(() => {
        cleanup();
    });

    it("offers every start path, in order, with a heading", () => {
        render(<StartPanel onSelect={vi.fn()} onImportJson={vi.fn()} />);

        const panel = screen.getByTestId("start-panel");
        expect(within(panel).getByRole("heading", { name: "How do you want to start?" })).toBeInTheDocument();
        const ids = within(panel).getAllByRole("button").map((button) => button.dataset.testid);
        expect(ids).toEqual(EXPECTED_ORDER.map((id) => `start-option-${id}`));
        expect(screen.getByTestId("start-option-github")).toHaveTextContent("Needs internet");
        expect(screen.getByTestId("start-option-blank")).not.toHaveTextContent("Needs internet");
    });

    it("reports the chosen path and keeps JSON for its own file input", async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        const onImportJson = vi.fn();
        render(<StartPanel onSelect={onSelect} onImportJson={onImportJson} />);

        for (const id of ["blank", "example", "linkedin", "europass", "github"]) {
            await user.click(screen.getByTestId(`start-option-${id}`));
        }
        expect(onSelect.mock.calls.map(([id]) => id)).toEqual(["blank", "example", "linkedin", "europass", "github"]);

        const file = new File(["{}"], "resume.json", { type: "application/json" });
        await user.upload(screen.getByTestId("start-panel-json-input"), file);
        expect(onImportJson).toHaveBeenCalledWith(file);
        expect(onSelect).toHaveBeenCalledTimes(5);
    });

    it("disables the options while one is running and focuses a requested option", () => {
        render(<StartPanel onSelect={vi.fn()} onImportJson={vi.fn()} pendingId="blank" focusId="json" />);

        expect(screen.getByTestId("start-option-blank")).toHaveAttribute("aria-busy", "true");
        expect(screen.getByTestId("start-option-europass")).toBeDisabled();
        cleanup();

        render(<StartPanel onSelect={vi.fn()} onImportJson={vi.fn()} focusId="json" />);
        expect(screen.getByTestId("start-option-json")).toHaveFocus();
    });

    it("follows the app language", () => {
        registerDictionary("de", de, { notify: false });
        useI18nStore.setState({ locale: "de", _hydrated: true });
        render(<StartPanel onSelect={vi.fn()} onImportJson={vi.fn()} />);

        expect(screen.getByRole("heading", { name: de["onboarding.panel.title"] })).toBeInTheDocument();
    });
});

// The whole dashboard page is a large module graph; under a full parallel run
// importing it alone can take several seconds.
const PAGE_TIMEOUT = { timeout: 15_000 };

describe("Dashboard start panel", () => {
    beforeEach(async () => {
        await db.resumes.clear();
        await db.resumeHistory.clear();
        pushMock.mockClear();
        replaceMock.mockClear();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(async () => {
        cleanup();
        await db.resumes.clear();
        await db.resumeHistory.clear();
    });

    it("shows the panel on an empty dashboard and creates a blank resume from it", async () => {
        const user = userEvent.setup();
        const { default: DashboardPage } = await import("@/app/(site)/dashboard/page");
        render(<TooltipProvider><DashboardPage /></TooltipProvider>);
        // The resume list is still loading: skeleton, no panel flash.
        expect(screen.queryByTestId("start-panel")).not.toBeInTheDocument();

        await user.click(await screen.findByTestId("start-option-blank", {}, PAGE_TIMEOUT));

        await waitFor(() => expect(pushMock).toHaveBeenCalledWith(expect.stringMatching(/^\/editor\//)), PAGE_TIMEOUT);
        expect(await db.resumes.count()).toBe(1);
    }, 30_000);

    it("opens the matching import dialog from the panel", async () => {
        const user = userEvent.setup();
        const { default: DashboardPage } = await import("@/app/(site)/dashboard/page");
        render(<TooltipProvider><DashboardPage /></TooltipProvider>);

        await user.click(await screen.findByTestId("start-option-europass", {}, PAGE_TIMEOUT));

        expect(await screen.findByRole("dialog", {}, PAGE_TIMEOUT)).toBeInTheDocument();
    }, 30_000);

    it("shows the resume grid instead of the panel once a resume exists", async () => {
        const resume = createEmptyResume();
        await db.resumes.add({ ...resume, id: createId(), meta: { ...resume.meta, title: "Existing CV" } });
        const { default: DashboardPage } = await import("@/app/(site)/dashboard/page");
        render(<TooltipProvider><DashboardPage /></TooltipProvider>);

        expect(await screen.findByText("Existing CV", {}, PAGE_TIMEOUT)).toBeInTheDocument();
        expect(screen.queryByTestId("start-panel")).not.toBeInTheDocument();
    }, 30_000);
});
