import GithubSlugger from "github-slugger";
import type { BlogTocItem } from "./blog";

export function createBlogHeadingIdTracker() {
    const slugger = new GithubSlugger();

    return (value: string) => {
        return slugger.slug(value);
    };
}

const CUSTOM_ID = /\s*\[#([^\]]+)\]\s*$/;

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

        // Processed markdown carries fumadocs custom ids ("## Title [#slug]"): use the id, keep it out of the title.
        const custom = CUSTOM_ID.exec(match[2]);
        const title = (custom ? match[2].slice(0, custom.index) : match[2]).trim();

        items.push({
            title,
            url: `#${custom?.[1] ?? resolveHeadingId(title)}`,
            depth: match[1].length as 2 | 3,
        });
    }

    return items;
}
