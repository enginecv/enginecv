import { ensureReadableAccent } from "./color-contrast";
import { toDocumentLink, type DocumentDetail, type DocumentEntry, type DocumentLink, type DocumentModel, type DocumentSection } from "./document-model";
import { parseMarkdownBlocks, type InlineToken } from "./markdown-inline";

/**
 * Semantic HTML fragment over the document model, used as the rich clipboard
 * payload. Built from the model rather than copied from the preview DOM so no
 * layout CSS or hidden nodes leak into the paste target.
 */

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function anchor(label: string, url: string): string {
    return `<a href="${escapeHtml(url)}">${label}</a>`;
}

function inline(tokens: InlineToken[]): string {
    return tokens
        .map((token) => {
            switch (token.type) {
                case "text":
                    return escapeHtml(token.value);
                case "code":
                    return `<code>${escapeHtml(token.value)}</code>`;
                case "strong":
                    return `<strong>${inline(token.children)}</strong>`;
                case "em":
                    return `<em>${inline(token.children)}</em>`;
                case "link": {
                    const label = inline(token.children);
                    const safe = toDocumentLink(token.url, "");
                    return safe ? anchor(label, safe.url) : label;
                }
            }
        })
        .join("");
}

function markdown(value: string): string {
    return parseMarkdownBlocks(value)
        .map((block) => {
            if (block.type === "paragraph") return `<p>${inline(block.content)}</p>`;
            const tag = block.ordered ? "ol" : "ul";
            return `<${tag}>${block.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${tag}>`;
        })
        .join("");
}

function link(target: DocumentLink): string {
    return anchor(escapeHtml(target.label), target.url);
}

function detail(value: DocumentDetail): string {
    const text = value.url ? anchor(escapeHtml(value.value), value.url) : escapeHtml(value.value);
    return value.label ? `<strong>${escapeHtml(value.label)}:</strong> ${text}` : text;
}

function heading(level: 1 | 2, text: string, accent: string): string {
    return `<h${level} style="color:${accent}">${escapeHtml(text)}</h${level}>`;
}

function buildEntry(entry: DocumentEntry): string {
    const parts: string[] = [];
    const title = entry.title.trim();
    const subtitle = entry.subtitle.trim();

    if (title) {
        const text = escapeHtml(title);
        parts.push(`<h3>${!subtitle && entry.link ? anchor(text, entry.link.url) : text}</h3>`);
    }
    const meta = [
        subtitle && (entry.link ? anchor(escapeHtml(subtitle), entry.link.url) : escapeHtml(subtitle)),
        escapeHtml([entry.dateRange, entry.location].map((value) => value.trim()).filter(Boolean).join(" · ")),
    ].filter(Boolean);
    if (meta.length > 0) parts.push(`<p><em>${meta.join(" · ")}</em></p>`);
    if (entry.body.trim()) parts.push(markdown(entry.body));
    if (entry.bullets.length > 0) parts.push(`<ul>${entry.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`);
    if (entry.details.length > 0) parts.push(`<p>${entry.details.map(detail).join("<br>")}</p>`);
    if (entry.tags.length > 0) parts.push(`<p>${escapeHtml(entry.tags.join(", "))}</p>`);
    return parts.join("");
}

function buildSection(section: DocumentSection, accent: string): string {
    const body = [
        section.text.trim() ? markdown(section.text) : "",
        section.tags.length > 0 ? `<p>${escapeHtml(section.tags.join(", "))}</p>` : "",
        ...section.skillGroups
            .filter((group) => group.skills.length > 0)
            .map((group) => `<p>${group.name ? `<strong>${escapeHtml(group.name)}:</strong> ` : ""}${escapeHtml(group.skills.join(", "))}</p>`),
        ...section.entries.map(buildEntry),
    ].filter(Boolean);

    return body.length > 0 ? heading(2, section.heading, accent) + body.join("") : "";
}

export function toHtmlFragment(model: DocumentModel, accentColor = "#111827"): string {
    const accent = ensureReadableAccent(accentColor);
    const { basics } = model;
    const contact = [
        ...basics.emails.map(detail),
        ...(basics.phone ? [escapeHtml(basics.phone)] : []),
        ...(basics.location ? [escapeHtml(basics.location)] : []),
    ];

    return [
        basics.name ? heading(1, basics.name, accent) : "",
        basics.headline ? `<p>${escapeHtml(basics.headline)}</p>` : "",
        contact.length > 0 ? `<p>${contact.join(" · ")}</p>` : "",
        basics.links.length > 0 ? `<p>${basics.links.map(link).join(" · ")}</p>` : "",
        basics.details.length > 0 ? `<p>${basics.details.map(detail).join(" · ")}</p>` : "",
        basics.summary.trim() ? heading(2, basics.summaryHeading, accent) + markdown(basics.summary) : "",
        ...model.sections.map((section) => buildSection(section, accent)),
    ].join("");
}
