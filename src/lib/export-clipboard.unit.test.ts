import { afterEach, describe, expect, it, vi } from "vitest";
import { toDocumentModel } from "./document-model";
import { ClipboardDeniedError, copyResumeToClipboard, copyTextToClipboard } from "./export-clipboard";
import { toHtmlFragment } from "./export-html-fragment";
import { createQaFullResume } from "./qa/sample-resumes";

const model = toDocumentModel(createQaFullResume());

function mockClipboard(clipboard: Partial<Clipboard> | undefined) {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
}

function domError(name: string) {
    const error = new Error(name);
    error.name = name;
    return error;
}

afterEach(() => {
    vi.unstubAllGlobals();
    mockClipboard(undefined);
});

describe("toHtmlFragment", () => {
    it("emits semantic markup for the resume", () => {
        const html = toHtmlFragment(model, "#b84a24");
        expect(html).toContain(`<h1 style="color:#b84a24">`);
        expect(html).toMatch(/<h2[^>]*>/);
        expect(html).toContain("<strong>replication</strong>");
        expect(html).toContain('<a href="https://example.com/runbook">runbook</a>');
        expect(html).toContain("<ul><li>");
        expect(html).not.toMatch(/<script|<style/i);
    });

    it("escapes user text and drops unsafe links", () => {
        const hostile = structuredClone(model);
        hostile.basics.name = "<script>alert(1)</script>";
        hostile.basics.summary = "[x](javascript:void)";
        const html = toHtmlFragment(hostile);
        expect(html).toContain("&lt;script&gt;");
        expect(html).not.toContain("<script>");
        expect(html).not.toContain("javascript:");
    });
});

describe("copyResumeToClipboard", () => {
    it("writes rich and plain payloads when supported", async () => {
        const write = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("ClipboardItem", class { constructor(public items: Record<string, Blob>) {} });
        mockClipboard({ write, writeText: vi.fn() });

        await expect(copyResumeToClipboard(model)).resolves.toBe("rich");
        const [[items]] = write.mock.calls;
        expect(Object.keys(items[0].items).sort()).toEqual(["text/html", "text/plain"]);
    });

    it("falls back to plain text without ClipboardItem", async () => {
        vi.stubGlobal("ClipboardItem", undefined);
        const writeText = vi.fn().mockResolvedValue(undefined);
        mockClipboard({ writeText });

        await expect(copyResumeToClipboard(model)).resolves.toBe("plain");
        expect(writeText.mock.calls[0][0]).toContain(model.basics.name);
    });

    it("falls back to plain text when a rich write fails for another reason", async () => {
        vi.stubGlobal("ClipboardItem", class { constructor(public items: Record<string, Blob>) {} });
        const writeText = vi.fn().mockResolvedValue(undefined);
        mockClipboard({ write: vi.fn().mockRejectedValue(domError("DataError")), writeText });

        await expect(copyResumeToClipboard(model)).resolves.toBe("plain");
    });

    it("reports denied access", async () => {
        vi.stubGlobal("ClipboardItem", class { constructor(public items: Record<string, Blob>) {} });
        mockClipboard({ write: vi.fn().mockRejectedValue(domError("NotAllowedError")), writeText: vi.fn() });
        await expect(copyResumeToClipboard(model)).rejects.toBeInstanceOf(ClipboardDeniedError);

        vi.stubGlobal("ClipboardItem", undefined);
        mockClipboard({ writeText: vi.fn().mockRejectedValue(domError("NotAllowedError")) });
        await expect(copyResumeToClipboard(model)).rejects.toBeInstanceOf(ClipboardDeniedError);
    });
});

describe("copyTextToClipboard", () => {
    it("writes the payload as plain text only", async () => {
        const write = vi.fn();
        const writeText = vi.fn().mockResolvedValue(undefined);
        mockClipboard({ write, writeText });

        await copyTextToClipboard("# Heading");
        expect(writeText).toHaveBeenCalledWith("# Heading");
        expect(write).not.toHaveBeenCalled();
    });

    it("reports denied or missing clipboard access", async () => {
        mockClipboard({ writeText: vi.fn().mockRejectedValue(domError("NotAllowedError")) });
        await expect(copyTextToClipboard("x")).rejects.toBeInstanceOf(ClipboardDeniedError);

        mockClipboard(undefined);
        await expect(copyTextToClipboard("x")).rejects.toBeInstanceOf(ClipboardDeniedError);
    });
});
