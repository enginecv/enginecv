import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChangelogParseError } from "./parse";

const readFileSyncMock = vi.hoisted(() => vi.fn());

vi.mock("node:fs", () => ({
    default: { readFileSync: readFileSyncMock },
    readFileSync: readFileSyncMock,
}));

async function freshModules() {
    vi.resetModules();
    const parse = await import("./parse");
    const load = await import("./load");
    return { ...parse, ...load };
}

function captureError(fn: () => unknown): unknown {
    try {
        fn();
    } catch (error) {
        return error;
    }
    throw new Error("expected function to throw");
}

describe("loadChangelog", () => {
    beforeEach(() => {
        readFileSyncMock.mockReset();
    });

    it("throws a ChangelogParseError naming the path when CHANGELOG.md is missing", async () => {
        readFileSyncMock.mockImplementation(() => {
            const error = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
            error.code = "ENOENT";
            throw error;
        });

        const { loadChangelog, ChangelogParseError } = await freshModules();
        const error = captureError(() => loadChangelog()) as ChangelogParseError;

        expect(error).toBeInstanceOf(ChangelogParseError);
        expect(error.message).toMatch(/CHANGELOG\.md not found at .*CHANGELOG\.md/);
    });

    it("prefixes parse errors with the file path so build failures are actionable", async () => {
        readFileSyncMock.mockReturnValue("## July 4th release\n\n### Added\n- Entry.\n");

        const { loadChangelog, ChangelogParseError } = await freshModules();
        const error = captureError(() => loadChangelog()) as ChangelogParseError;

        expect(error).toBeInstanceOf(ChangelogParseError);
        expect(error.message).toContain("CHANGELOG.md");
        expect(error.message).toContain("July 4th release");
        expect(error.line).toBe(1);
    });

    it("returns the parsed changelog for a valid file", async () => {
        readFileSyncMock.mockReturnValue("## [2026-07-07]\n\n### Added\n- Entry.\n");

        const { loadChangelog } = await freshModules();
        const changelog = loadChangelog();

        expect(changelog.sections).toHaveLength(1);
        expect(changelog.sections[0].slug).toBe("2026-07-07");
    });
});
