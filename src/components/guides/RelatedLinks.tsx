import Link from "next/link";
import { GUIDE_COPY } from "@/lib/guides/copy";
import { getPublishedGuideMeta } from "@/lib/guides/guides";
import { ROLE_EXAMPLES_PATH } from "@/lib/role-examples/rules";
import { GUIDES_PATH } from "@/lib/site";
import { GALLERY_PATH } from "@/lib/templates/gallery";

const LINK_CLASS = "font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:text-accent-soft";

function Sentence({ part, href }: { part: { before: string; link: string; after: string }; href: string }) {
    return (
        <li>
            {part.before}
            <Link href={href} className={LINK_CLASS}>
                {part.link}
            </Link>
            {part.after}
        </li>
    );
}

/** Links from a guide to the rest of the site: role examples, templates, sibling guides and the hub. */
export async function RelatedLinks({ currentSlug }: { currentSlug: string }) {
    const siblings = (await getPublishedGuideMeta()).filter((guide) => guide.slug !== currentSlug).slice(0, 3);

    return (
        <nav aria-labelledby="guide-related" className="mt-14 rounded-2xl border border-edge bg-surface-3 p-6">
            <h2 id="guide-related" className="text-lg font-semibold text-strong">
                {GUIDE_COPY.relatedTitle}
            </h2>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-bright">
                <Sentence part={GUIDE_COPY.related.examples} href={ROLE_EXAMPLES_PATH} />
                <Sentence part={GUIDE_COPY.related.templates} href={GALLERY_PATH} />
                {siblings.map((guide) => (
                    <li key={guide.slug}>
                        {GUIDE_COPY.relatedNextPrefix}{" "}
                        <Link href={guide.path} className={LINK_CLASS}>
                            {guide.title}
                        </Link>
                    </li>
                ))}
                <Sentence part={GUIDE_COPY.related.hub} href={GUIDES_PATH} />
            </ul>
        </nav>
    );
}
