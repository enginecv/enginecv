import { describe, expect, it } from "vitest";
import { adsTxtContent } from "./ads-txt";

describe("ads.txt publisher record", () => {
    it("uses the configured publisher ID", () => {
        expect(adsTxtContent("ca-pub-1234567890123456")).toBe("google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
    });
    it.each(["", "ca-pub-XXXX", "pub-1234567890123456", "ca-pub-123\nother.com, pub-456"])("refuses an invalid publisher ID: %s", (client) => {
        expect(adsTxtContent(client)).toBeNull();
    });
});
