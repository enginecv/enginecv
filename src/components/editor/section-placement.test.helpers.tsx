import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createEmptyResume, type Resume } from "@/lib/schema";
import { useResumeStore } from "@/lib/store";
import { EditorSidebar } from "./EditorSidebar";
import { ResumePreview } from "./ResumePreview";

// Shared harness for the section-placement integration tests (feature 086):
// a real two-column preview next to the Customize section list.

export function createRect(height: number, width = 100): DOMRect {
    return {
        x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}),
    } as DOMRect;
}

export function installRafController() {
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    return {
        async flushAll() {
            while (callbacks.length > 0) {
                const batch = callbacks.splice(0, callbacks.length);
                await act(async () => {
                    batch.forEach((callback) => callback(performance.now()));
                    await Promise.resolve();
                });
            }
        },
    };
}

export function applyStructuredMeasurements(container: HTMLElement, heights: Record<string, number>) {
    const measureContainer = container.querySelector('[data-testid="resume-preview-structured-measure"]') as HTMLElement | null;
    expect(measureContainer).toBeTruthy();
    for (const node of Array.from(measureContainer!.querySelectorAll<HTMLElement>("[data-layout-measure]"))) {
        const height = heights[node.dataset.layoutMeasure || ""] ?? 0;
        Object.defineProperty(node, "offsetHeight", { configurable: true, get: () => height });
        node.getBoundingClientRect = () => createRect(height);
    }
}

export const SECTIONS = ["experience", "education", "skills", "projects"] as const;

export function twoColumnResume(
    placement: Record<string, "left" | "right" | "full">,
    mode: "two" | "mix" = "two",
    /** Configured sections with no content: not rendered, but present in the section list. */
    emptyAbove: string[] = [],
): Resume {
    const resume = createEmptyResume();
    resume.basics.name = "Jane Placement";
    resume.settings.layout.columns = mode;
    resume.settings.contentSections = [...emptyAbove, ...SECTIONS];
    resume.settings.layout.sectionOrder = [...emptyAbove, ...SECTIONS];
    resume.settings.layout.sectionPlacement = placement;
    resume.experience = [{
        id: "e1", hidden: false, company: "Acme", position: "Engineer", start: "2024-01", end: "Present",
        location: "", description: "Did things", highlights: [], skills: [], url: "", urlIcon: "auto",
    }];
    resume.education = [{
        id: "ed1", hidden: false, institution: "Uni", degree: "BSc", field: "CS", start: "2018-01", end: "2021-01",
        location: "", description: "Studied", highlights: [], url: "", urlIcon: "auto",
    } as never];
    resume.skillGroups = [{
        id: "ungrouped", name: "", hidden: false,
        skills: [{ id: "s1", hidden: false, name: "TypeScript", description: "", level: "", icon: "auto", display: "name", keywords: [] }],
    }];
    resume.projects = [{
        id: "p1", hidden: false, name: "Proj", subtitle: "", description: "Built", highlights: [], keywords: [], skills: [],
        start: "", end: "", url: "", urlIcon: "auto", repos: [], icon: "", visibility: "",
    } as never];
    return resume;
}

export function measurementHeights(): Record<string, number> {
    const heights: Record<string, number> = { "basic:profile": 80 };
    for (const section of SECTIONS) {
        heights[`${section}:heading`] = 30;
        heights[`${section}:entry:0`] = 40;
    }
    return heights;
}

/** Column the preview drew a section in: left (x = 0), right (x > 0), or full (spans the width). */
export function previewSide(container: HTMLElement, section: string): "left" | "right" | "full" {
    const items = Array.from(container.querySelectorAll<HTMLElement>("[data-preview-layout-item]"))
        .filter((node) => (node.dataset.previewLayoutItem ?? "").includes(section));
    expect(items.length, `preview item for ${section}`).toBeGreaterThan(0);
    const item = items[0];
    const left = parseFloat(item.style.left || "0");
    const pageWidth = Math.max(...Array.from(container.querySelectorAll<HTMLElement>("[data-preview-layout-item]")).map((n) => parseFloat(n.style.width || "0") + parseFloat(n.style.left || "0")));
    if (left > 0) return "right";
    return parseFloat(item.style.width || "0") >= pageWidth - 1 ? "full" : "left";
}

/** Side the section list shows as selected (the option with the accent border). */
export function toggleSide(section: string): string | null {
    const row = screen.getByTestId(`section-order-row-${section}`);
    const selected = within(row).getAllByRole("button").find((button) => button.className.includes("border-accent") && /^(Left|Right|Full)$/.test(button.textContent ?? ""));
    return selected ? (selected.textContent ?? "").toLowerCase() : null;
}

export async function renderEditor(resume: Resume) {
    const raf = installRafController();
    useResumeStore.setState({ resume, paperSize: "a4", sidebarTab: "content" });
    const view = render(
        <TooltipProvider>
            <EditorSidebar />
            <ResumePreview />
        </TooltipProvider>,
    );
    applyStructuredMeasurements(view.container, measurementHeights());
    await raf.flushAll();
    await waitFor(() => expect(view.container.querySelector("[data-preview-layout-item]")).not.toBeNull());
    const user = userEvent.setup();
    await user.click(screen.getByTestId("sidebar-tab-customize"));
    await user.click(screen.getByTestId("customize-row-layout"));
    await screen.findByTestId(`section-order-row-${SECTIONS[0]}`);
    return { ...view, user, raf };
}


/** Re-apply measurements and let the preview re-paginate after a change. */
export async function settle(container: HTMLElement, raf: { flushAll: () => Promise<void> }) {
    applyStructuredMeasurements(container, measurementHeights());
    await raf.flushAll();
    applyStructuredMeasurements(container, measurementHeights());
    await raf.flushAll();
}

/** Click one of a section's Left / Right / Full options in the section list. */
export async function clickSide(user: ReturnType<typeof userEvent.setup>, section: string, side: "Left" | "Right" | "Full") {
    const row = screen.getByTestId(`section-order-row-${section}`);
    const button = within(row).getAllByRole("button").find((candidate) => candidate.textContent === side);
    if (!button) throw new Error(`no ${side} option for ${section}`);
    await user.click(button);
}
