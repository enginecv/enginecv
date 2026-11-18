import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { getBuiltinTemplates } from "@/lib/templates/enginecv-templates";
import { templateDocumentSchema } from "@/lib/templates/template-schema";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardTemplateCard } from "@/components/dashboard/DashboardTemplateCard";

const { pushMock } = vi.hoisted(() => ({
    pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: pushMock,
    }),
    useSearchParams: () => new URLSearchParams(),
}));

describe("DashboardTemplateCard", () => {
    beforeEach(async () => {
        await db.resumes.clear();
        await db.resumeHistory.clear();
        await db.templates.clear();
        pushMock.mockClear();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(async () => {
        cleanup();
        await db.resumes.clear();
        await db.resumeHistory.clear();
        await db.templates.clear();
    });

    it("uses a builtin template once and navigates to the new resume editor", async () => {
        const user = userEvent.setup();
        const template = getBuiltinTemplates()[0];

        render(
            <TooltipProvider>
                <DashboardTemplateCard
                    template={template}
                    onDuplicate={vi.fn()}
                    onDownload={vi.fn()}
                />
            </TooltipProvider>,
        );

        expect(screen.queryByRole("button", { name: "Edit design" })).not.toBeInTheDocument();
        await user.dblClick(screen.getByTestId("dashboard-template-use"));

        await waitFor(() => expect(pushMock).toHaveBeenCalledWith(expect.stringMatching(/^\/editor\//)));
        expect(pushMock).toHaveBeenCalledTimes(1);
        expect(await db.resumes.count()).toBe(1);
        const [resume] = await db.resumes.toArray();
        expect(resume.settings.colors).toEqual(template.settings.colors);
    });

    it("keeps user-template design editing as a secondary action", async () => {
        const user = userEvent.setup();
        const builtin = getBuiltinTemplates()[0];
        const template = templateDocumentSchema.parse({
            ...builtin,
            id: "dashboard-user-template",
            meta: {
                ...builtin.meta,
                source: "user",
            },
        });
        const onEdit = vi.fn();

        render(
            <TooltipProvider>
                <DashboardTemplateCard
                    template={template}
                    onDuplicate={vi.fn()}
                    onDownload={vi.fn()}
                    onEdit={onEdit}
                />
            </TooltipProvider>,
        );

        await user.click(screen.getByRole("button", { name: "Edit design" }));
        expect(onEdit).toHaveBeenCalledTimes(1);
        expect(await db.resumes.count()).toBe(0);
    });

    it("shows a built-in template as its pre-rendered image", () => {
        render(
            <TooltipProvider>
                <DashboardTemplateCard template={getBuiltinTemplates()[0]} onDuplicate={vi.fn()} />
            </TooltipProvider>,
        );

        const preview = screen.getByTestId("dashboard-template-preview");
        expect(preview.querySelector("img")).not.toBeNull();
        expect(screen.queryByTestId("template-live-preview")).not.toBeInTheDocument();
    });

    it("draws a template the person made with the real renderer, not a placeholder image", () => {
        const builtin = getBuiltinTemplates()[0];
        const template = templateDocumentSchema.parse({
            ...builtin,
            id: "dashboard-user-template",
            meta: { ...builtin.meta, source: "user" },
        });

        render(
            <TooltipProvider>
                <DashboardTemplateCard template={template} onDuplicate={vi.fn()} onEdit={vi.fn()} />
            </TooltipProvider>,
        );

        const preview = screen.getByTestId("dashboard-template-preview");
        expect(within(preview).getByTestId("template-live-preview")).toBeInTheDocument();
        expect(preview.querySelector("img")).toBeNull();
    });

    it("previews a saved template that predates newer settings", () => {
        const builtin = getBuiltinTemplates()[0];
        const settings: Record<string, unknown> = { ...builtin.settings };
        delete settings.interestsSection;
        delete settings.skillsSection;
        const legacy = { ...builtin, id: "legacy-user-template", meta: { ...builtin.meta, source: "user" }, settings } as unknown as typeof builtin;

        render(
            <TooltipProvider>
                <DashboardTemplateCard template={legacy} onDuplicate={vi.fn()} onEdit={vi.fn()} />
            </TooltipProvider>,
        );

        expect(screen.getByTestId("template-live-preview")).toBeInTheDocument();
    });
});
