import type { Notice } from "@/lib/agent/authoring/notices";

export type LinkStatus =
    | "none"
    | "unsupported"
    | "needs-permission"
    | "in-sync"
    | "paused"
    | "busy"
    | "error"
    | "broken";

/** Fired to open the link panel from elsewhere (the getting-started checklist). */
export const OPEN_LINKED_FILE_PANEL_EVENT = "enginecv:open-linked-file";

export type LinkErrorCode = "empty" | "too-large" | "no-document" | "invalid-json" | "full-export" | "newer-version";

/** Which side moved while syncing was off; the person picks the winner. */
export interface LinkDivergence {
    fileChanged: boolean;
    cvChanged: boolean;
}

export interface LinkedFileState {
    status: LinkStatus;
    fileName: string | null;
    lastSyncedAt: number | null;
    error: { code: LinkErrorCode; line?: number; column?: number } | null;
    divergence: LinkDivergence | null;
    lastUpdate: { at: number; added: number; removed: number; changed: number; notices: Notice[] } | null;
}

export const INITIAL_LINKED_FILE_STATE: LinkedFileState = {
    status: "none",
    fileName: null,
    lastSyncedAt: null,
    error: null,
    divergence: null,
    lastUpdate: null,
};
