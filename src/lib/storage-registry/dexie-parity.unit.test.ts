import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ENGINECV_DATABASE, STORAGE_REGISTRY } from "./registry";

describe("registry and database stay in step", () => {
    it("registers the database under its real name", () => {
        expect(db.name).toBe(ENGINECV_DATABASE);
    });

    it("registers exactly the database's tables", () => {
        const registered = STORAGE_REGISTRY
            .filter((entry) => entry.location === "indexeddb-table")
            .map((entry) => entry.name)
            .sort();
        expect(db.tables.map((table) => table.name).sort()).toEqual(registered);
    });
});
