import { describe, expect, it } from "vitest";
import { resolveExternalHref } from "./external-links";

describe("resolveExternalHref", () => {
    it("preserves supported schemes regardless of casing and trims whitespace", () => {
        expect(resolveExternalHref("  HTTPS://example.com/profile  ")).toBe("HTTPS://example.com/profile");
        expect(resolveExternalHref("mailto:person@example.com")).toBe("mailto:person@example.com");
        expect(resolveExternalHref("tel:+38761123456")).toBe("tel:+38761123456");
    });

    it("adds https to bare and protocol-relative external links", () => {
        expect(resolveExternalHref("example.com/profile")).toBe("https://example.com/profile");
        expect(resolveExternalHref("//example.com/profile")).toBe("https://example.com/profile");
    });

    it("keeps empty values empty", () => {
        expect(resolveExternalHref("   ")).toBe("");
    });
});
