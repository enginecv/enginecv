"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState, type ReactNode } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { db } from "@/lib/db";
import { useTranslation } from "@/lib/i18n";
import { excludeFromWorkspace, includeInWorkspace, useWorkspaceStore } from "@/lib/workspace/controller";

function IncludeDialog({ onChoose, onCancel }: { onChoose: (choice: "keep-app" | "use-file") => void; onCancel: () => void }) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onCancel);
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onCancel} />
            <div ref={ref} role="dialog" aria-modal="true" aria-label={t("workspace.include.title")} data-testid="workspace-include" className="glass-panel relative w-full max-w-md rounded-2xl p-6 shadow-2xl">
                <h3 className="text-lg font-bold text-strong">{t("workspace.include.title")}</h3>
                <p className="mt-2 text-sm text-mid">{t("workspace.include.body")}</p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={onCancel} className="rounded-xl border border-edge bg-surface-4 px-4 py-2 text-sm font-bold text-mid hover:border-faint hover:text-strong">{t("dashboard.cancel")}</button>
                    <button type="button" onClick={() => onChoose("use-file")} data-testid="workspace-include-file" className="rounded-xl border border-edge bg-surface-4 px-4 py-2 text-sm font-bold text-strong hover:border-faint">{t("workspace.include.useFile")}</button>
                    <button type="button" onClick={() => onChoose("keep-app")} data-testid="workspace-include-app" className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-surface-2 hover:bg-accent-soft">{t("workspace.include.keepApp")}</button>
                </div>
            </div>
        </div>
    );
}

/**
 * The "leave out of / add to workspace folder" choice for one document. `item` is null when no folder
 * is connected or the document is not known to it; render `dialog` once wherever the item is used.
 */
export function useWorkspaceMembership(docId: string | null | undefined): { item: { label: string; onClick: () => void; testId: string } | null; dialog: ReactNode } {
    const { t } = useTranslation();
    const connected = useWorkspaceStore((state) => state.phase === "connected");
    const row = useLiveQuery(() => (docId ? db.workspaceDocs.get(docId) : undefined), [docId]);
    const [asking, setAsking] = useState(false);
    if (!connected || !row) return { item: null, dialog: null };

    const item = row.included
        ? { label: t("workspace.menu.exclude"), onClick: () => void excludeFromWorkspace(row.docId), testId: "workspace-menu-exclude" }
        : { label: t("workspace.menu.include"), onClick: () => (row.fileName ? setAsking(true) : void includeInWorkspace(row.docId, "keep-app")), testId: "workspace-menu-include" };
    // Cards are clickable; a click inside the dialog must not open the document behind it.
    const dialog = asking ? <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><IncludeDialog onCancel={() => setAsking(false)} onChoose={(choice) => { setAsking(false); void includeInWorkspace(row.docId, choice); }} /></div> : null;
    return { item, dialog };
}
