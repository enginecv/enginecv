import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MigrationPrompt } from "./MigrationPrompt";

describe("MigrationPrompt", () => {
    afterEach(cleanup);

    it("renders nothing when no CV is linked", () => {
        const { container } = render(<MigrationPrompt count={0} variant="banner" />);
        expect(container.textContent).toBe("");
    });

    it("says it plainly, in singular and plural, and promises the old file is untouched", () => {
        const { rerender } = render(<MigrationPrompt count={1} variant="banner" />);
        expect(screen.getByTestId("migration-banner")).toHaveTextContent(/1 CV is still linked/);
        expect(screen.getByTestId("migration-banner")).toHaveTextContent(/untouched/);
        rerender(<MigrationPrompt count={3} variant="banner" />);
        expect(screen.getByTestId("migration-banner")).toHaveTextContent(/3 CVs are still linked/);
    });

    it("asks only on a click, and Not now does nothing else", () => {
        const onMove = vi.fn();
        const onLater = vi.fn();
        render(<MigrationPrompt count={2} variant="banner" onMove={onMove} onLater={onLater} />);
        expect(onMove).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId("migration-later"));
        expect(onLater).toHaveBeenCalledOnce();
        expect(onMove).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId("migration-move"));
        expect(onMove).toHaveBeenCalledOnce();
    });

    it("disables both buttons while moving and reports anything that stayed linked", () => {
        render(<MigrationPrompt count={2} variant="banner" busy failed={1} />);
        expect(screen.getByTestId("migration-move")).toBeDisabled();
        expect(screen.getByTestId("migration-later")).toBeDisabled();
        expect(screen.getByTestId("migration-failed")).toHaveTextContent(/1 could not be moved/);
    });

    it("explains inline without buttons", () => {
        render(<MigrationPrompt count={1} variant="inline" />);
        expect(screen.getByTestId("migration-inline")).toBeInTheDocument();
        expect(screen.queryByTestId("migration-move")).toBeNull();
    });
});
