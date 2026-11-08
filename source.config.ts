import { defineCollections, defineConfig } from "fumadocs-mdx/config";
import { z } from "zod";

const defaultAdSlots = ["after-first-paragraph", "mid-article", "end-of-article"] as const;
const optionalAdSlots = ["sidebar-square"] as const;
const allAdSlots = [...defaultAdSlots, ...optionalAdSlots] as const;
const blogLocales = ["en", "de", "bs", "fr", "es"] as const;

export const blog = defineCollections({
    type: "doc",
    dir: "content/blog",
    schema: z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        slug: z.string().regex(/^[a-z0-9-]+$/),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        author: z.string().min(1),
        tags: z.array(z.string()).default([]),
        sponsored: z.boolean().default(false),
        adSlots: z.array(z.enum(allAdSlots)).default([...defaultAdSlots]),
        // Translations: English posts sit at the root, others in content/blog/<locale>/.
        locale: z.enum(blogLocales).default("en"),
        // Shared by every language version of one article; defaults to the slug.
        article: z.string().regex(/^[a-z0-9-]+$/).optional(),
        // Drafts render at their address for reviewers but are noindex and unlisted.
        draft: z.boolean().default(false),
    }),
    // Exports each post's markdown (`_markdown`) so the Worker, which has no
    // file system, can count words and paragraphs.
    postprocess: { includeProcessedMarkdown: true },
});

export default defineConfig();
