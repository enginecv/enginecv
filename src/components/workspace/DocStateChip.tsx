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
export function DocStateChip({ state, reason, excluded }: { state: DocState; reason?: DocReason | null; excluded?: boolean }) {
    const { t } = useTranslation();
    const key = excluded ? "workspace.state.excluded" : `workspace.state.${state}`;
    const tone = excluded ? TONE.paused : TONE[state];
    return (
        <span title={reason ? t(`workspace.reason.${reason.code}`) : undefined} data-testid={`doc-state-${excluded ? "excluded" : state}`} className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
            {t(key)}
        </span>
    );
}
