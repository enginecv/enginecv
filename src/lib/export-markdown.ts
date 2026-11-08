import type { DocumentDetail, DocumentEntry, DocumentLink, DocumentModel, DocumentSection } from "./document-model";

/**
 * GitHub-Flavored Markdown serializer over the document model.
 *
 * Rich-text bodies are already Markdown as authored, so they pass through
 * verbatim; only generated plain text (titles, subtitles, labels) is escaped.
 */

export interface MarkdownExportOptions {
    /** Prefix the file with YAML front matter carrying structured basics. */
    frontMatter?: boolean;
}

// Characters that carry meaning anywhere in a line.
const INLINE_ESCAPE = /([\\`*_[\]<>|])/g;

/**
 * Escapes generated plain text so it cannot be read as Markdown syntax.
 * Block markers are handled by `escapeLineStart` instead, because escaping
 * them here would mangle ordinary text like phone numbers and domains.
 */
function escapeInline(value: string): string {
    return value.replace(INLINE_ESCAPE, "\\$1");
}

/**
 * Neutralizes a leading block marker (`-`, `#`, `1.`) so a generated block that
 * begins with plain text cannot turn into a list item or heading. Only applied
 * where the text really starts a line — blocks we prefix ourselves are safe.
 */
function escapeLineStart(value: string): string {
    return value
        .replace(/^(\s*)([-+#>])/, "$1\\$2")
        .replace(/^(\s*)(\d+)([.)])/, "$1$2\\$3");
}

function link(target: DocumentLink): string {
    return `[${escapeInline(target.label)}](${target.url})`;
}

function detail(value: DocumentDetail): string {
    const text = value.url ? `[${escapeInline(value.value)}](${value.url})` : escapeInline(value.value);
    return value.label ? `${escapeInline(value.label)}: ${text}` : text;
}

function tagList(tags: string[]): string {
    return tags.map((tag) => `\`${tag}\``).join(" · ");
}

function yamlValue(value: string): string {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildFrontMatter(model: DocumentModel): string[] {
    const { basics } = model;
    const fields: Array<[string, string]> = [
        ["name", basics.name],
        ["headline", basics.headline],
        ["email", basics.emails[0]?.value ?? ""],
        ["phone", basics.phone],
        ["location", basics.location],
        ["language", model.language],
    ];

    const lines = fields
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => `${key}: ${yamlValue(value)}`);

    if (basics.links.length > 0) {
        lines.push("links:");
        for (const target of basics.links) {
            lines.push(`  - label: ${yamlValue(target.label)}`);
            lines.push(`    url: ${yamlValue(target.url)}`);
        }
    }

    // One block: the delimiters and keys must stay on consecutive lines.
    if (lines.length === 0) return [];
    return [["---", ...lines, "---"].join("\n")];
}

function buildHeader(model: DocumentModel): string[] {
    const { basics } = model;
    const blocks: string[] = [];

    if (basics.name) blocks.push(`# ${escapeInline(basics.name)}`);
    if (basics.headline) blocks.push(escapeLineStart(escapeInline(basics.headline)));

    const contact = [
        ...basics.emails.map(detail),
        ...(basics.phone ? [escapeInline(basics.phone)] : []),
        ...(basics.location ? [escapeInline(basics.location)] : []),
    ];
    if (contact.length > 0) blocks.push(escapeLineStart(contact.join(" · ")));

    if (basics.links.length > 0) blocks.push(basics.links.map(link).join(" · "));
    if (basics.details.length > 0) blocks.push(escapeLineStart(basics.details.map(detail).join(" · ")));

    if (basics.summary) {
        blocks.push(`## ${escapeInline(basics.summaryHeading)}`);
        blocks.push(basics.summary);
    }

    return blocks;
}

function buildEntry(entry: DocumentEntry): string[] {
    const blocks: string[] = [];
    const title = entry.title.trim();
    const subtitle = entry.subtitle.trim();

    // The entry link belongs to the subtitle, and falls back to the title when
    // there is no subtitle to carry it.
    const linkedSubtitle = subtitle
        ? entry.link
            ? link({ url: entry.link.url, label: subtitle })
            : escapeInline(subtitle)
        : "";
    const linkedTitle = title
        ? !subtitle && entry.link
            ? link({ url: entry.link.url, label: title })
            : escapeInline(title)
        : "";

    if (linkedTitle) blocks.push(`### ${linkedTitle}`);
    if (linkedSubtitle) blocks.push(`**${linkedSubtitle}**`);

    const meta = [entry.dateRange, entry.location].map((value) => value.trim()).filter(Boolean);
    if (meta.length > 0) blocks.push(`*${escapeInline(meta.join(" · "))}*`);

    if (entry.body.trim()) blocks.push(entry.body.trim());
    if (entry.bullets.length > 0) blocks.push(entry.bullets.map((bullet) => `- ${bullet}`).join("\n"));
    if (entry.details.length > 0) blocks.push(entry.details.map(detail).join("  \n"));
    if (entry.tags.length > 0) blocks.push(tagList(entry.tags));

    return blocks;
}

function buildSection(section: DocumentSection): string[] {
    const blocks: string[] = [];
    const body: string[] = [];

    if (section.text) body.push(section.text);
    if (section.tags.length > 0) body.push(tagList(section.tags));

    for (const group of section.skillGroups) {
        if (group.skills.length === 0) continue;
        const skills = tagList(group.skills);
        body.push(group.name ? `**${escapeInline(group.name)}:** ${skills}` : skills);
    }

    for (const entry of section.entries) {
        body.push(...buildEntry(entry));
    }

    // A section that resolved to nothing renders no heading either.
    if (body.length === 0) return blocks;

    blocks.push(`## ${escapeInline(section.heading)}`);
    blocks.push(...body);
    return blocks;
}

export function toMarkdown(model: DocumentModel, options: MarkdownExportOptions = {}): string {
    const blocks: string[] = [
        ...(options.frontMatter ? buildFrontMatter(model) : []),
        ...buildHeader(model),
        ...model.sections.flatMap(buildSection),
    ];

    const document = blocks
        .map((block) => block.trim())
        .filter(Boolean)
        .join("\n\n");

    return document ? `${document}\n` : "";
}
