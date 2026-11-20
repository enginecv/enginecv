import { beforeEach, describe, expect, it } from "vitest";
import { GROUP_WINDOW_MS, MAX_NOTICES, useNotices } from "./notices";

const push = (notice: Parameters<ReturnType<typeof useNotices.getState>["push"]>[0], now: number) => useNotices.getState().push(notice, now);
const list = () => useNotices.getState().notices;

describe("agent notices", () => {
    beforeEach(() => useNotices.getState().clear());

    it("groups edits to one document by one agent into a single notice with summed counts", () => {
        push({ kind: "edited", docId: "a", title: "Master", agent: "Claude Code", added: 1, changed: 2, activityId: 5 }, 1000);
        push({ kind: "edited", docId: "a", title: "Master", agent: "Claude Code", removed: 3, activityId: 6 }, 3000);
        expect(list()).toHaveLength(1);
        expect(list()[0]).toMatchObject({ count: 2, added: 1, removed: 3, changed: 2, activityId: 6 });
    });

    it("keeps separate notices for another document, another agent, or after the window", () => {
        push({ kind: "edited", docId: "a", title: "A", agent: "Codex" }, 1000);
        push({ kind: "edited", docId: "b", title: "B", agent: "Codex" }, 1500);
        push({ kind: "edited", docId: "a", title: "A", agent: null }, 1600);
        push({ kind: "edited", docId: "a", title: "A", agent: "Codex" }, 1000 + GROUP_WINDOW_MS + 1);
        expect(list()).toHaveLength(4);
    });

    it("lets a repeated problem replace itself, and keeps problems on screen until dismissed", () => {
        push({ kind: "refused", docId: "a", title: "A", code: "invalid-json" }, 1);
        push({ kind: "refused", docId: "a", title: "A", code: "invalid-json" }, 2);
        expect(list()).toHaveLength(1);
        expect(list()[0].sticky).toBe(true);
        const [only] = list();
        useNotices.getState().dismiss(only.id);
        expect(list()).toHaveLength(0);
    });

    it("never shows more than a few, dropping the oldest ordinary one first", () => {
        push({ kind: "review", docId: "r", title: "R", code: "shrink-guard" }, 1);
        for (let i = 0; i < MAX_NOTICES + 2; i += 1) push({ kind: "created", docId: `c${i}`, title: `C${i}` }, 10 + i);
        expect(list()).toHaveLength(MAX_NOTICES);
        expect(list().some((entry) => entry.kind === "review")).toBe(true);
    });
});
