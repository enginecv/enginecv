import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
});
