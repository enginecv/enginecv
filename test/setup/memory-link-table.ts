import { vi } from "vitest";
import { db, type LinkedFileRecord } from "@/lib/db";

/**
 * fake-indexeddb structured-clones records, which strips the methods off a fake
 * file handle. Real handles survive the clone, so for tests the `linkedFiles`
 * table is replaced by a Map that keeps the records as they are.
 */
export function installMemoryLinkTable() {
    const rows = new Map<string, LinkedFileRecord>();
    const table = db.linkedFiles;
    vi.spyOn(table, "get").mockImplementation((async (id: string) => rows.get(id)) as never);
    vi.spyOn(table, "toArray").mockImplementation((async () => [...rows.values()]) as never);
    vi.spyOn(table, "put").mockImplementation((async (record: LinkedFileRecord) => {
        rows.set(record.resumeId, record);
        return record.resumeId;
    }) as never);
    vi.spyOn(table, "update").mockImplementation((async (id: string, changes: Partial<LinkedFileRecord>) => {
        const row = rows.get(id);
        if (!row) return 0;
        rows.set(id, { ...row, ...changes });
        return 1;
    }) as never);
    vi.spyOn(table, "delete").mockImplementation((async (id: string) => {
        rows.delete(id);
    }) as never);
    return rows;
}
