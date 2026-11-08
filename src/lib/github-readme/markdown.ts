import type { DocumentModel, DocumentSection } from "../document-model";
import { getReadmeLabels } from "./labels";
import { normalizeReadmeOptions, type ReadmeOptions } from "./options";
import { README_FILES } from "./package";
import { escapeAttr, escapeInline, escapeText, firstParagraph, plainText, safeUrl, truncate } from "./text";

/**
 * GitHub profile README Markdown (contracts/readme-output.md).
 *
 * Built from the document model, so hidden items, section order, Customize
 * headings and CV-language labels match every other export. The only raw
 * HTML is the `<picture>` card snippet and the `<sub>` credit line, both of
 * which GitHub's sanitizer keeps.
 */

export const README_REFERRAL_URL = "https://enginecv.app/r/github-readme";

const SUMMARY_MAX = 400;
const PROJECT_LINE_MAX = 160;

function link(label: string, url: string | undefined | null): string {
    const target = url ? safeUrl(url) : null;
    return target ? `[${escapeInline(label)}](${target})` : escapeInline(label);
}

function firstSection(model: DocumentModel, type: DocumentSection["type"]): DocumentSection | undefined {
    return model.sections.find((section) => section.type === type);
}

/** Skill names across every visible skills section, in order, without duplicates. */
export function readmeSkills(model: DocumentModel): string[] {
    const seen = new Set<string>();
    const skills: string[] = [];
    for (const section of model.sections) {
        if (section.type !== "skills") continue;
        for (const group of section.skillGroups) {
            for (const skill of group.skills) {
                const key = skill.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                skills.push(skill);
            }
        }
    }
    return skills;
}

/** shields.io static badge: `-` and `_` are its separators, so they are doubled. */
export function skillBadge(skill: string): string {
    const message = encodeURIComponent(skill.replace(/-/g, "--").replace(/_/g, "__"));
    return `![${escapeInline(skill)}](https://img.shields.io/badge/${message}-informational?style=flat-square)`;
}

export function cardSnippet(model: DocumentModel): string {
    const { name, headline } = model.basics;
    const alt = escapeAttr(headline ? `${name} — ${headline}` : name);
    return [
        "<picture>",
        `  <source media="(prefers-color-scheme: dark)" srcset="./${README_FILES.cardDark}">`,
        `  <img alt="${alt}" src="./${README_FILES.cardLight}">`,
        "</picture>",
    ].join("\n");
}

function summaryBlock(model: DocumentModel): string {
    const text = plainText(firstParagraph(model.basics.summary));
    return text ? escapeText(truncate(text, SUMMARY_MAX)) : "";
}

function skillsBlock(model: DocumentModel, options: ReadmeOptions): string {
    const skills = readmeSkills(model).slice(0, options.maxSkills);
    if (skills.length === 0) return "";
    return options.skillStyle === "badges"
        ? skills.map(skillBadge).join(" ")
        : escapeText(skills.join(" · "));
}

function experienceBlock(section: DocumentSection | undefined, options: ReadmeOptions): string {
    if (!section) return "";
    return section.entries
        .slice(0, options.maxRoles)
        .map((entry) => {
            const parts = [
                entry.title.trim() ? `**${escapeInline(entry.title.trim())}**` : "",
                entry.subtitle.trim() ? link(entry.subtitle.trim(), entry.link?.url) : "",
                entry.dateRange.trim() ? `*${escapeInline(entry.dateRange.trim())}*` : "",
            ].filter(Boolean);
            return parts.length > 0 ? `- ${parts.join(" · ")}` : "";
        })
        .filter(Boolean)
        .join("\n");
}

function projectsBlock(section: DocumentSection | undefined, options: ReadmeOptions): string {
    if (!section || options.maxProjects === 0) return "";
    return section.entries
        .slice(0, options.maxProjects)
        .map((entry) => {
            const name = entry.title.trim() || entry.subtitle.trim();
            if (!name) return "";
            const description = plainText(firstParagraph(entry.body) || entry.bullets[0] || entry.subtitle);
            const line = description && description !== name ? ` — ${escapeInline(truncate(description, PROJECT_LINE_MAX))}` : "";
            return `- **${link(name, entry.link?.url)}**${line}`;
        })
        .filter(Boolean)
        .join("\n");
}

function linksBlock(model: DocumentModel, options: ReadmeOptions): string {
    const { basics } = model;
    const parts: string[] = [];

    if (options.includeContact) {
        for (const email of basics.emails) parts.push(link(email.value, email.url));
        if (basics.phone) parts.push(escapeInline(basics.phone));
    }
    if (options.sections.links) {
        for (const target of basics.links) {
            const url = safeUrl(target.url);
            if (url) parts.push(`[${escapeInline(target.label)}](${url})`);
        }
    }
    return parts.join(" · ");
}

function section(heading: string, body: string): string {
    return body ? `## ${escapeInline(heading)}\n\n${body}` : "";
}

export function toGithubReadme(model: DocumentModel, rawOptions: ReadmeOptions): string {
    const options = normalizeReadmeOptions(rawOptions);
    const { basics } = model;
    const labels = getReadmeLabels(model.language);
    const on = options.sections;

    const experience = firstSection(model, "experience");
    const projects = firstSection(model, "projects");
    const skills = firstSection(model, "skills");

    const blocks = [
        options.includeCard && basics.name ? cardSnippet(model) : "",
        basics.name ? `# ${escapeInline(basics.name)}` : "",
        on.headline && basics.headline ? escapeText(basics.headline) : "",
        on.location && basics.location ? `📍 ${escapeInline(basics.location)}` : "",
        on.summary ? section(basics.summaryHeading, summaryBlock(model)) : "",
        on.skills && skills ? section(skills.heading, skillsBlock(model, options)) : "",
        on.experience ? section(experience?.heading ?? "", experienceBlock(experience, options)) : "",
        on.projects ? section(projects?.heading ?? "", projectsBlock(projects, options)) : "",
        section(labels.links, linksBlock(model, options)),
        options.includeFullCv ? `📄 [${escapeInline(labels.fullCv)}](./${options.fullCvFile})` : "",
        options.credit ? `<sub>[${escapeInline(labels.builtWith)}](${README_REFERRAL_URL})</sub>` : "",
    ];

    const document = blocks.filter(Boolean).join("\n\n");
    return document ? `${document}\n` : "";
}
