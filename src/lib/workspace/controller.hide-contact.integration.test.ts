import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";

let current = createMemoryDirectory("applications");
vi.mock("./directory-adapter", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./directory-adapter")>();
    return { ...actual, isWorkspaceSupported: () => true, createDirectoryAdapter: () => actual.createDirectoryAdapter(current.root as unknown as FileSystemDirectoryHandle) };
});
vi.mock("./leader", () => ({
    createLeader: () => ({ start() {}, stop() {}, isLeader: true, onChange: (listener: (value: boolean) => void) => { listener(true); return () => undefined; }, nudge() {}, onNudge: () => () => undefined }),
}));

const STAND_IN = { kind: "directory", name: "applications" } as unknown as FileSystemDirectoryHandle;
const FILE = "cvs/Master CV.cv.json";
const email = () => makeWorkspaceCv().basics.email;

describe("workspace controller: leaving contact details out", () => {
    beforeEach(async () => {
        (await import("./controller")).resetWorkspaceController();
        current = createMemoryDirectory("applications");
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
        await db.resumes.put(makeWorkspaceCv({ id: "cv-2", title: "Second CV" }));
    });
    afterEach(async () => {
        (await import("./controller")).resetWorkspaceController();
    });

    async function connect() {
        const controller = await import("./controller");
        const options = { hideContact: false, now: 1 };
        await controller.connectFolder({ handle: STAND_IN, analysis: await controller.analyzeFolderHandle(STAND_IN, options), options });
        await new Promise((resolve) => setTimeout(resolve, 100));
        return controller;
    }

    it("rewrites every file without contact details, keeps them in the app, and restores them when turned off", async () => {
        const controller = await connect();
        expect(await current.readExternal(FILE)).toContain(email());

        await controller.setHideContact(true);
        for (const file of [FILE, "cvs/Second CV.cv.json"]) {
            const text = (await current.readExternal(file))!;
            expect(text).not.toContain(email());
            expect(() => JSON.parse(text)).not.toThrow();
        }
        expect((await db.resumes.get("cv-1"))?.basics.email).toBe(email()); // the app still has them
        expect((await db.workspace.get("current"))?.hideContact).toBe(true);
        expect(controller.useWorkspaceStore.getState().rewriting).toBeNull();

        await controller.setHideContact(false);
        expect(await current.readExternal(FILE)).toContain(email());
        expect((await current.listExternal("cvs")).filter((name) => name.endsWith(".crswap"))).toEqual([]);
    });

    it("reports progress while rewriting and leaves a blocked file alone", async () => {
        const controller = await connect();
        const seen: Array<{ done: number; total: number } | null> = [];
        const unsubscribe = controller.useWorkspaceStore.subscribe((state) => seen.push(state.rewriting));
        const broken = "{ half a fi";
        await current.writeExternal("cvs/Second CV.cv.json", broken);
        await controller.getRuntime()?.checkNow();
        await controller.setHideContact(true);
        unsubscribe();
        expect(seen.some((value) => value && value.total === 2 && value.done === 2) || seen.some((value) => value && value.total >= 1)).toBe(true);
        expect(await current.readExternal("cvs/Second CV.cv.json")).toBe(broken);
        expect(await current.readExternal(FILE)).not.toContain(email());
    });

    it("does nothing when the option is already as asked", async () => {
        const controller = await connect();
        const before = await current.readExternal(FILE);
        await controller.setHideContact(false);
        expect(await current.readExternal(FILE)).toBe(before);
    });
});
