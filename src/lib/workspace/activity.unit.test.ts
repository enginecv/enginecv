import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { LOG_CAP, appendLog, clearRefusal, recordActivity, writeRefusal } from "./activity";
import { createDirectoryAdapter } from "./directory-adapter";

const adapterFor = () => {
    const dir = createMemoryDirectory();
    return { dir, adapter: createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle) };
};

describe("workspace activity, log and refusal notes", () => {
    beforeEach(async () => {
        await db.workspaceActivity.clear();
    });

    it("records outcomes with a reason code and a restore link", async () => {
        await recordActivity({ docId: "cv-1", kind: "accepted", code: "empty", restoreId: 7, restoreKind: "cv", now: 5 });
        const [row] = await db.workspaceActivity.toArray();
        expect(row).toMatchObject({ docId: "cv-1", kind: "accepted", restoreId: 7, restoreKind: "cv", at: 5, reason: { code: "empty" } });
    });

    it("appends log lines and keeps only the newest", async () => {
        const { adapter, dir } = adapterFor();
        for (let i = 0; i < LOG_CAP + 10; i++) await appendLog(adapter, { at: 1000 + i, doc: "cv-1", file: "a.cv.json", outcome: "refused", code: "cut-off", line: i });
        const lines = ((await dir.readExternal(".enginecv/log.ndjson"))!).trim().split("\n");
        expect(lines).toHaveLength(LOG_CAP);
        expect(JSON.parse(lines[lines.length - 1])).toMatchObject({ doc: "cv-1", code: "cut-off", outcome: "refused" });
        expect(JSON.parse(lines[0]).line).toBe(10);
    }, 30_000);

    it("tells an agent why a file was refused, then clears the note when the file is fine", async () => {
        const { adapter, dir } = adapterFor();
        await writeRefusal(adapter, { docId: "cv-1", file: "cvs/a.cv.json", code: "invalid-json", line: 12, column: 3, now: 0 });
        expect(JSON.parse((await dir.readExternal(".enginecv/results/cv-1.refused.json"))!)).toMatchObject({ doc: "cv-1", file: "cvs/a.cv.json", refused: true, code: "invalid-json", line: 12, column: 3 });
        await clearRefusal(adapter, "cv-1");
        expect(await dir.readExternal(".enginecv/results/cv-1.refused.json")).toBeNull();
        await clearRefusal(adapter, "cv-1"); // nothing to clear is fine
    });

    it("never writes document text anywhere", async () => {
        const { adapter, dir } = adapterFor();
        const secret = makeWorkspaceCv({ name: "Secret Person Name" });
        await recordActivity({ docId: secret.id!, kind: "refused", code: "shrink-guard", detail: "3 of 10 kept" });
        await appendLog(adapter, { at: 1, doc: secret.id!, file: "cvs/a.cv.json", outcome: "review", code: "shrink-guard" });
        await writeRefusal(adapter, { docId: secret.id!, file: "cvs/a.cv.json", code: "shrink-guard" });
        const everything = JSON.stringify(await db.workspaceActivity.toArray()) + (await dir.readExternal(".enginecv/log.ndjson")) + (await dir.readExternal(`.enginecv/results/${secret.id}.refused.json`));
        expect(everything).not.toContain("Secret Person Name");
        expect(everything).not.toContain("amina@example.com");
    });
});
