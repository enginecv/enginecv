import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, exportToJson } from "./export";

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

function mockObjectUrls() {
    const create = vi.fn(() => "blob:enginecv/download");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    return { create, revoke };
}

describe("downloadBlob", () => {
    it("keeps the object URL alive after the click so a download manager can still fetch it", () => {
        vi.useFakeTimers();
        const { revoke } = mockObjectUrls();

        downloadBlob(new Blob(["resume"], { type: "text/plain" }), "resume.txt");
        expect(revoke).not.toHaveBeenCalled();

        vi.advanceTimersByTime(59_000);
        expect(revoke).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1_000);
        expect(revoke).toHaveBeenCalledWith("blob:enginecv/download");
    });

    it("names the file and leaves no anchor behind", () => {
        vi.useFakeTimers();
        mockObjectUrls();
        const click = vi.mocked(HTMLAnchorElement.prototype.click);
        let downloadName = "";
        click.mockImplementation(function (this: HTMLAnchorElement) {
            downloadName = this.download;
        });

        exportToJson({ basics: { name: "Amina" } }, "resume-amina.json");

        expect(downloadName).toBe("resume-amina.json");
        expect(document.querySelectorAll("a[download]")).toHaveLength(0);
    });
});
