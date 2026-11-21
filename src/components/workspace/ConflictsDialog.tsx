"use client";

import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import type { Reconciliation } from "@/lib/workspace/documents";
import type { ConflictCopy } from "@/lib/workspace/scan";
import type { WorkspaceDocRecord } from "@/lib/workspace/types";

export interface ConflictsProps {
    attention: { unmatched: Reconciliation["unmatched"]; duplicates: Reconciliation["duplicates"]; conflictCopies: ConflictCopy[] };
    detached: Array<{ row: WorkspaceDocRecord; title: string }>;
    onKeepFile: (docId: string, keep: string, others: string[]) => void;
    onRelink: (docId: string, fileName: string) => void;
    onRecreate: (docId: string) => void;
    onIgnore: (fileName: string) => void;
    onClose: () => void;
}

const btn = "rounded-lg border border-edge bg-surface-4 px-2.5 py-1 text-xs font-medium text-strong hover:border-faint";

/** Everything in the folder that needs a person: detached documents, two files for one, copies, strays. Nothing is applied or deleted here without a click. */
export function ConflictsDialog({ attention, detached, onKeepFile, onRelink, onRecreate, onIgnore, onClose }: ConflictsProps) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onClose);
    const empty = !detached.length && !attention.duplicates.length && !attention.conflictCopies.length && !attention.unmatched.length;
    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onClose} />
            <div ref={ref} role="dialog" aria-modal="true" aria-label={t("workspace.conflicts.title")} data-testid="workspace-conflicts" className="glass-panel relative max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl p-6 shadow-2xl">
                <h3 className="text-lg font-bold text-strong">{t("workspace.conflicts.title")}</h3>
                {empty ? <p className="mt-3 text-sm text-mid" data-testid="workspace-conflicts-empty">{t("workspace.conflicts.empty")}</p> : <p className="mt-1 text-xs text-faint">{t("workspace.conflicts.hint")}</p>}

                {detached.length > 0 && (
                    <section className="mt-4" data-testid="workspace-conflicts-detached">
                        <h4 className="text-sm font-bold text-strong">{t("workspace.conflicts.detachedTitle")}</h4>
                        {detached.map(({ row, title }) => (
                            <div key={row.docId} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span className="text-mid">{title}</span>
                                {row.kind === "cv" && <button type="button" className={btn} data-testid={`workspace-recreate-${row.docId}`} onClick={() => onRecreate(row.docId)}>{t("workspace.conflicts.recreate")}</button>}
                            </div>
                        ))}
                        {attention.unmatched.length > 0 && detached.map(({ row }) => attention.unmatched.filter((file) => file.kind === row.kind).map((file) => (
                            <button key={`${row.docId}-${file.fileName}`} type="button" className={`${btn} mt-1 mr-1`} data-testid={`workspace-relink-${row.docId}`} onClick={() => onRelink(row.docId, file.fileName)}>{t("workspace.conflicts.relink")}: {file.fileName}</button>
                        )))}
                    </section>
                )}

                {attention.duplicates.length > 0 && (
                    <section className="mt-4" data-testid="workspace-conflicts-duplicates">
                        <h4 className="text-sm font-bold text-strong">{t("workspace.conflicts.duplicatesTitle")}</h4>
                        {attention.duplicates.map((duplicate) => (
                            <div key={duplicate.docId} className="mt-2 space-y-1">
                                {duplicate.files.map((file) => (
                                    <div key={file} className="flex items-center justify-between gap-2 text-sm">
                                        <span className="break-all text-mid">{file}</span>
                                        <button type="button" className={btn} data-testid={`workspace-keep-${file}`} onClick={() => onKeepFile(duplicate.docId, file, duplicate.files.filter((other) => other !== file))}>{t("workspace.conflicts.keepFile")}</button>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </section>
                )}

                {attention.conflictCopies.length > 0 && (
                    <section className="mt-4" data-testid="workspace-conflicts-copies">
                        <h4 className="text-sm font-bold text-strong">{t("workspace.conflicts.copiesTitle")}</h4>
                        {attention.conflictCopies.map((copy) => (
                            <div key={copy.fileName} className="mt-2 flex items-center justify-between gap-2 text-sm">
                                <span className="break-all text-mid">{copy.fileName}</span>
                                <button type="button" className={btn} onClick={() => onIgnore(copy.fileName)}>{t("workspace.conflicts.ignore")}</button>
                            </div>
                        ))}
                    </section>
                )}

                {attention.unmatched.length > 0 && (
                    <section className="mt-4" data-testid="workspace-conflicts-strays">
                        <h4 className="text-sm font-bold text-strong">{t("workspace.conflicts.strayTitle")}</h4>
                        {attention.unmatched.map((file) => (
                            <div key={file.fileName} className="mt-2 flex items-center justify-between gap-2 text-sm">
                                <span className="break-all text-mid">{file.fileName}</span>
                                <button type="button" className={btn} onClick={() => onIgnore(file.fileName)}>{t("workspace.conflicts.ignore")}</button>
                            </div>
                        ))}
                    </section>
                )}

                <div className="mt-5 flex justify-end">
                    <button type="button" onClick={onClose} data-testid="workspace-conflicts-close" className="rounded-xl border border-edge bg-surface-4 px-4 py-2 text-sm font-bold text-mid hover:border-faint hover:text-strong">{t("common.close")}</button>
                </div>
            </div>
        </div>
    );
}
