"use client";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import type { CleanResult } from "@/lib/json-edit/clean";

export function CleanupReviewDialog({ result, onAccept, onDismiss, onJump }: { result: CleanResult; onAccept: () => void; onDismiss: () => void; onJump: (path: string) => void }) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onDismiss);
    return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-surface-2/80 p-4">
        <div ref={ref} role="dialog" aria-modal="true" aria-label={t("jsonEditor.cleanupTitle")} className="glass-panel w-full max-w-lg max-h-[85dvh] overflow-auto rounded-2xl p-5 text-strong">
            <h2 className="text-lg font-semibold">{t("jsonEditor.cleanupTitle")}</h2>
            {result.status === "blocked" && <p role="alert" className="my-3 text-sm text-danger">{t(result.authoring ? "jsonEditor.problem.authoring-format" : "jsonEditor.cannotRepair")} {result.error?.line && t("jsonEditor.location", { line: result.error.line, column: result.error.column ?? 1 })}</p>}
            {result.notices.length === 0 && result.status === "ok" && <p className="my-4">{t("jsonEditor.noFixes")}</p>}
            {(["repaired", "adjusted", "skipped", "review"] as const).map(kind => {
                const group = result.notices.filter(notice => notice.kind === kind);
                return group.length > 0 && <section key={kind} className="my-4">
                    <h3 className="text-sm font-semibold">{t(`authoring.noticeKind.${kind}`)}</h3>
                    <ul className="mt-2 space-y-2 text-sm">{group.map((notice, i) => <li key={i}><button type="button" onClick={() => onJump(notice.path)} className="w-full text-left break-words"><span>{t(`authoring.notice.${notice.code}`, notice.params)}</span> <code className="text-xs break-all text-faint">{notice.path}</code></button></li>)}</ul>
                </section>;
            })}
            <div className="sticky bottom-0 mt-5 flex flex-wrap justify-end gap-2 bg-surface-2 py-2">
                <button type="button" onClick={onDismiss} className="rounded-lg border border-edge px-3 py-2">{t("jsonEditor.dismiss")}</button>
                {result.status === "ok" && <button type="button" onClick={onAccept} className="rounded-lg bg-accent px-3 py-2 text-surface-1">{t("jsonEditor.acceptCleanup")}</button>}
            </div>
        </div>
    </div>;
}
