"use client";

import Link from "next/link";
import { AlertTriangle, FileDown, FilePlus, Pencil, ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { undoActivity } from "@/lib/workspace/activity";
import { useNotices, type AgentNotice } from "@/lib/workspace/notices";

/** How long an ordinary notification stays; one that needs a look stays until it is dismissed. */
export const NOTICE_MS = 8000;

const ICONS = { created: FilePlus, edited: Pencil, exported: FileDown, review: ShieldAlert, refused: AlertTriangle } as const;

function hrefOf(notice: AgentNotice): string | null {
    if (!notice.docId || !notice.docKind) return null;
    if (notice.docKind === "application") return `/dashboard?tab=jobs&application=${notice.docId}`;
    return notice.docKind === "cv" ? `/editor/${notice.docId}` : `/letters/${notice.docId}`;
}

function NoticeItem({ notice }: { notice: AgentNotice }) {
    const { t } = useTranslation();
    const dismiss = useNotices((state) => state.dismiss);
    const [hovered, setHovered] = useState(false);
    const [undone, setUndone] = useState(false);

    // A notice that is not asking for anything goes away by itself; a new edit joining it starts the time again.
    useEffect(() => {
        if (notice.sticky || hovered) return;
        const timer = setTimeout(() => dismiss(notice.id), NOTICE_MS);
        return () => clearTimeout(timer);
    }, [notice.id, notice.at, notice.sticky, hovered, dismiss]);

    const Icon = ICONS[notice.kind];
    const agent = notice.agent;
    const kindWord = t(notice.docKind === "letter" ? "workspace.notice.kindLetter" : "workspace.notice.kindCv");
    const title = notice.title || "…";
    const changes = notice.count > 1
        ? t("workspace.notice.changesMany", { count: notice.count, added: notice.added, removed: notice.removed, changed: notice.changed })
        : t("workspace.notice.changes", { added: notice.added, removed: notice.removed, changed: notice.changed });
    const reasonKey = `workspace.reason.${notice.code}`;
    const reasonText = notice.code ? (t(reasonKey) === reasonKey ? notice.code : t(reasonKey)) : "";

    let text: string;
    switch (notice.kind) {
        case "created":
            text = agent ? t("workspace.notice.created", { agent, kind: kindWord, title }) : t("workspace.notice.createdFile", { kind: kindWord, title });
            break;
        case "edited":
            text = agent ? t("workspace.notice.edited", { agent, title, changes }) : t("workspace.notice.editedFile", { title, changes });
            break;
        case "exported":
            text = agent ? t("workspace.notice.exported", { agent, title, format: notice.format ?? "" }) : t("workspace.notice.exportedFile", { title, format: notice.format ?? "" });
            break;
        case "review":
            text = agent ? t("workspace.notice.review", { agent, title }) : t("workspace.notice.reviewFile", { title });
            break;
        default:
            text = notice.docId
                ? (agent ? t("workspace.notice.refused", { agent, title, reason: reasonText }) : t("workspace.notice.refusedFile", { title, reason: reasonText }))
                : (agent ? t("workspace.notice.refusedRequest", { agent, reason: reasonText }) : t("workspace.notice.refusedRequestFile", { reason: reasonText }));
    }

    const href = hrefOf(notice);
    const canUndo = notice.kind === "edited" && notice.activityId !== null && !undone;
    const action = "text-sm font-bold text-accent hover:underline";

    return (
        <div
            role={notice.sticky ? "alert" : "status"}
            data-testid={`agent-notice-${notice.kind}`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
            className="flex items-start gap-3 rounded-xl border border-edge bg-surface-4 px-4 py-3 shadow-2xl"
        >
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${notice.kind === "refused" || notice.kind === "review" ? "text-warning" : "text-accent"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <p className="break-words text-sm text-strong" data-testid="agent-notice-text">{text}</p>
                {(href || canUndo) && (
                    <div className="mt-1.5 flex gap-4">
                        {href && <Link href={href} onClick={() => dismiss(notice.id)} className={action} data-testid="agent-notice-open">{t("workspace.notice.open")}</Link>}
                        {canUndo && (
                            <button
                                type="button"
                                data-testid="agent-notice-undo"
                                className={action}
                                onClick={() => {
                                    setUndone(true);
                                    void undoActivity(notice.activityId!).finally(() => dismiss(notice.id));
                                }}
                            >
                                {t("workspace.notice.undo")}
                            </button>
                        )}
                    </div>
                )}
            </div>
            <button type="button" onClick={() => dismiss(notice.id)} aria-label={t("workspace.notice.dismiss")} data-testid="agent-notice-dismiss" className="shrink-0 rounded-md p-1 text-faint hover:text-strong">
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );
}

/** The stack of notifications about what happens in the connected folder. Lives once in the page shell. */
export function AgentNotices() {
    const notices = useNotices((state) => state.notices);
    if (notices.length === 0) return null;
    return (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[215] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" data-testid="agent-notices">
            {notices.map((notice) => (
                <div key={notice.id} className="pointer-events-auto">
                    <NoticeItem notice={notice} />
                </div>
            ))}
        </div>
    );
}
