import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { newDocRow } from "@/lib/workspace/workspace-store";
import { DocStateBadge } from "./DocStateBadge";

describe("DocStateBadge", () => {
    beforeEach(async () => {
        await db.workspaceDocs.clear();
    });
    afterEach(cleanup);

    it("shows nothing for a document that is in sync, paused, excluded or unknown", async () => {
        await db.workspaceDocs.put({ ...newDocRow({ docId: "a", kind: "cv", fileName: "a.cv.json" }, 1), state: "in-sync" });
        await db.workspaceDocs.put({ ...newDocRow({ docId: "b", kind: "cv", fileName: "b.cv.json" }, 1), state: "paused" });
        await db.workspaceDocs.put({ ...newDocRow({ docId: "c", kind: "cv", fileName: null, included: false }, 1), state: "blocked" });
        const { container } = render(<><DocStateBadge docId="a" /><DocStateBadge docId="b" /><DocStateBadge docId="c" /><DocStateBadge docId="zzz" /><DocStateBadge docId={null} /></>);
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(container.textContent).toBe("");
    });

    it("shows a chip with the reason when a document needs attention, and follows changes", async () => {
        await db.workspaceDocs.put({ ...newDocRow({ docId: "a", kind: "cv", fileName: "a.cv.json" }, 1), state: "blocked", reason: { code: "cut-off" } });
        render(<DocStateBadge docId="a" />);
        const chip = await screen.findByTestId("doc-state-blocked");
        expect(chip).toHaveAttribute("title", expect.stringContaining("cut off"));
        await db.workspaceDocs.update("a", { state: "in-sync", reason: null });
        await waitFor(() => expect(screen.queryByTestId("doc-state-blocked")).toBeNull());
    });
});
