import { getExportFormatCount } from "@/lib/export-formats";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hero } from "./Hero";
import { LandingWorkbenchDemo } from "./LandingWorkbenchDemo";
import { limitShowcaseTemplates } from "@/lib/landing-template-carousel";
import { getBuiltinTemplates } from "@/lib/templates/enginecv-templates";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import * as useTemplateModule from "@/lib/templates/use-template";

const { pushMock } = vi.hoisted(() => ({
    pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: pushMock,
    }),
}));

describe("Hero template showcase", () => {
    beforeEach(async () => {
        await db.resumes.clear();
        await db.resumeHistory.clear();
        vi.restoreAllMocks();
        pushMock.mockClear();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(async () => {
        cleanup();
        await db.resumes.clear();
        await db.resumeHistory.clear();
    });

    it.each([
        ["en", "No Account. No Paywall. No Nonsense.", ["Account", "Paywall", "Nonsense"]],
        ["bs", "Bez računa. Bez naplate. Bez gluposti.", ["računa", "naplate", "gluposti"]],
        ["de", "Ohne Konto. Ohne Paywall. Ohne Ballast.", ["Konto", "Paywall", "Ballast"]],
        ["fr", "Sans compte. Sans paywall. Sans baratin.", ["compte", "paywall", "baratin"]],
        ["es", "Sin cuenta. Sin muro de pago. Sin tonterías.", ["cuenta", "muro de pago", "tonterías"]],
    ] as const)("renders the rotating promise in %s", (locale, accessibleLabel, terms) => {
        useI18nStore.setState({ locale, _hydrated: true });

        render(<Hero />);

        expect(screen.getByRole("heading", { name: accessibleLabel })).toBeInTheDocument();
        const track = screen.getByTestId("hero-term-track");
        expect(track.children).toHaveLength(4);
        for (const term of terms) expect(track).toHaveTextContent(term);
        expect(track.firstElementChild).toHaveTextContent(terms[0]);
        expect(track.lastElementChild).toHaveTextContent(terms[0]);
    });

    it("renders compact proof claims without equal-width cells", () => {
        render(<Hero />);

        const proofLine = screen.getByTestId("landing-hero-proof-line");
        expect(proofLine).toHaveTextContent("Runs in your browser");
        expect(proofLine).toHaveTextContent(`${getExportFormatCount()} export formats`);
        expect(proofLine).toHaveTextContent("No lock-in");
        expect(proofLine).toHaveClass("flex", "flex-wrap");
        expect(proofLine.className).not.toContain("grid-cols-3");
    });

    it("shows a placeholder until the workbench demo scrolls into view", () => {
        render(<Hero />);

        expect(screen.getByTestId("landing-demo-placeholder")).toBeInTheDocument();
        expect(screen.queryByTestId("landing-template-showcase")).not.toBeInTheDocument();
    });

    it("loads the workbench demo once its placeholder scrolls into view", async () => {
        const original = globalThis.IntersectionObserver;
        globalThis.IntersectionObserver = class {
            constructor(private readonly callback: IntersectionObserverCallback) {}
            observe() {
                this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
            }
            unobserve() {}
            disconnect() {}
            takeRecords() {
                return [];
            }
        } as unknown as typeof IntersectionObserver;
        try {
            render(<Hero />);

            expect(await screen.findByTestId("landing-template-showcase", undefined, { timeout: 15_000 })).toBeInTheDocument();
            expect(screen.queryByTestId("landing-demo-placeholder")).not.toBeInTheDocument();
        } finally {
            globalThis.IntersectionObserver = original;
        }
    }, 20_000);

    it("renders one selected template preview with counter and accessible controls", () => {
        const { container } = render(<LandingWorkbenchDemo />);
        const templates = limitShowcaseTemplates(getBuiltinTemplates());

        expect(screen.getByTestId("landing-template-showcase")).toBeInTheDocument();
        expect(screen.getByTestId("landing-template-counter")).toHaveTextContent(`Template 1/${templates.length}`);
        expect(screen.getByRole("button", { name: "Previous template" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Next template" })).toBeInTheDocument();

        const selectedSlide = container.querySelector('[data-selected="true"]');
        expect(selectedSlide).toHaveAttribute("aria-hidden", "false");
        expect(selectedSlide).toHaveTextContent(templates[0].meta.name);
    });

    it("updates the selected preview and counter when navigating", () => {
        const { container } = render(<LandingWorkbenchDemo />);
        const templates = limitShowcaseTemplates(getBuiltinTemplates());

        fireEvent.click(screen.getByRole("button", { name: "Next template" }));
        expect(screen.getByTestId("landing-template-counter")).toHaveTextContent(`Template 2/${templates.length}`);
        expect(container.querySelector('[data-selected="true"]')).toHaveTextContent(templates[1].meta.name);

        fireEvent.click(screen.getByRole("button", { name: "Previous template" }));
        expect(screen.getByTestId("landing-template-counter")).toHaveTextContent(`Template 1/${templates.length}`);
        expect(container.querySelector('[data-selected="true"]')).toHaveTextContent(templates[0].meta.name);

        fireEvent.click(screen.getByRole("button", { name: "Previous template" }));
        expect(screen.getByTestId("landing-template-counter")).toHaveTextContent(`Template ${templates.length}/${templates.length}`);
        expect(container.querySelector('[data-selected="true"]')).toHaveTextContent(templates[templates.length - 1].meta.name);
    });

    it("updates the real resume preview from the workbench content controls", async () => {
        const user = userEvent.setup();
        const { container } = render(<LandingWorkbenchDemo />);

        const nameInput = screen.getByTestId("landing-demo-name");
        const previewName = container.querySelector('[data-testid="resume-preview-name"]');

        expect(previewName).toHaveTextContent("Alex Carter");
        await user.clear(nameInput);
        await user.type(nameInput, "Mira Hadzic");

        expect(previewName).toHaveTextContent("Mira Hadzic");
    });

    it("creates exactly one resume from the selected template and opens its editor", async () => {
        const user = userEvent.setup();
        const templates = limitShowcaseTemplates(getBuiltinTemplates());
        render(<LandingWorkbenchDemo />);

        const useButton = screen.getByRole("button", {
            name: `Use template: ${templates[0].meta.name}`,
        });
        await user.dblClick(useButton);

        await waitFor(() => expect(pushMock).toHaveBeenCalledWith(expect.stringMatching(/^\/editor\//)));
        expect(pushMock).toHaveBeenCalledTimes(1);
        expect(await db.resumes.count()).toBe(1);
        const [resume] = await db.resumes.toArray();
        expect(resume.settings.colors).toEqual(templates[0].settings.colors);
    });

    it("translates the use-template action", () => {
        const templates = limitShowcaseTemplates(getBuiltinTemplates());
        useI18nStore.setState({ locale: "bs", _hydrated: true });

        render(<LandingWorkbenchDemo />);

        expect(screen.getByRole("button", {
            name: `Koristi šablon: ${templates[0].meta.name}`,
        })).toBeInTheDocument();
    });

    it("shows a translated loading state while creating the resume", async () => {
        const user = userEvent.setup();
        vi.spyOn(useTemplateModule, "createResumeFromTemplate").mockImplementation(
            () => new Promise<string>(() => undefined),
        );
        render(<LandingWorkbenchDemo />);

        await user.click(screen.getByRole("button", { name: /^Use template:/ }));

        expect(screen.getByText("Creating resume...")).toBeInTheDocument();
    });

    it("shows a translated recoverable error when creation fails", async () => {
        const user = userEvent.setup();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(useTemplateModule, "createResumeFromTemplate").mockRejectedValue(
            new Error("IndexedDB failed"),
        );
        useI18nStore.setState({ locale: "de", _hydrated: true });
        render(<LandingWorkbenchDemo />);

        await user.click(screen.getByRole("button", { name: /^Vorlage verwenden:/ }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Aus dieser Vorlage konnte kein Lebenslauf erstellt werden. Versuchen Sie es erneut.",
        );
        expect(await db.resumes.count()).toBe(0);
    });
});
