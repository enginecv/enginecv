import { create } from "zustand";
import type { DocKind } from "./types";

/**
 * What the app says when something happens in the connected folder: a new document made from a file,
 * an outside edit applied, an export finished, a change that needs a look, a change that was refused.
 * The agent is named only when it signed the file or the request; otherwise the text says "a file".
 */

export type NoticeKind = "created" | "edited" | "exported" | "review" | "refused";

export interface AgentNotice {
    id: string;
    kind: NoticeKind;
    docId: string | null;
    docKind: DocKind | null;
    title: string;
    agent: string | null;
    /** Consecutive edits to one document are grouped into one notice. */
    count: number;
    added: number;
    removed: number;
    changed: number;
    format: string | null;
    /** The activity row an edit can be undone from. */
    activityId: number | null;
    code: string | null;
    at: number;
    /** A notice that needs a look stays until it is dismissed. */
    sticky: boolean;
}

export type NewNotice = Partial<Omit<AgentNotice, "id" | "kind" | "title" | "at">> & Pick<AgentNotice, "kind" | "title">;

/** Edits to one document within this time join the notice already showing. */
export const GROUP_WINDOW_MS = 8000;
export const MAX_NOTICES = 4;

interface NoticeState {
    notices: AgentNotice[];
    push: (notice: NewNotice, now?: number) => void;
    dismiss: (id: string) => void;
    clear: () => void;
}

let counter = 0;

export const useNotices = create<NoticeState>((set) => ({
    notices: [],
    push: (input, now = Date.now()) =>
        set((state) => {
            const notice: AgentNotice = {
                docId: null, docKind: null, agent: null, count: 1, added: 0, removed: 0, changed: 0, format: null, activityId: null, code: null,
                sticky: input.kind === "review" || input.kind === "refused",
                ...input,
                id: `notice-${(counter += 1)}`,
                at: now,
            };
            let list = state.notices;
            if (notice.kind === "edited") {
                const open = list.find((entry) => entry.kind === "edited" && entry.docId === notice.docId && entry.agent === notice.agent && now - entry.at <= GROUP_WINDOW_MS);
                if (open) {
                    const merged: AgentNotice = { ...open, count: open.count + 1, added: open.added + notice.added, removed: open.removed + notice.removed, changed: open.changed + notice.changed, activityId: notice.activityId ?? open.activityId, at: now };
                    return { notices: list.map((entry) => (entry.id === open.id ? merged : entry)) };
                }
            }
            // The same problem about the same document replaces the earlier one instead of stacking.
            if (notice.kind === "review" || notice.kind === "refused") list = list.filter((entry) => !(entry.kind === notice.kind && entry.docId === notice.docId && entry.code === notice.code));
            list = [...list, notice];
            while (list.length > MAX_NOTICES) {
                const drop = list.findIndex((entry) => !entry.sticky) ;
                list = list.filter((_, index) => index !== (drop === -1 ? 0 : drop));
            }
            return { notices: list };
        }),
    dismiss: (id) => set((state) => ({ notices: state.notices.filter((entry) => entry.id !== id) })),
    clear: () => set({ notices: [] }),
}));
