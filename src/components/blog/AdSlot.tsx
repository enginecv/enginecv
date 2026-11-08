import { AdBanner } from "@/components/AdBanner";
import type { BlogAdSlot } from "@/lib/blog";
import type { AdSlotName } from "@/lib/ads";

const BLOG_SLOTS: Record<BlogAdSlot, AdSlotName> = {
    "after-first-paragraph": "blog_post_after_intro",
    "mid-article": "blog_post_mid_1",
    "end-of-article": "blog_post_end",
    "sidebar-square": "blog_sidebar_square",
};

export function AdSlot({ slot }: { slot: BlogAdSlot }) {
    return <AdBanner slot={BLOG_SLOTS[slot]} />;
}
