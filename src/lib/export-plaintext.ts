import { toDocumentLink, type DocumentDetail, type DocumentEntry, type DocumentLink, type DocumentModel, type DocumentSection } from "./document-model";
import { parseMarkdownBlocks, type InlineToken } from "./markdown-inline";

/**
 * Plain-text serializer over the document model, for job-portal paste boxes.
 *
 * No markup survives: rich-text bodies are parsed and flattened, links keep
 * their target visible as `label (url)`, and structure is carried only by
 * blank lines, uppercase section headings and `- ` bullets.
 */

/** `mailto:`/`tel:` prefixes are noise once the link is no longer clickable. */
function displayUrl(url: string): string {
    return url.replace(/^(mailto|tel):/i, "");
}

function linkText(label: string, url: string): string {
    const target = displayUrl(url);
    return !label || label === target || label === url ? target : `${label} (${target})`;
}

function inlineText(tokens: InlineToken[]): string {
    return tokens
        .map((token) => {
            if (token.type === "text" || token.type === "code") return token.value;
            if (token.type === "link") {
                const label = inlineText(token.children);
                const safe = toDocumentLink(token.url, label);
                return safe ? linkText(label, safe.url) : label;
            }
            return inlineText(token.children);
        })
        .join("");
}

export function markdownToPlainText(markdown: string): string {
    return parseMarkdownBlocks(markdown)
        .map((block) => {
            if (block.type === "paragraph") return inlineText(block.content);
            return block.items
                .map((item, index) => `${block.ordered ? `${index + 1}.` : "-"} ${inlineText(item)}`)
                .join("\n");
        })
        .filter((text) => text.trim())
        .join("\n\n");
}

function link(target: DocumentLink): string {
    return linkText(target.label, target.url);
}

function detail(value: DocumentDetail): string {
    const text = value.url ? linkText(value.value, value.url) : value.value;
    return value.label ? `${value.label}: ${text}` : text;
}

function lines(...values: Array<string | false | null | undefined>): string {
    return values.filter((value): value is string => Boolean(value && value.trim())).join("\n");
}

function buildHeader(model: DocumentModel): string[] {
    const { basics } = model;
    const contact = [
        ...basics.emails.map(detail),
        basics.phone,
        basics.location,
    ].filter(Boolean);

    const blocks = [
        lines(
            basics.name,
            basics.headline,
            contact.join(" · "),
            basics.links.map(link).join(" · "),
            basics.details.map(detail).join(" · "),
        ),
    ];

    if (basics.summary.trim()) {
        blocks.push(lines(basics.summaryHeading.toUpperCase(), "", markdownToPlainText(basics.summary)));
    }
    return blocks;
}

function buildEntry(entry: DocumentEntry): string {
    const title = entry.title.trim();
    const subtitle = entry.subtitle.trim();
    const heading = [title, subtitle].filter(Boolean).join(" — ");
    const entryLink = entry.link ? link(entry.link) : "";
    const meta = [entry.dateRange, entry.location].map((value) => value.trim()).filter(Boolean).join(" · ");

    return lines(
        heading,
        meta,
        entryLink,
        entry.body.trim() && markdownToPlainText(entry.body),
        entry.bullets.map((bullet) => `- ${bullet}`).join("\n"),
        entry.details.map(detail).join("\n"),
        entry.tags.join(", "),
    );
}

function buildSection(section: DocumentSection): string | null {
    const body = [
        section.text.trim() && markdownToPlainText(section.text),
        section.tags.join(", "),
        ...section.skillGroups
            .filter((group) => group.skills.length > 0)
            .map((group) => (group.name ? `${group.name}: ${group.skills.join(", ")}` : group.skills.join(", "))),
        ...section.entries.map(buildEntry),
    ].filter((block): block is string => Boolean(block && block.trim()));

    // A section that resolved to nothing renders no heading either.
    if (body.length === 0) return null;
    return [section.heading.toUpperCase(), ...body].join("\n\n");
}

export function toPlainText(model: DocumentModel): string {
    const document = [...buildHeader(model), ...model.sections.map(buildSection)]
        .filter((block): block is string => Boolean(block && block.trim()))
        .join("\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return document ? `${document}\n` : "";
}
