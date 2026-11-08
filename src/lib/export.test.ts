import { afterEach, describe, expect, it, vi } from "vitest";
import { __testing, createEncryptedJsonExport, getResumeImportErrorDetails, importResumeFromJsonText, ResumeImportError } from "./export";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("export preview parity", () => {
    it("clones preview pages with fixed intrinsic sizing and summary markers intact", () => {
        const page = document.createElement("div");
        page.className = "resume-page";
        page.dataset.previewPage = "2";
        page.setAttribute("data-testid", "resume-preview-page-2");
        page.style.width = "794px";
        page.style.height = "1123px";
        page.style.zoom = "0.82";

        const summary = document.createElement("section");
        summary.dataset.summaryLayout = "standalone";
        summary.setAttribute("data-testid", "resume-preview-summary");
        summary.textContent = "Summary";
        page.appendChild(summary);

        const clone = __testing.preparePageForPrint(page);

        expect(clone.classList.contains("print-exact-page-wrapper")).toBe(true);
        expect(clone.dataset.previewPage).toBe("2");
        expect(clone.getAttribute("data-testid")).toBe("resume-preview-page-2");
        expect(clone.querySelector('[data-testid="resume-preview-summary"]')).toHaveAttribute("data-summary-layout", "standalone");
        expect(clone.style.zoom).toBe("1");
        expect(clone.style.width).toBe("794px");
        expect(clone.style.height).toBe("1123px");
        expect(clone.style.minHeight).toBe("1123px");
        expect(clone.style.maxHeight).toBe("1123px");
        // Paint containment stripped so Chrome prints selectable text, not a raster.
        expect(clone.style.contain).toBe("none");
    });

    it("turns faded text into a faded colour so it keeps its place in the text stream", () => {
        const page = document.createElement("div");
        page.className = "resume-page";
        page.style.width = "794px";
        page.style.height = "1123px";

        const headline = document.createElement("p");
        headline.style.opacity = "0.8";
        headline.style.color = "rgb(0, 0, 0)";
        headline.textContent = "Staff Engineer";
        page.appendChild(headline);

        const badge = document.createElement("span");
        badge.style.opacity = "0.5";
        badge.style.color = "rgb(0, 0, 0)";
        badge.style.backgroundColor = "rgb(200, 200, 200)";
        badge.textContent = "Rust";
        page.appendChild(badge);

        document.body.appendChild(page);
        try {
            const clone = __testing.preparePageForPrint(page);
            const clonedHeadline = clone.querySelector("p")!;
            const clonedBadge = clone.querySelector("span")!;

            expect(clonedHeadline.style.opacity).toBe("1");
            expect(clonedHeadline.style.color).toBe("rgba(0, 0, 0, 0.8)");
            // A background can only be faded by opacity, so the badge keeps it.
            expect(clonedBadge.style.opacity).toBe("0.5");
        } finally {
            page.remove();
        }
    });

    it("falls back to the rendered page size when inline dimensions are absent", () => {
        const page = document.createElement("div");
        Object.defineProperty(page, "offsetWidth", {
            configurable: true,
            get: () => 816,
        });
        Object.defineProperty(page, "offsetHeight", {
            configurable: true,
            get: () => 1056,
        });

        expect(__testing.getIntrinsicPageSize(page)).toEqual({
            width: 816,
            height: 1056,
        });
    });
});

describe("resume JSON import", () => {
    it("accepts exported human-entered link fields", async () => {
        const result = await importResumeFromJsonText(JSON.stringify({
            version: 1,
            basics: {
                name: "Jane Doe",
                github: "github.com/janedoe",
            },
            certificates: [
                {
                    id: "cert-1",
                    name: "Certificate",
                    issuer: "Issuer",
                    url: "freeCodeCamp",
                    issuerUrl: "issuer",
                },
            ],
        }));

        expect(result?.kind).toBe("resume");
        if (result?.kind !== "resume") return;
        expect(result.resume.basics.github).toBe("github.com/janedoe");
        expect(result.resume.certificates[0].url).toBe("freeCodeCamp");
    });

    it("encrypts any JSON value and opens it again with the password", async () => {
        const secret = { format: "anything", basics: { name: "Jane Secret" } };
        const envelope = await createEncryptedJsonExport(secret, "correct horse");

        expect(envelope.format).toBe("enginecv/encrypted-json");
        expect(JSON.stringify(envelope)).not.toContain("Jane Secret");

        const result = await importResumeFromJsonText(JSON.stringify(envelope), () => "correct horse");
        expect(result?.kind === "resume" && result.resume.basics.name).toBe("Jane Secret");
    });

    it("recognises a data export instead of turning it into one empty CV", async () => {
        const file = {
            format: "enginecv/data-export",
            version: 1,
            data: { indexedDB: { EngineCVDatabase: { resumes: [{ basics: { name: "One" } }, { basics: { name: "Two" } }] } } },
        };
        const result = await importResumeFromJsonText(JSON.stringify(file));
        expect(result?.kind).toBe("data-export");
        if (result?.kind !== "data-export") return;
        expect(result.resumes.map((resume) => resume.basics.name)).toEqual(["One", "Two"]);
        expect(result.skipped).toBe(0);
    });

    it("opens a password-protected data export", async () => {
        const file = { format: "enginecv/data-export", version: 1, data: { indexedDB: { EngineCVDatabase: { resumes: [{ basics: { name: "Locked" } }] } } } };
        const envelope = await createEncryptedJsonExport(file, "pw");
        const result = await importResumeFromJsonText(JSON.stringify(envelope), () => "pw");
        expect(result?.kind === "data-export" && result.resumes[0].basics.name).toBe("Locked");
    });

    it("logs schema validation details and exposes them for UI disclosure", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(importResumeFromJsonText(JSON.stringify({
            version: 1,
            basics: {
                email: "not-an-email",
            },
        }))).rejects.toThrow(ResumeImportError);

        const error = await importResumeFromJsonText(JSON.stringify({
            version: 1,
            basics: {
                email: "not-an-email",
            },
        })).catch((caught) => caught);

        expect(consoleError).toHaveBeenCalledWith(
            "[EngineCV] Resume import schema validation failed.",
            expect.objectContaining({
                issues: expect.arrayContaining([
                    expect.objectContaining({
                        path: "basics.email",
                        message: expect.any(String),
                        code: expect.any(String),
                    }),
                ]),
            }),
        );
        expect(error).toBeInstanceOf(ResumeImportError);
        expect(error.message).toContain("Check the browser console");
        expect(getResumeImportErrorDetails(error)).toContain("basics.email");
    });
});
