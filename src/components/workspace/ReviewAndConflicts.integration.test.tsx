import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConflictsDialog } from "./ConflictsDialog";
import { DocStateChip } from "./DocStateChip";
import { ReviewDialog } from "./ReviewDialog";

const review = { removed: ["Senior Engineer", "BSc"], keptCount: 2, previousCount: 12, at: 1 };

describe("review and conflicts dialogs", () => {
    afterEach(cleanup);

    it("lists what a held change removes and applies it", () => {
        const onApply = vi.fn();
        render(<ReviewDialog docTitle="Master CV" review={review} onApply={onApply} onKeepMine={vi.fn()} onClose={vi.fn()} />);
        const removed = screen.getByTestId("workspace-review-removed");
        expect(removed.textContent).toContain("Senior Engineer");
        expect(removed.textContent).toContain("+8");
        fireEvent.click(screen.getByTestId("workspace-review-apply"));
        expect(onApply).toHaveBeenCalledOnce();
    });

    it("asks before keeping the app's version over the file", () => {
        const onKeepMine = vi.fn();
        render(<ReviewDialog docTitle="Master CV" review={review} onApply={vi.fn()} onKeepMine={onKeepMine} onClose={vi.fn()} />);
        fireEvent.click(screen.getByTestId("workspace-review-keep"));
        expect(onKeepMine).not.toHaveBeenCalled();
        expect(screen.getByText(/Overwrite the file/)).toBeInTheDocument();
        const keepButtons = screen.getAllByRole("button", { name: "Keep my version" });
        fireEvent.click(keepButtons[keepButtons.length - 1]);
        expect(onKeepMine).toHaveBeenCalledOnce();
    });

    it("shows a state chip with the reason as its tooltip", () => {
        render(<DocStateChip state="blocked" reason={{ code: "cut-off" }} />);
        expect(screen.getByTestId("doc-state-blocked")).toHaveAttribute("title", expect.stringContaining("cut off"));
    });

    it("offers a choice for each duplicate file and ignores copies without touching them", () => {
        const onKeepFile = vi.fn();
        const onIgnore = vi.fn();
        render(
            <ConflictsDialog
                attention={{ unmatched: [], duplicates: [{ docId: "cv-1", kind: "cv", files: ["a.cv.json", "b.cv.json"] }], conflictCopies: [{ fileName: "a (conflicted copy).cv.json", baseName: "a.cv.json" } as never] }}
                detached={[]}
                onKeepFile={onKeepFile}
                onRelink={vi.fn()}
                onRecreate={vi.fn()}
                onIgnore={onIgnore}
                onClose={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByTestId("workspace-keep-b.cv.json"));
        expect(onKeepFile).toHaveBeenCalledWith("cv-1", "b.cv.json", ["a.cv.json"]);
        fireEvent.click(screen.getAllByText(/Ignore/)[0]);
        expect(onIgnore).toHaveBeenCalledWith("a (conflicted copy).cv.json");
    });

    it("says when nothing needs a look", () => {
        render(<ConflictsDialog attention={{ unmatched: [], duplicates: [], conflictCopies: [] }} detached={[]} onKeepFile={vi.fn()} onRelink={vi.fn()} onRecreate={vi.fn()} onIgnore={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByTestId("workspace-conflicts-empty")).toBeInTheDocument();
    });
});
