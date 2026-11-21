import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeleteDocumentDialog } from "./DeleteDocumentDialog";

describe("DeleteDocumentDialog", () => {
    afterEach(cleanup);

    it("keeps the file unless told otherwise", () => {
        const onConfirm = vi.fn();
        render(<DeleteDocumentDialog name="Master CV" description="Delete it?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={vi.fn()} />);
        expect(screen.getByTestId("workspace-delete-keep")).toBeChecked();
        fireEvent.click(screen.getByTestId("workspace-delete-confirm"));
        expect(onConfirm).toHaveBeenCalledWith("keep-file");
    });

    it("deletes the file only when that option is chosen", () => {
        const onConfirm = vi.fn();
        render(<DeleteDocumentDialog name="Master CV" description="Delete it?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={vi.fn()} />);
        fireEvent.click(screen.getByTestId("workspace-delete-remove"));
        fireEvent.click(screen.getByTestId("workspace-delete-confirm"));
        expect(onConfirm).toHaveBeenCalledWith("delete-file");
    });

    it("cancel does nothing else", () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        render(<DeleteDocumentDialog name="x" description="d" confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} />);
        fireEvent.click(screen.getByTestId("workspace-delete-cancel"));
        expect(onCancel).toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
