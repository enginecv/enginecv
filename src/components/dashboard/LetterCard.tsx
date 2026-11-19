"use client";

import { ArrowRightLeft, Copy, CopyPlus, Mail, Trash2, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { LetterDocument } from "@/lib/letters/schema";
import { DocStateBadge } from "@/components/workspace/DocStateBadge";

export function letterDisplayTitle(letter: LetterDocument, untitled: string): string {
    return letter.title.trim() || [letter.company, letter.role].map((part) => part.trim()).filter(Boolean).join(" - ") || untitled;
}

export interface LetterCardActions {
    onDuplicate: () => void;
    onDuplicateInto: () => void;
    onRepoint: () => void;
    onDelete: () => void;
}

function ActionButton({ icon: Icon, label, onClick, testId, danger = false, disabled = false }: { icon: LucideIcon; label: string; onClick: () => void; testId: string; danger?: boolean; disabled?: boolean }) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} data-testid={testId} className={`flex h-8 w-8 items-center justify-center rounded-lg border border-edge text-faint transition-colors hover:border-faint disabled:opacity-40 ${danger ? "hover:text-danger" : "hover:text-strong"}`}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
    );
}

/** One letter in the dashboard list: title, who and what for, status, when it last changed, and its actions. */
export function LetterCard({ letter, onOpen, actions, needsCv = false }: { letter: LetterDocument; onOpen: () => void; actions: LetterCardActions; needsCv?: boolean }) {
    const { t } = useTranslation();
    const title = letterDisplayTitle(letter, t("letters.editor.untitled"));
    const detail = [letter.recipient.name.trim(), letter.company.trim()].filter(Boolean).join(" · ");
    // Only a draft follows a CV, so only a draft can be moved.
    const canRepoint = letter.status === "draft";
    return (
        <article data-testid="letter-card" data-letter-id={letter.id} className="group flex h-full flex-col rounded-2xl border border-edge bg-surface-4/80 p-4 transition-all duration-300 hover:border-accent/30 hover:bg-surface-5">
            <button type="button" onClick={onOpen} aria-label={t("dashboard.letters.openNamed", { name: title })} className="flex flex-1 flex-col gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <div className="flex items-start justify-between gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-1 text-faint" aria-hidden="true"><Mail className="h-4 w-4" /></span>
                    <span className="flex flex-wrap justify-end gap-1.5">
                        {needsCv && <span className="rounded-md bg-danger/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger" data-testid="letter-needs-cv">{t("dashboard.letters.needsCv")}</span>}
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${letter.status === "draft" ? "bg-surface-1 text-mid" : "bg-accent/15 text-accent"}`} data-testid="letter-status">
                            {t(`letters.status.${letter.status}`)}
                        </span>
                    </span>
                </div>
                <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-strong">{title}</h3>
                    <div className="mt-1 empty:hidden"><DocStateBadge docId={letter.id} /></div>
                    {detail && <p className="mt-1 truncate text-sm text-mid">{detail}</p>}
                </div>
                <p className="mt-auto text-xs text-faint">{t("dashboard.letters.updated", { date: new Date(letter.updatedAt).toLocaleDateString() })}</p>
            </button>
            <div className="mt-3 flex items-center gap-1.5 border-t border-edge pt-3">
                <ActionButton icon={Copy} label={t("dashboard.letters.duplicate")} onClick={actions.onDuplicate} testId="letter-action-duplicate" />
                <ActionButton icon={CopyPlus} label={t("dashboard.letters.duplicateInto")} onClick={actions.onDuplicateInto} testId="letter-action-duplicate-into" />
                <ActionButton icon={ArrowRightLeft} label={t("dashboard.letters.repoint")} onClick={actions.onRepoint} testId="letter-action-repoint" disabled={!canRepoint} />
                <span className="flex-1" />
                <ActionButton icon={Trash2} label={t("dashboard.letters.delete")} onClick={actions.onDelete} testId="letter-action-delete" danger />
            </div>
        </article>
    );
}
