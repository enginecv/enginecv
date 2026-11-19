import { INDEX_FORMAT } from "./format-version";
import type { DocKind, DocReason, DocState } from "./types";

/**
 * `.enginecv/index.json`: the small summary an agent reads first so it never has to open every
 * document. It holds ids, titles, file names, links, section sizes, trouble states and times, and nothing
 * else (a letter's own id is in its file; the index only needs its file and the CV it follows): no contact details and no document text (FR-050). It is generated, never read back as content.
 */

export interface IndexCvInput {
    id: string;
    fileName: string;
    title: string;
    language: string;
    updatedAt: number;
    entries: Record<string, number>;
}

export interface IndexLetterInput {
    id: string;
    fileName: string;
    /** The CV the letter follows, or null for a standalone letter. */
    cvId: string | null;
    company: string;
    role: string;
    status: "draft" | "sent";
    updatedAt: number;
}

export interface IndexDocState {
    state: DocState;
    reason: DocReason | null;
}

export interface WorkspaceIndex {
    format: typeof INDEX_FORMAT;
    updated: string;
    cvs: Array<{
        id: string;
        file: string;
        title: string;
        lang: string;
        updated: string;
        state?: DocState;
        reason?: string;
        entries: Record<string, number>;
    }>;
    letters: Array<{
        file: string;
        cv: string | null;
        company: string;
        role: string;
        status: "draft" | "sent";
        updated: string;
        state?: DocState;
        reason?: string;
    }>;
}

const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

/** Titles and company names are the person's own words but short; cap them so one odd title cannot blow the budget. */
const clip = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function buildIndex(input: { cvs: readonly IndexCvInput[]; letters: readonly IndexLetterInput[]; states: ReadonlyMap<string, IndexDocState>; now: number }): WorkspaceIndex {
    const stateOf = (id: string): IndexDocState => input.states.get(id) ?? { state: "in-sync", reason: null };
    // A document in sync needs no word about it; only trouble is spelled out.
    const troubleOf = (state: IndexDocState) => (state.state === "in-sync" ? {} : { state: state.state, ...(state.reason ? { reason: state.reason.code } : {}) });

    return {
        format: INDEX_FORMAT,
        updated: iso(input.now),
        cvs: [...input.cvs]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((cv) => {
                const state = stateOf(cv.id);
                return { id: cv.id, file: `cvs/${cv.fileName}`, title: clip(cv.title), lang: cv.language, updated: iso(cv.updatedAt), ...troubleOf(state), entries: cv.entries };
            }),
        letters: [...input.letters]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((letter) => {
                const state = stateOf(letter.id);
                return { file: `letters/${letter.fileName}`, cv: letter.cvId, company: clip(letter.company), role: clip(letter.role), status: letter.status, updated: iso(letter.updatedAt), ...troubleOf(state) };
            }),
    };
}

export function indexText(index: WorkspaceIndex): string {
    return `${JSON.stringify(index)}\n`;
}

export type IndexKind = DocKind;
