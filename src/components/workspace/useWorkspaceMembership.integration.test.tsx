import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { newDocRow } from "@/lib/workspace/workspace-store";
import { useWorkspaceMembership } from "./useWorkspaceMembership";

const exclude = vi.fn();
const include = vi.fn(async (_id: string, _choice: string) => true);
let phase = "connected";
vi.mock("@/lib/workspace/controller", () => ({
    useWorkspaceStore: (select: (state: { phase: string }) => unknown) => select({ phase }),
    excludeFromWorkspace: (id: string) => exclude(id),
    includeInWorkspace: (id: string, choice: string) => include(id, choice),
}));

function Probe({ docId }: { docId: string }) {
    const { item, dialog } = useWorkspaceMembership(docId);
    return <div>{item && <button type="button" onClick={item.onClick} data-testid={item.testId}>{item.label}</button>}{dialog}</div>;
}

describe("useWorkspaceMembership", () => {
    beforeEach(async () => {
        phase = "connected";
        exclude.mockClear();
        include.mockClear();
        await db.workspaceDocs.clear();
    });
    afterEach(cleanup);

    it("offers nothing without a connected folder or a known document", async () => {
        await db.workspaceDocs.put(newDocRow({ docId: "a", kind: "cv", fileName: "a.cv.json" }, 1));
        phase = "none";
        const { container } = render(<Probe docId="a" />);
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(container.textContent).toBe("");
        cleanup();
        phase = "connected";
        const second = render(<Probe docId="missing" />);
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(second.container.textContent).toBe("");
    });

    it("leaves an included document out in one click", async () => {
        await db.workspaceDocs.put(newDocRow({ docId: "a", kind: "cv", fileName: "a.cv.json" }, 1));
        render(<Probe docId="a" />);
        fireEvent.click(await screen.findByTestId("workspace-menu-exclude"));
        expect(exclude).toHaveBeenCalledWith("a");
    });

    it("asks which version wins when adding back a document that has a file", async () => {
        await db.workspaceDocs.put(newDocRow({ docId: "a", kind: "cv", fileName: "a.cv.json", included: false }, 1));
        render(<Probe docId="a" />);
        fireEvent.click(await screen.findByTestId("workspace-menu-include"));
        expect(include).not.toHaveBeenCalled();
        fireEvent.click(await screen.findByTestId("workspace-include-file"));
        await waitFor(() => expect(include).toHaveBeenCalledWith("a", "use-file"));
    });

    it("adds back a document that never had a file without asking", async () => {
        await db.workspaceDocs.put(newDocRow({ docId: "b", kind: "cv", fileName: null, included: false }, 1));
        render(<Probe docId="b" />);
        fireEvent.click(await screen.findByTestId("workspace-menu-include"));
        expect(include).toHaveBeenCalledWith("b", "keep-app");
    });
});
