import type { DocumentModel } from "../document-model";
import { readmeSkills } from "./markdown";
import { escapeXml, truncate } from "./text";

/**
 * Self-contained SVG resume card for a GitHub profile README.
 *
 * GitHub serves README SVGs as images: no scripts, no external fonts or
 * images. So the card uses a system font stack and shortens text by a
 * character budget, since SVG has no text layout to measure with.
 */

export type ReadmeCardVariant = "light" | "dark";

const WIDTH = 495;
const HEIGHT = 195;
const PADDING = 20;
const MAX_CHIPS = 6;
const CHIP_CHAR_WIDTH = 7;
const CHIP_PADDING = 16;
const CHIP_GAP = 8;

export const CARD_BUDGET = { name: 30, headline: 52, location: 52, role: 52, chip: 18 } as const;

/** GitHub's own palette so the card blends into either theme; accent is EngineCV's. */
const PALETTE: Record<ReadmeCardVariant, { bg: string; border: string; text: string; muted: string; accent: string; chipBg: string }> = {
    light: { bg: "#ffffff", border: "#d0d7de", text: "#1f2328", muted: "#59636e", accent: "#a24120", chipBg: "#f6f8fa" },
    dark: { bg: "#0d1117", border: "#30363d", text: "#e6edf3", muted: "#9198a1", accent: "#ffaa8d", chipBg: "#161b22" },
};

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif`;

function currentRole(model: DocumentModel): string {
    const entry = model.sections.find((section) => section.type === "experience")?.entries[0];
    if (!entry) return "";
    return [entry.title.trim(), entry.subtitle.trim()].filter(Boolean).join(" · ");
}

function chips(model: DocumentModel, palette: (typeof PALETTE)[ReadmeCardVariant], y: number): string[] {
    const out: string[] = [];
    let x = PADDING;
    for (const skill of readmeSkills(model).slice(0, MAX_CHIPS)) {
        const label = truncate(skill, CARD_BUDGET.chip);
        const width = Array.from(label).length * CHIP_CHAR_WIDTH + CHIP_PADDING;
        if (x + width > WIDTH - PADDING) break;
        out.push(
            `<rect x="${x}" y="${y}" width="${width}" height="24" rx="12" fill="${palette.chipBg}" stroke="${palette.border}"/>`,
            `<text x="${x + width / 2}" y="${y + 16}" text-anchor="middle" font-size="12" fill="${palette.text}">${escapeXml(label)}</text>`,
        );
        x += width + CHIP_GAP;
    }
    return out;
}

export function toReadmeCard(model: DocumentModel, variant: ReadmeCardVariant): string {
    const palette = PALETTE[variant];
    const { name, headline, location } = model.basics;
    const role = currentRole(model);
    const title = [name, headline].filter(Boolean).join(" — ");

    const lines: string[] = [];
    let y = 48;
    if (name) {
        lines.push(`<text x="${PADDING}" y="${y}" font-size="22" font-weight="700" fill="${palette.text}">${escapeXml(truncate(name, CARD_BUDGET.name))}</text>`);
        y += 26;
    }
    if (headline) {
        lines.push(`<text x="${PADDING}" y="${y}" font-size="14" font-weight="600" fill="${palette.accent}">${escapeXml(truncate(headline, CARD_BUDGET.headline))}</text>`);
        y += 22;
    }
    if (location) {
        lines.push(`<text x="${PADDING}" y="${y}" font-size="12" fill="${palette.muted}">${escapeXml(truncate(location, CARD_BUDGET.location))}</text>`);
        y += 20;
    }
    if (role) {
        lines.push(`<text x="${PADDING}" y="${y}" font-size="12" fill="${palette.muted}">${escapeXml(truncate(role, CARD_BUDGET.role))}</text>`);
    }

    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title">`,
        `<title id="title">${escapeXml(title)}</title>`,
        `<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="6" fill="${palette.bg}" stroke="${palette.border}"/>`,
        `<g font-family="${FONT}">`,
        ...lines,
        ...chips(model, palette, HEIGHT - PADDING - 24),
        "</g>",
        "</svg>",
        "",
    ].join("\n");
}
