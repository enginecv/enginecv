import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n/translate";
import { OPEN_LINKED_FILE_PANEL_EVENT, INITIAL_LINKED_FILE_STATE, type LinkedFileState } from "@/lib/workspace/file-state";
import { useResumeStore } from "@/lib/store";

const grantAndAttach = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/linked-file/controller", () => ({ grantAndAttach: (id: string) => grantAndAttach(id) }));

const { LinkedFileNotice } = await import("./LinkedFileNotice");

function setLinked(patch: Partial<LinkedFileState>) {
    useResumeStore.setState({ linkedFile: { ...INITIAL_LINKED_FILE_STATE, ...patch } });
}

describe("LinkedFileNotice", () => {
    afterEach(() => {
        cleanup();
        grantAndAttach.mockClear();
        setLinked({});
    });

    it("stays out of the way for a CV that is not linked or is syncing", () => {
        setLinked({ status: "none" });
        const { rerender } = render(<LinkedFileNotice resumeId="cv-1" />);
        expect(screen.queryByTestId("linked-file-notice")).toBeNull();
        setLinked({ status: "in-sync", fileName: "cv.enginecv.json" });
        rerender(<LinkedFileNotice resumeId="cv-1" />);
        expect(screen.queryByTestId("linked-file-notice")).toBeNull();
    });

    it("tells the person syncing is paused and lets them resume with one click", () => {
        setLinked({ status: "needs-permission", fileName: "cv.enginecv.json" });
        render(<LinkedFileNotice resumeId="cv-1" />);

        expect(screen.getByTestId("linked-file-notice")).toHaveTextContent(
            translate("en", "linkedFile.notice.needsPermission.title", { name: "cv.enginecv.json" }),
        );
        fireEvent.click(screen.getByTestId("linked-file-notice-grant"));
        expect(grantAndAttach).toHaveBeenCalledWith("cv-1");
    });

    it("offers to link again when access is lost, by opening the link menu", () => {
        setLinked({ status: "broken", fileName: "cv.enginecv.json" });
        const opened = vi.fn();
        window.addEventListener(OPEN_LINKED_FILE_PANEL_EVENT, opened);
        render(<LinkedFileNotice resumeId="cv-1" />);

        fireEvent.click(screen.getByTestId("linked-file-notice-relink"));
        expect(opened).toHaveBeenCalledTimes(1);
        window.removeEventListener(OPEN_LINKED_FILE_PANEL_EVENT, opened);
    });

    it("can be dismissed", () => {
        setLinked({ status: "needs-permission", fileName: "cv.enginecv.json" });
        render(<LinkedFileNotice resumeId="cv-1" />);
        fireEvent.click(screen.getByTestId("linked-file-notice-dismiss"));
        expect(screen.queryByTestId("linked-file-notice")).toBeNull();
    });
});
