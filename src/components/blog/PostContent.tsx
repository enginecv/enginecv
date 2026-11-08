import Link from "next/link";
import type { MDXComponents } from "mdx/types";
import { Children, isValidElement, type ReactNode } from "react";
import { AdSlot as BlogAdSlotPlaceholder } from "@/components/blog/AdSlot";
import { CTA as BlogCTA } from "@/components/blog/CTA";
import type { BlogAdSlot, BlogPost } from "@/lib/blog";
import { createBlogHeadingIdTracker } from "@/lib/blog-headings";

const supportedAdSlots = new Set<BlogAdSlot>([
    "after-first-paragraph",
    "mid-article",
    "end-of-article",
]);

function isSupportedAdSlot(value: string | undefined): value is BlogAdSlot {
    return !!value && supportedAdSlots.has(value as BlogAdSlot);
}

function countParagraphBlocks(markdown: string) {
    const lines = markdown.split(/\r?\n/);
    const blocks: string[] = [];
    const buffer: string[] = [];
    let insideFence = false;

    const flush = () => {
        const block = buffer.join("\n").trim();
        if (block) {
            blocks.push(block);
        }
        buffer.length = 0;
    };

    for (const line of lines) {
        const trimmed = line.trim();
        const isFenceLine = trimmed.startsWith("```");

        if (!insideFence && trimmed === "") {
            flush();
            continue;
        }

        buffer.push(line);

        if (isFenceLine) {
            insideFence = !insideFence;
        }
    }

    flush();

    return blocks.filter((block) => {
        const firstLine = block.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? "";
        return !/^(#|>|- |\* |\d+\.|```|<(InlineCTA|CTA|AdSlot)\b)/.test(firstLine);
    }).length;
}

function flattenMarkdownText(children: ReactNode): string {
    return Children.toArray(children)
        .map((child) => {
            if (typeof child === "string" || typeof child === "number") {
                return String(child);
            }

            if (isValidElement<{ children?: ReactNode }>(child)) {
                return flattenMarkdownText(child.props.children);
            }

            return "";
        })
        .join("")
        .trim();
}

function flattenInlineCodeText(children: ReactNode): string | null {
    const parts = Children.toArray(children).map((child) => {
        if (typeof child === "string" || typeof child === "number") {
            return String(child);
        }

        if (isValidElement<{ children?: ReactNode }>(child)) {
            return flattenInlineCodeText(child.props.children);
        }

        return null;
    });

    if (parts.some((part) => part === null)) {
        return null;
    }

    return parts.join("");
}

function createBlogMdxComponents({
    enabledAdSlots,
    totalParagraphs,
}: {
    enabledAdSlots: Set<BlogAdSlot>;
    totalParagraphs: number;
}): MDXComponents {
    const midArticleParagraph = totalParagraphs >= 4 ? Math.ceil(totalParagraphs / 2) : null;
    const resolveHeadingId = createBlogHeadingIdTracker();
    let paragraphCursor = 0;

    return {
        InlineCTA: () => <BlogCTA variant="inline" />,
        CTA: ({ variant }: { variant?: "inline" | "end" }) => <BlogCTA variant={variant ?? "end"} />,
        AdSlot: ({ slot, position }: { slot?: string; position?: string }) => {
            const resolvedSlot = isSupportedAdSlot(slot) ? slot : isSupportedAdSlot(position) ? position : "mid-article";
            return <BlogAdSlotPlaceholder slot={resolvedSlot} />;
        },
        h2: ({ children, id }) => {
            const headingText = flattenMarkdownText(children);
            return (
                <h2
                    id={id ?? resolveHeadingId(headingText)}
                    className="mt-10 scroll-mt-28 text-2xl font-semibold tracking-tight text-strong"
                >
                    {children}
                </h2>
            );
        },
        h3: ({ children, id }) => {
            const headingText = flattenMarkdownText(children);
            return (
                <h3
                    id={id ?? resolveHeadingId(headingText)}
                    className="mt-8 scroll-mt-28 text-xl font-semibold tracking-tight text-strong"
                >
                    {children}
                </h3>
            );
        },
        p: ({ children }) => {
            paragraphCursor += 1;
            const currentParagraph = paragraphCursor;
            const shouldRenderFirstSlot =
                enabledAdSlots.has("after-first-paragraph") && currentParagraph === 1;
            const shouldRenderMidSlot =
                enabledAdSlots.has("mid-article") &&
                midArticleParagraph !== null &&
                currentParagraph === midArticleParagraph &&
                currentParagraph !== 1;

            return (
                <>
                    <p className="mt-5 text-[1.02rem] leading-8 text-bright">{children}</p>
                    {shouldRenderFirstSlot ? <BlogAdSlotPlaceholder slot="after-first-paragraph" /> : null}
                    {shouldRenderMidSlot ? <BlogAdSlotPlaceholder slot="mid-article" /> : null}
                </>
            );
        },
        ul: ({ children }) => (
            <ul className="mt-5 list-disc space-y-3 pl-6 text-[1.02rem] leading-8 text-bright">
                {children}
            </ul>
        ),
        ol: ({ children }) => (
            <ol className="mt-5 list-decimal space-y-3 pl-6 text-[1.02rem] leading-8 text-bright">
                {children}
            </ol>
        ),
        li: ({ children }) => <li>{children}</li>,
        blockquote: ({ children }) => (
            <blockquote className="mt-6 border-l-2 border-accent pl-4 text-[1.02rem] leading-8 text-bright">
                {children}
            </blockquote>
        ),
        a: ({ href = "", children }) => {
            const className = "font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:text-accent-soft";

            if (href.startsWith("/")) {
                return (
                    <Link href={href} className={className}>
                        {children}
                    </Link>
                );
            }

            const shouldOpenInNewTab = !href.startsWith("#") && !href.startsWith("mailto:");

            return (
                <a
                    href={href}
                    className={className}
                    target={shouldOpenInNewTab ? "_blank" : undefined}
                    rel={shouldOpenInNewTab ? "noopener noreferrer" : undefined}
                >
                    {children}
                </a>
            );
        },
        pre: ({ children }) => (
            <pre className="mt-6 overflow-x-auto rounded-2xl border border-edge bg-surface-0 p-4 text-sm leading-7 text-strong">
                {children}
            </pre>
        ),
        code: ({ children, className }) => {
            const inlineValue = flattenInlineCodeText(children);

            if (className || inlineValue === null || inlineValue.includes("\n")) {
                return <code className={className}>{children}</code>;
            }

            return (
                <code className="rounded-md bg-surface-5 px-1.5 py-0.5 text-[0.92em] text-strong">
                    {inlineValue.replace(/\n$/, "")}
                </code>
            );
        },
        hr: () => <hr className="my-8 border-edge" />,
        table: ({ children }) => (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-edge">
                <table className="min-w-full border-collapse text-left text-sm text-bright">
                    {children}
                </table>
            </div>
        ),
        thead: ({ children }) => <thead className="bg-surface-4 text-strong">{children}</thead>,
        th: ({ children }) => <th className="px-4 py-3 font-medium">{children}</th>,
        td: ({ children }) => <td className="border-t border-edge px-4 py-3">{children}</td>,
        strong: ({ children }) => <strong className="font-semibold text-strong">{children}</strong>,
    };
}

export function PostContent({
    body,
    content,
    enabledAdSlots,
}: {
    body: BlogPost["body"];
    content: string;
    enabledAdSlots: BlogAdSlot[];
}) {
    const enabledSlots = new Set(enabledAdSlots);
    const totalParagraphs = countParagraphBlocks(content);
    const MdxContent = body;

    return (
        <div className="mt-10">
            <MdxContent components={createBlogMdxComponents({ enabledAdSlots: enabledSlots, totalParagraphs })} />
            {enabledSlots.has("end-of-article") ? <BlogAdSlotPlaceholder slot="end-of-article" /> : null}
        </div>
    );
}
