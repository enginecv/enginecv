import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HowItWorksPage from "./page";

vi.mock("next/navigation", () => ({
    usePathname: () => "/",
    useRouter: () => ({ prefetch: vi.fn(), push: vi.fn() }),
}));

describe("How it works page", () => {
    afterEach(cleanup);

    it("explains the folder with its four diagrams and the things an agent can do", () => {
        render(<HowItWorksPage />);
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("How the workspace folder works");
        for (const id of ["diagram-workspace-big-picture", "diagram-workspace-folder", "diagram-workspace-journey", "diagram-workspace-actions"]) {
            expect(screen.getByTestId(id)).toBeInTheDocument();
        }
        const actions = screen.getByTestId("diagram-workspace-actions");
        for (const action of ["Edit", "Create", "Export", "Be noticed"]) expect(within(actions).getByRole("heading", { name: action })).toBeInTheDocument();
        expect(screen.getByTestId("diagram-outcome-refused")).toHaveTextContent("the file is not overwritten");
    });

    it("says plainly that nothing is uploaded and where the limits are", () => {
        render(<HowItWorksPage />);
        expect(document.body.textContent).toMatch(/uploads nothing/i);
        expect(screen.getByRole("heading", { name: "Honest limits" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "privacy page" })).toHaveAttribute("href", "/privacy");
    });
});
