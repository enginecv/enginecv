"use client";

import { FileWarning, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { grantAndAttach } from "@/lib/linked-file/controller";
import { OPEN_LINKED_FILE_PANEL_EVENT } from "@/lib/linked-file/types";
import { useResumeStore } from "@/lib/store";

const actionButton = "rounded-lg border border-edge bg-surface-1 px-3 py-1.5 text-xs font-medium text-strong transition-colors hover:border-faint";

/**
 * Shown under the editor header when a linked CV opened but the browser no longer lets
 * the page touch the file (it asks again after every restart), so the person sees at once
 * that syncing is off and that they can turn it back on or link the file again.
 */
export function LinkedFileNotice({ resumeId }: { resumeId: string }) {
    const { t } = useTranslation();
    const { status, fileName } = useResumeStore((state) => state.linkedFile);
    const [dismissed, setDismissed] = useState<string | null>(null);

    if (status !== "needs-permission" && status !== "broken") return null;
    const key = `${resumeId}:${status}`;
    if (dismissed === key) return null;

    const name = fileName ?? t("linkedFile.title");
    const needsPermission = status === "needs-permission";
    const openPanel = () => window.dispatchEvent(new Event(OPEN_LINKED_FILE_PANEL_EVENT));

    return (
        <div role="status" data-testid="linked-file-notice" className="mx-3 mb-1 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-accent/30 bg-surface-2 px-4 py-2.5 sm:mx-6 print:hidden">
            <FileWarning className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <div className="min-w-0 flex-1 basis-64">
                <p className="text-sm font-medium text-strong">
                    {t(needsPermission ? "linkedFile.notice.needsPermission.title" : "linkedFile.notice.broken.title", { name })}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-mid">
                    {t(needsPermission ? "linkedFile.notice.needsPermission.body" : "linkedFile.notice.broken.body")}
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {needsPermission ? (
                    <button type="button" className={actionButton} onClick={() => void grantAndAttach(resumeId)} data-testid="linked-file-notice-grant">
                        {t("linkedFile.resumeSyncing")}
                    </button>
                ) : (
                    <button type="button" className={actionButton} onClick={openPanel} data-testid="linked-file-notice-relink">
                        {t("linkedFile.notice.linkAgain")}
                    </button>
                )}
                {needsPermission && (
                    <button type="button" className={actionButton} onClick={openPanel} data-testid="linked-file-notice-options">
                        {t("linkedFile.notice.options")}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => setDismissed(key)}
                    aria-label={t("linkedFile.notice.dismiss")}
                    title={t("linkedFile.notice.dismiss")}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition-colors hover:bg-edge hover:text-strong"
                    data-testid="linked-file-notice-dismiss"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}
