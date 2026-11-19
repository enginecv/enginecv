"use client";

import { useTranslation } from "@/lib/i18n";
import type { DocState, DocReason } from "@/lib/workspace/types";

const TONE: Record<DocState, string> = {
    "in-sync": "border-edge text-faint",
    paused: "border-edge text-faint",
    "needs-permission": "border-accent/40 text-accent",
    blocked: "border-danger/40 text-danger",
    review: "border-accent/40 text-accent",
    busy: "border-edge text-faint",
    detached: "border-danger/40 text-danger",
    broken: "border-danger/40 text-danger",
};

/** Small status chip for a workspace document; the reason is the tooltip so the chip stays short. */
/** A chip on a dashboard card opens the activity list for that document: the event is handled where the panel lives. */
export const OPEN_WORKSPACE_ACTIVITY_EVENT = "enginecv:open-workspace-activity";

export function DocStateChip({ state, reason, excluded, label, docId }: { state: DocState; reason?: DocReason | null; excluded?: boolean; label?: string; docId?: string | null }) {
    const { t } = useTranslation();
    const key = label ?? (excluded ? "workspace.state.excluded" : `workspace.state.${state}`);
    const tone = excluded ? TONE.paused : TONE[state];
    const classes = `inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`;
    if (docId) {
        return (
            <button
                type="button"
                title={reason ? t(`workspace.reason.${reason.code}`) : t("workspace.activity.open")}
                data-testid={`doc-state-${excluded ? "excluded" : state}`}
                onClick={(event) => {
                    event.stopPropagation();
                    window.dispatchEvent(new CustomEvent(OPEN_WORKSPACE_ACTIVITY_EVENT, { detail: { docId } }));
                }}
                className={`${classes} cursor-pointer hover:border-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
            >
                {t(key)}
            </button>
        );
    }
    return (
        <span title={reason ? t(`workspace.reason.${reason.code}`) : undefined} data-testid={`doc-state-${excluded ? "excluded" : state}`} className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
            {t(key)}
        </span>
    );
}
