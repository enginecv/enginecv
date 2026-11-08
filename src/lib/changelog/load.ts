import { readFileSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { ChangelogParseError, parseChangelog, type Changelog } from "./parse";

/**
 * Reads and parses CHANGELOG.md from the repository root.
 *
 * Only for use from statically prerendered server components: the file is read
 * at build time, so a ChangelogParseError fails `next build` before a broken
 * changelog can deploy. The Cloudflare Workers runtime has no filesystem.
 */
export const loadChangelog = cache((): Changelog => {
    const filePath = path.join(process.cwd(), "CHANGELOG.md");

    let source: string;
    try {
        source = readFileSync(filePath, "utf8");
    } catch {
        throw new ChangelogParseError(
            `CHANGELOG.md not found at ${filePath}; the changelog page requires it`,
        );
    }

    try {
        return parseChangelog(source);
    } catch (error) {
        if (error instanceof ChangelogParseError) {
            error.message = `${filePath}: ${error.message}`;
        }
        throw error;
    }
});
