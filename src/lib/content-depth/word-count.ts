/**
 * Content-depth helpers. The numeric floors live in
 * specs/078-adsense-content-depth/contracts/content-rules.md; these functions
 * only measure. They are used by tests, never shipped to the client.
 *
 * RoleProse shape (src/lib/role-examples/registry.ts): `intro`, `tips[]`,
 * `skills[]`, and optional `sections[]` ({ heading, paragraphs[] }). Skills are
 * list chips, not prose, so they are not counted. See corpus.ts.
 */

/** Paragraphs shorter than this are labels or one-liners and are ignored by the uniqueness check. */
export const MIN_COMPARABLE_WORDS = 12;

const SHINGLE_SIZE = 4;

/** Words in plain text. Whitespace-separated, so hyphenated terms and numbers count once. */
export function countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Reader-visible text of an MDX document: drops front matter, fenced and inline
 * code, HTML/JSX tags and link or image targets (keeping the link text), and
 * heading, list and quote markers.
 */
export function stripMarkdown(source: string): string {
    return source
        .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/~~~[\s\S]*?~~~/g, " ")
        .replace(/`[^`\n]*`/g, " ")
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/<[^>\n]+>/g, " ")
        .replace(/^\s{0,3}#{1,6}\s+/gm, "")
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
        .replace(/^\s*>\s?/gm, "")
        .replace(/[*_]{1,3}([^*_\n]+)[*_]{1,3}/g, "$1");
}

/** Blank-line separated paragraphs, trimmed, empties removed. */
export function paragraphs(text: string): string[] {
    return text
        .split(/\r?\n\s*\r?\n/)
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter(Boolean);
}

function shingles(text: string): Set<string> {
    const words = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter(Boolean);
    const out = new Set<string>();
    for (let i = 0; i + SHINGLE_SIZE <= words.length; i++) out.add(words.slice(i, i + SHINGLE_SIZE).join(" "));
    return out;
}

/**
 * Share of the shorter text's 4-word shingles that also appear in the other, in
 * [0, 1]. Containment rather than Jaccard, so a paragraph pasted into a longer
 * one still scores high. Texts under 4 words score 0.
 */
export function similarity(a: string, b: string): number {
    const left = shingles(a);
    const right = shingles(b);
    if (left.size === 0 || right.size === 0) return 0;
    const [small, large] = left.size <= right.size ? [left, right] : [right, left];
    let shared = 0;
    for (const shingle of small) if (large.has(shingle)) shared++;
    return shared / small.size;
}

export interface CorpusParagraph {
    docId: string;
    text: string;
}

export interface DuplicatePair {
    a: CorpusParagraph;
    b: CorpusParagraph;
    score: number;
}

/**
 * Pairs of comparable paragraphs from different documents whose similarity is
 * above `threshold`. Paragraphs under MIN_COMPARABLE_WORDS are skipped.
 */
export function findDuplicates(items: CorpusParagraph[], threshold: number): DuplicatePair[] {
    const comparable = items.filter((item) => countWords(item.text) >= MIN_COMPARABLE_WORDS);
    const found: DuplicatePair[] = [];
    for (let i = 0; i < comparable.length; i++) {
        for (let j = i + 1; j < comparable.length; j++) {
            if (comparable[i].docId === comparable[j].docId) continue;
            const score = similarity(comparable[i].text, comparable[j].text);
            if (score > threshold) found.push({ a: comparable[i], b: comparable[j], score });
        }
    }
    return found;
}
