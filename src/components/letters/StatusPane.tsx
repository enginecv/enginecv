"use client";

import { Copy, Link2, Lock, Send, Unlock } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { LetterDocument } from "@/lib/letters/schema";
import { PaneSection } from "./fields";

/**
 * Where the letter stands: a draft follows its CV; a sent or frozen letter keeps what
 * it had. Sending, unfreezing and duplicating as a draft are explicit choices made here.
 */
export function StatusPane({ letter, busy, canDuplicate, onMarkSent, onUnfreeze, onDuplicate, onLinkCv }: {
    letter: LetterDocument;
    busy: boolean;
    /** A copy needs a CV to follow; a letter whose CV is gone cannot be copied from here. */
    canDuplicate: boolean;
    onMarkSent: () => void;
    onUnfreeze: () => void;
    onDuplicate: () => void;
    /** Offered on a standalone draft: follow a CV from now on. */
    onLinkCv?: () => void;
}) {
    const { t } = useTranslation();
    const frozenOn = letter.frozen ? new Date(letter.frozen.at).toLocaleDateString() : "";
    const draft = letter.status === "draft";
    const button = "flex items-center gap-2 rounded-xl border border-edge bg-surface-1 px-3 py-2 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong disabled:opacity-50";

    return (
        <PaneSection title={t("letters.section.status")} testId="letter-status-pane">
            <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${draft ? "bg-surface-1 text-mid" : "bg-accent/15 text-accent"}`} data-testid="letter-status-chip">
                    {t(`letters.status.${letter.status}`)}
                </span>
                <p className="text-xs text-mid" data-testid="letter-status-text">
                    {draft
                        ? t(letter.standalone ? "letters.status.standalone" : "letters.status.followsCv")
                        : t(letter.status === "sent" ? "letters.status.sentOn" : "letters.status.snapshotOn", { date: frozenOn })}
                </p>
            </div>
            <div className="flex flex-wrap gap-2">
                {draft ? (
                    <button type="button" disabled={busy} onClick={onMarkSent} data-testid="letter-mark-sent" className={button}>
                        <Send className="h-4 w-4" aria-hidden="true" />
                        {t("letters.action.markSent")}
                    </button>
                ) : null}
                {draft && letter.standalone && onLinkCv ? (
                    <button type="button" disabled={busy} onClick={onLinkCv} data-testid="letter-link-cv" className={button}>
                        <Link2 className="h-4 w-4" aria-hidden="true" />
                        {t("letters.action.linkCv")}
                    </button>
                ) : null}
                {!draft && (
                    <>
                        <button type="button" disabled={busy} onClick={onUnfreeze} data-testid="letter-unfreeze" className={button}>
                            <Unlock className="h-4 w-4" aria-hidden="true" />
                            {t("letters.action.unfreeze")}
                        </button>
                        <button type="button" disabled={busy || !canDuplicate} onClick={onDuplicate} data-testid="letter-duplicate-draft" className={button}>
                            <Copy className="h-4 w-4" aria-hidden="true" />
                            {t("letters.action.duplicateDraft")}
                        </button>
                    </>
                )}
            </div>
            {!draft && (
                <p className="flex items-center gap-1.5 text-xs text-faint">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    {t("letters.status.readOnlyHint")}
                </p>
            )}
        </PaneSection>
    );
}
