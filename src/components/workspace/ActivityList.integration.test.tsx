import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { recordResumeHistory } from "@/lib/history";
import { useI18nStore } from "@/lib/i18n";
import { recordLetterHistory } from "@/lib/letters/history";
import { useResumeStore } from "@/lib/store";
import { addActivity } from "@/lib/workspace/workspace-store";
import { makeLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { ActivityList } from "./ActivityList";
import { DocStateChip, OPEN_WORKSPACE_ACTIVITY_EVENT } from "./DocStateChip";

const titleOf = (id: string) => ({ "cv-1": "Master CV", "l-1": "Acme letter" })[id] ?? id;
const row = (over: Partial<Parameters<typeof addActivity>[0]> = {}) => addActivity({ at: Date.now(), docId: "cv-1", kind: "accepted", reason: { code: "applied", detail: "+1/-0/~2" }, restoreId: null, restoreKind: null, ...over });

describe("ActivityList", () => {
    beforeEach(async () => {
        await resetLetterTables();
        await db.workspaceActivity.clear();
        await db.resumeHistory.clear();
        await db.letterHistory.clear();
        useResumeStore.setState({ activeResumeId: null, isDirty: false });
        act(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
        await db.coverLetters.put(makeLetter({ id: "l-1", cvId: "cv-1", title: "Acme letter" }));
    });
    afterEach(cleanup);

    it("says so when there is nothing yet", async () => {
        render(<ActivityList titleOf={titleOf} onClose={() => undefined} />);
        expect(await screen.findByTestId("workspace-activity-empty")).toBeInTheDocument();
    });

    it("lists accepted, refused and review entries newest first, each with a one-line reason", async () => {
        await row({ at: 1000, kind: "accepted" });
        await row({ at: 2000, kind: "refused", reason: { code: "cut-off" } });
        await row({ at: 3000, kind: "review", reason: { code: "shrink-guard", detail: "2 of 12 kept" } });
        render(<ActivityList titleOf={titleOf} onClose={() => undefined} />);
        const rows = await screen.findAllByTestId("workspace-activity-row");
        expect(rows.map((item) => item.getAttribute("data-kind"))).toEqual(["review", "refused", "accepted"]);
        expect(rows[1]).toHaveTextContent("The file looks cut off");
        expect(rows[0]).toHaveTextContent("Master CV");
        expect(rows[1].querySelector("[data-testid^=workspace-activity-undo-]")).toBeNull(); // only accepted rows undo
    });

    it("loads 50 first and older ones on request", async () => {
        for (let index = 0; index < 120; index += 1) await row({ at: index });
        render(<ActivityList titleOf={titleOf} onClose={() => undefined} />);
        expect(await screen.findAllByTestId("workspace-activity-row")).toHaveLength(50);
        fireEvent.click(screen.getByTestId("workspace-activity-older"));
        await waitFor(() => expect(screen.getAllByTestId("workspace-activity-row")).toHaveLength(100));
        fireEvent.click(screen.getByTestId("workspace-activity-older"));
        await waitFor(() => expect(screen.getAllByTestId("workspace-activity-row")).toHaveLength(120));
        expect(screen.queryByTestId("workspace-activity-older")).toBeNull();
    });

    it("shows only one document's entries when asked", async () => {
        await row({ docId: "cv-1" });
        await row({ docId: "l-1" });
        render(<ActivityList docId="l-1" titleOf={titleOf} onClose={() => undefined} />);
        expect(await screen.findAllByTestId("workspace-activity-row")).toHaveLength(1);
        expect(screen.getByTestId("workspace-activity-filter")).toHaveTextContent("Acme letter");
    });

    it("undoes an accepted CV change: the earlier content returns, a restore point of the present is kept", async () => {
        const original = (await db.resumes.get("cv-1"))!;
        const before = { ...original, basics: { ...original.basics, headline: "Before the agent" } };
        const restoreId = await recordResumeHistory(before as never, "file-sync");
        await db.resumes.put({ ...original, basics: { ...original.basics, headline: "After the agent" }, updatedAt: original.updatedAt + 5 });
        const id = await row({ restoreId, restoreKind: "cv" });
        render(<ActivityList titleOf={titleOf} onClose={() => undefined} />);
        fireEvent.click(await screen.findByTestId(`workspace-activity-undo-${id}`));
        await waitFor(() => expect(screen.getByTestId(`workspace-activity-undone-${id}`)).toBeInTheDocument());
        expect((await db.resumes.get("cv-1"))?.basics.headline).toBe("Before the agent");
        const history = await db.resumeHistory.where("resumeId").equals("cv-1").toArray();
        expect(history.some((entry) => entry.trigger === "restore" && entry.resumeJson.includes("After the agent"))).toBe(true); // the undo can be undone
        expect((await db.workspaceActivity.toArray()).some((entry) => entry.reason.code === "undone")).toBe(true);
        expect(screen.queryByTestId(`workspace-activity-undo-${id}`)).toBeNull(); // not twice
    });

    it("keeps the design when it undoes content", async () => {
        const original = (await db.resumes.get("cv-1"))!;
        const restoreId = await recordResumeHistory({ ...original, basics: { ...original.basics, headline: "Old text" } } as never, "file-sync");
        await db.resumes.put({ ...original, settings: { ...original.settings, colors: { ...original.settings.colors, accent: "#123456" } }, updatedAt: original.updatedAt + 5 });
        const id = await row({ restoreId, restoreKind: "cv" });
        render(<ActivityList titleOf={titleOf} onClose={() => undefined} />);
        fireEvent.click(await screen.findByTestId(`workspace-activity-undo-${id}`));
        await waitFor(() => expect(screen.getByTestId(`workspace-activity-undone-${id}`)).toBeInTheDocument());
        const after = (await db.resumes.get("cv-1"))!;
        expect(after.basics.headline).toBe("Old text");
        expect(after.settings.colors.accent).toBe("#123456");
    });

    it("undoes a letter change", async () => {
        const original = (await db.coverLetters.get("l-1"))!;
        const restoreId = await recordLetterHistory({ ...original, subject: "Before" }, "file-sync");
        await db.coverLetters.put({ ...original, subject: "After", updatedAt: original.updatedAt + 5 });
        const id = await row({ docId: "l-1", restoreId, restoreKind: "letter" });
        render(<ActivityList titleOf={titleOf} onClose={() => undefined} />);
        fireEvent.click(await screen.findByTestId(`workspace-activity-undo-${id}`));
        await waitFor(() => expect(screen.getByTestId(`workspace-activity-undone-${id}`)).toBeInTheDocument());
        expect((await db.coverLetters.get("l-1"))?.subject).toBe("Before");
    });

    it("says so when the earlier version is gone, and changes nothing", async () => {
        const id = await row({ restoreId: 9999, restoreKind: "cv" });
        const before = JSON.stringify(await db.resumes.get("cv-1"));
        render(<ActivityList titleOf={titleOf} onClose={() => undefined} />);
        fireEvent.click(await screen.findByTestId(`workspace-activity-undo-${id}`));
        expect(await screen.findByTestId("workspace-activity-undo-failed")).toBeInTheDocument();
        expect(JSON.stringify(await db.resumes.get("cv-1"))).toBe(before);
    });

    it("undoes through the open editor so its own save cannot bring the old content back", async () => {
        const original = (await db.resumes.get("cv-1"))!;
        const restoreId = await recordResumeHistory({ ...original, basics: { ...original.basics, headline: "Old text" } } as never, "file-sync");
        useResumeStore.setState({ activeResumeId: "cv-1", resume: { ...original, basics: { ...original.basics, headline: "Newer text" } } as never, isDirty: false });
        const id = await row({ restoreId, restoreKind: "cv" });
        render(<ActivityList titleOf={titleOf} onClose={() => undefined} />);
        fireEvent.click(await screen.findByTestId(`workspace-activity-undo-${id}`));
        await waitFor(() => expect(screen.getByTestId(`workspace-activity-undone-${id}`)).toBeInTheDocument());
        expect(useResumeStore.getState().resume.basics.headline).toBe("Old text");
        expect((await db.resumes.get("cv-1"))?.basics.headline).toBe("Old text");
    });
});

describe("a state chip on a card", () => {
    afterEach(cleanup);

    it("opens the activity list for its document", () => {
        const seen: string[] = [];
        const listener = (event: Event) => seen.push((event as CustomEvent<{ docId: string }>).detail.docId);
        window.addEventListener(OPEN_WORKSPACE_ACTIVITY_EVENT, listener);
        render(<DocStateChip state="blocked" reason={{ code: "cut-off" }} docId="cv-1" />);
        fireEvent.click(screen.getByTestId("doc-state-blocked"));
        window.removeEventListener(OPEN_WORKSPACE_ACTIVITY_EVENT, listener);
        expect(seen).toEqual(["cv-1"]);
    });

    it("is plain text where there is nowhere to open it (the editor header)", () => {
        render(<DocStateChip state="blocked" reason={{ code: "cut-off" }} />);
        expect(screen.getByTestId("doc-state-blocked").tagName).toBe("SPAN");
    });
});
