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
import { translate } from "@/lib/i18n/translate";
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
        ["en", "The free résumé builder that doesn't hold your CV hostage.", ["No Account", "No Paywall", "PDF export is free"]],
        ["bs", "Besplatan alat za životopis koji ne drži vaš CV kao taoca.", ["Bez računa", "Bez naplate", "PDF izvoz je besplatan"]],
        ["de", "Der kostenlose Lebenslauf-Builder, der deinen Lebenslauf nicht als Geisel hält.", ["Ohne Konto", "Ohne Paywall", "PDF-Export ist kostenlos"]],
        ["fr", "Le créateur de CV gratuit qui ne prend pas votre CV en otage.", ["Sans compte", "Sans paywall", "L'export PDF est gratuit"]],
        ["es", "El creador de currículums gratuito que no secuestra tu CV.", ["Sin cuenta", "Sin muro de pago", "La exportación a PDF es gratis"]],
    ] as const)("renders a static free-first headline and proof line in %s", (locale, headline, claims) => {
        useI18nStore.setState({ locale, _hydrated: true });

        render(<Hero />);

        expect(screen.getByRole("heading", { level: 1, name: headline })).toBeInTheDocument();
        const proofLine = screen.getByTestId("landing-hero-proof-line");
        for (const claim of claims) expect(proofLine).toHaveTextContent(claim);
    });

    it("has one dominant CTA to the dashboard and a secondary templates link", () => {
        render(<Hero />);

        expect(screen.getByRole("link", { name: /Build My Resume — Free/ })).toHaveAttribute("href", "/dashboard");
        expect(screen.getByRole("link", { name: "Explore Templates" })).toBeInTheDocument();
        expect(screen.queryByText(/AI integration not supported/)).not.toBeInTheDocument();
    });

    it("renders compact proof claims without equal-width cells", () => {
        render(<Hero />);

        const proofLine = screen.getByTestId("landing-hero-proof-line");
        expect(proofLine).toHaveTextContent("Runs in your browser");
        expect(proofLine).toHaveTextContent(`${getExportFormatCount()} export formats`);
        expect(proofLine).toHaveTextContent("PDF export is free");
        expect(proofLine).toHaveTextContent("Open source (AGPL-3.0)");
        expect(proofLine).toHaveClass("flex", "flex-wrap");
        expect(proofLine.className).not.toContain("grid-cols-3");
    });

    it("says the project is open source and links to the repository", () => {
        render(<Hero />);

        expect(screen.getByText(/EngineCV is open source\./)).toBeInTheDocument();
        expect(screen.getByTestId("landing-hero-source-link")).toHaveAttribute(
            "href",
            "https://github.com/enginecv/enginecv",
        );
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

    it("describes the selected template and offers no editing fields", () => {
        const templates = limitShowcaseTemplates(getBuiltinTemplates());
        render(<LandingWorkbenchDemo />);

        expect(screen.getByRole("heading", { name: templates[0].meta.name })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "All templates" })).toHaveAttribute("href", "/cv-templates");
        expect(screen.queryByTestId("landing-demo-name")).not.toBeInTheDocument();
        expect(screen.queryByText("Try the editor")).not.toBeInTheDocument();
    });

    it("enlarges the centred template in a dialog and closes it with Escape", async () => {
        const user = userEvent.setup();
        const templates = limitShowcaseTemplates(getBuiltinTemplates());
        render(<LandingWorkbenchDemo />);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: `Enlarge preview: ${templates[0].meta.name}` }));

        const dialog = await screen.findByRole("dialog", { name: templates[0].meta.name });
        expect(dialog).toHaveAttribute("aria-modal", "true");

        await user.keyboard("{Escape}");
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("steps through templates from the enlarged view", async () => {
        const user = userEvent.setup();
        const templates = limitShowcaseTemplates(getBuiltinTemplates());
        render(<LandingWorkbenchDemo />);

        await user.click(screen.getByRole("button", { name: `Enlarge preview: ${templates[0].meta.name}` }));
        const dialog = await screen.findByRole("dialog");
        await user.keyboard("{ArrowRight}");

        expect(screen.getByTestId("landing-template-counter")).toHaveTextContent(`Template 2/${templates.length}`);
        expect(dialog).toHaveAttribute("aria-label", templates[1].meta.name);
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
            name: `Koristi šablon: ${translate("bs", "template.name.modern")}`,
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
