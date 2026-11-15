import { afterEach, describe, expect, it, vi } from "vitest";
import { toDocumentModel } from "./document-model";
import { ClipboardDeniedError, copyResumeToClipboard, copyTextToClipboard } from "./export-clipboard";
import { toHtmlFragment } from "./export-html-fragment";
import { createQaFullResume } from "./qa/sample-resumes";

const model = toDocumentModel(createQaFullResume());

function readBlob(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(blob);
    });
}

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

describe("copyTextToClipboard with a promise", () => {
    it("hands the clipboard a promised item so Safari keeps the user gesture", async () => {
        let resolveText: (value: string) => void = () => undefined;
        const text = new Promise<string>((resolve) => { resolveText = resolve; });
        const write = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("ClipboardItem", class { constructor(public items: Record<string, Promise<Blob>>) {} });
        mockClipboard({ write, writeText: vi.fn() });

        const done = copyTextToClipboard(text);
        // The write started before the text existed.
        expect(write).toHaveBeenCalledTimes(1);
        resolveText("<html></html>");
        await done;

        const item = write.mock.calls[0][0][0] as unknown as { items: Record<string, Promise<Blob>> };
        expect(await readBlob(await item.items["text/plain"])).toBe("<html></html>");
    });

    it("waits for the text first where promised items are not supported", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        mockClipboard({ writeText });

        await copyTextToClipboard(Promise.resolve("<html></html>"));

        expect(writeText).toHaveBeenCalledWith("<html></html>");
    });

    it("falls back to writeText when the promised write is rejected for a non-permission reason", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("ClipboardItem", class { constructor(public items: Record<string, Promise<Blob>>) {} });
        mockClipboard({ write: vi.fn().mockRejectedValue(domError("DataError")), writeText });

        await copyTextToClipboard(Promise.resolve("x"));

        expect(writeText).toHaveBeenCalledWith("x");
    });

    it("reports a denied clipboard", async () => {
        vi.stubGlobal("ClipboardItem", class { constructor(public items: Record<string, Promise<Blob>>) {} });
        mockClipboard({ write: vi.fn().mockRejectedValue(domError("NotAllowedError")), writeText: vi.fn() });

        await expect(copyTextToClipboard(Promise.resolve("x"))).rejects.toBeInstanceOf(ClipboardDeniedError);
    });

    it("lets an error from building the text surface unchanged", async () => {
        vi.stubGlobal("ClipboardItem", class { constructor(public items: Record<string, Promise<Blob>>) {} });
        mockClipboard({ write: vi.fn().mockRejectedValue(new Error("build failed")), writeText: vi.fn() });
        const failing = Promise.reject(new Error("build failed"));
        failing.catch(() => undefined);

        await expect(copyTextToClipboard(failing)).rejects.toThrow("build failed");
    });
});
