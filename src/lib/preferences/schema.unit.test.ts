import { describe, expect, it } from "vitest";
import { clientPreferencesSchema } from "./schema";

describe("JSON editor preferences", () => {
    it("defaults older preference objects without adding a storage item", () => {
        expect(clientPreferencesSchema.parse({ editor: { autoSave: false } }).editor).toMatchObject({
            autoSave: false, jsonEditor: { vim: false, hideInternal: true, applyMode: "save" },
        });
        expect(clientPreferencesSchema.parse({}).editor.jsonEditor).toEqual({ vim: false, hideInternal: true, applyMode: "save" });
    });
    it("keeps explicit toggles and fills missing nested defaults", () => {
        expect(clientPreferencesSchema.parse({ editor: { jsonEditor: { vim: true } } }).editor.jsonEditor).toEqual({ vim: true, hideInternal: true, applyMode: "save" });
    });
});
