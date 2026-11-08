import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChangelogParseError, parseChangelog } from "./parse";

function fixture(name: string): string {
    return readFileSync(path.join(__dirname, "__fixtures__", name), "utf8");
}

function parseError(source: string): ChangelogParseError {
    try {
        parseChangelog(source);
    } catch (error) {
        expect(error).toBeInstanceOf(ChangelogParseError);
        return error as ChangelogParseError;
    }
    throw new Error("expected parseChangelog to throw");
}

describe("parseChangelog", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("valid input", () => {
        it("parses sections newest-first in file order with groups and entries", () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
            const changelog = parseChangelog(fixture("valid-multi-section.md"));

            expect(changelog.sections).toHaveLength(3);
            expect(changelog.sections.map((s) => s.date)).toEqual([
                "2026-07-07",
                "2026-07-07",
                "2026-06-28",
            ]);

            const [first, , third] = changelog.sections;
            expect(first.groups.map((g) => g.category)).toEqual(["Added", "Fixed"]);
            expect(first.groups[0].entries).toHaveLength(2);
            expect(third.groups.map((g) => g.category)).toEqual(["Changed", "Removed"]);
            expect(warn).toHaveBeenCalled();
        });

        it("preserves inline markdown in entry text", () => {
            vi.spyOn(console, "warn").mockImplementation(() => {});
            const changelog = parseChangelog(fixture("valid-multi-section.md"));

            const added = changelog.sections[0].groups[0];
            expect(added.entries[0].markdown).toContain("`level`");
            expect(added.entries[1].markdown).toContain(
                "[resume preview](https://enginecv.example/preview)",
            );
        });

        it("joins continuation lines into a single entry", () => {
            vi.spyOn(console, "warn").mockImplementation(() => {});
            const changelog = parseChangelog(fixture("valid-multi-section.md"));

            const changed = changelog.sections[2].groups[0];
            expect(changed.entries).toHaveLength(2);
            expect(changed.entries[1].markdown).toBe(
                "Entry with a continuation line that wraps onto a second physical line in the source file.",
            );
        });

        it("dedupes anchor slugs for duplicate dates while keeping file order", () => {
            vi.spyOn(console, "warn").mockImplementation(() => {});
            const changelog = parseChangelog(fixture("valid-multi-section.md"));

            expect(changelog.sections[0].slug).toBe("2026-07-07");
            expect(changelog.sections[1].slug).toBe("2026-07-07-1");
            expect(changelog.sections[2].slug).toBe("2026-06-28");
        });

        it("captures the Unreleased section separately from dated sections", () => {
            vi.spyOn(console, "warn").mockImplementation(() => {});
            const changelog = parseChangelog(fixture("valid-multi-section.md"));

            expect(changelog.unreleased).not.toBeNull();
            expect(changelog.unreleased?.groups[0].category).toBe("Added");
            expect(changelog.unreleased?.groups[0].entries[0].markdown).toBe(
                "Staged entry awaiting the next release.",
            );
        });

        it("returns null unreleased when the section is absent", () => {
            const changelog = parseChangelog(
                "# Changelog\n\n## [2026-07-07]\n\n### Added\n- Entry.\n",
            );

            expect(changelog.unreleased).toBeNull();
        });

        it("warns on unknown categories but accepts them verbatim", () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
            const changelog = parseChangelog(fixture("valid-multi-section.md"));

            expect(changelog.sections[1].groups[0].category).toBe("Tweaked");
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("Tweaked"));
        });

        it("ignores preamble prose before the first section", () => {
            vi.spyOn(console, "warn").mockImplementation(() => {});
            expect(() => parseChangelog(fixture("valid-multi-section.md"))).not.toThrow();
        });

        it("is deterministic: parsing the same source twice yields deep-equal models", () => {
            vi.spyOn(console, "warn").mockImplementation(() => {});
            const source = fixture("valid-multi-section.md");

            expect(parseChangelog(source)).toEqual(parseChangelog(source));
        });
    });

    describe("parse errors", () => {
        it("rejects empty or whitespace-only input", () => {
            expect(() => parseChangelog(fixture("empty.md"))).toThrow(ChangelogParseError);
            expect(() => parseChangelog("")).toThrow(ChangelogParseError);
        });

        it("rejects a file with no dated sections", () => {
            const error = parseError("# Changelog\n\nJust prose, no sections.\n");
            expect(error.message).toMatch(/no dated section/i);
        });

        it("rejects malformed section headings with the offending line number", () => {
            const error = parseError(fixture("malformed-heading.md"));
            expect(error.line).toBe(8);
            expect(error.message).toContain("July 4th release");
        });

        it("rejects dates that are not real calendar dates", () => {
            const error = parseError("## [2026-02-30]\n\n### Added\n- Entry.\n");
            expect(error.message).toContain("2026-02-30");
        });

        it("rejects future dates", () => {
            const error = parseError(fixture("future-date.md"));
            expect(error.message).toContain("2099-01-01");
            expect(error.message).toMatch(/future/i);
        });

        it("rejects sections out of reverse-chronological order", () => {
            const error = parseError(fixture("out-of-order.md"));
            expect(error.message).toContain("2026-07-01");
            expect(error.section).toBe("2026-07-01");
        });

        it("rejects content directly under a section outside any category group", () => {
            const error = parseError(fixture("orphan-content.md"));
            expect(error.line).toBe(5);
            expect(error.section).toBe("2026-07-07");
        });

        it("rejects category groups with zero entries", () => {
            const error = parseError(fixture("empty-group.md"));
            expect(error.message).toMatch(/Added/);
            expect(error.section).toBe("2026-07-07");
        });

        it("rejects dated sections with zero groups", () => {
            const error = parseError("## [2026-07-07]\n\n## [2026-07-06]\n\n### Added\n- Entry.\n");
            expect(error.section).toBe("2026-07-07");
        });

        it("rejects Unreleased appearing after a dated section", () => {
            const error = parseError(
                "## [2026-07-07]\n\n### Added\n- Entry.\n\n## [Unreleased]\n\n### Added\n- Entry.\n",
            );
            expect(error.message).toMatch(/unreleased/i);
        });

        it("rejects a duplicate Unreleased section", () => {
            const error = parseError(
                "## [Unreleased]\n\n### Added\n- One.\n\n## [Unreleased]\n\n### Added\n- Two.\n",
            );
            expect(error.message).toMatch(/unreleased/i);
        });

        it("rejects list entries outside any category group", () => {
            const error = parseError("## [2026-07-07]\n- Entry without a group.\n");
            expect(error.section).toBe("2026-07-07");
        });
    });
});
