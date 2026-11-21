import { describe, expect, it } from "vitest";
import { blobBytes } from "./export-runner";

describe("blobBytes", () => {
    it("reads a blob that has arrayBuffer (a real browser) without recursing", async () => {
        const blob = { arrayBuffer: async () => new Uint8Array([80, 75, 3, 4]).buffer } as unknown as Blob;
        expect(Array.from(await blobBytes(blob))).toEqual([80, 75, 3, 4]);
    });
});
