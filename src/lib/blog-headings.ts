import GithubSlugger from "github-slugger";
import type { BlogTocItem } from "./blog";

export function createBlogHeadingIdTracker() {
    const slugger = new GithubSlugger();

    return (value: string) => {
        return slugger.slug(value);
    };
}

export function extractBlogTocFromMarkdown(content: string): BlogTocItem[] {
    const resolveHeadingId = createBlogHeadingIdTracker();
    const items: BlogTocItem[] = [];
    let insideFence = false;

    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();

        if (trimmed.startsWith("```")) {
            insideFence = !insideFence;
            continue;
        }

        if (insideFence) {
            continue;
        }

        const match = trimmed.match(/^(##|###)\s+(.+)$/);
        if (!match) {
            continue;
        }

        items.push({
            title: match[2].trim(),
            url: `#${resolveHeadingId(match[2].trim())}`,
            depth: match[1].length as 2 | 3,
        });
    }

    return items;
}
