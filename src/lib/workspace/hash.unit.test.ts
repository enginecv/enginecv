import { describe, expect, it } from "vitest";
import { hashText } from "./hash";

describe("hashText", () => {
    it("is stable", () => {
        expect(hashText("abc")).toBe(hashText("abc"));
    });
    it("ignores trailing newlines, CRLF and a BOM", () => {
        expect(hashText("a\nb\n")).toBe(hashText("a\r\nb"));
        expect(hashText("﻿a")).toBe(hashText("a\n\n"));
    });
    it("detects real changes", () => {
        expect(hashText("a")).not.toBe(hashText("b"));
        expect(hashText("a b")).not.toBe(hashText("ab"));
    });
});
