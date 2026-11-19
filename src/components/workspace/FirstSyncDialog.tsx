"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import type { PlanChoice, PlanItem } from "@/lib/workspace/first-sync";
import { MigrationPrompt } from "./MigrationPrompt";

/**
 * What goes where, before anything is written. Each differing document defaults to keeping the app's
 * version, an unfamiliar file is only imported when chosen, and Apply stays disabled until the list
 * has been looked at (spec story 1, scenario 3).
 */
export function FirstSyncDialog({ plan, leftOut, busy, onApply, onCancel }: {
    plan: PlanItem[];
    leftOut: number;
    busy: boolean;
    onApply: (plan: PlanItem[]) => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onCancel);
    const [choices, setChoices] = useState<Record<string, PlanChoice>>(() => Object.fromEntries(plan.map((item) => [item.key, item.choice])));
    const [reviewed, setReviewed] = useState(false);
    const resolved = useMemo(() => plan.map((item) => ({ ...item, choice: choices[item.key] ?? item.choice })), [plan, choices]);
    // Only rows where a file and the app disagree need a look; writing new files or matching ones does not.
    const needsLook = plan.some((item) => ["differs", "app-newer", "file-newer", "conflict"].includes(item.class));

    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onCancel} />
            <div ref={ref} role="dialog" aria-modal="true" aria-label={t("workspace.firstSync.title")} data-testid="workspace-first-sync" className="glass-panel relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl p-6 shadow-2xl">
                <h2 className="text-lg font-bold text-strong">{t("workspace.firstSync.title")}</h2>
                <p className="mt-1 text-sm text-mid">{t("workspace.firstSync.intro")}</p>
                <p className="mt-1 text-xs text-faint">{t("workspace.firstSync.restoreNote")} {t("workspace.firstSync.backupNote")}</p>
                <MigrationPrompt count={plan.filter((item) => item.linked).length} variant="inline" />
                {leftOut > 0 && <p className="mt-1 text-xs text-faint" data-testid="workspace-left-out">{t("workspace.panel.leftOut", { count: leftOut })}</p>}

                <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-xl border border-edge">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-surface-1 text-[11px] uppercase tracking-wider text-faint">
                            <tr>
                                <th className="px-3 py-2">{t("workspace.firstSync.document")}</th>
                                <th className="px-3 py-2">{t("workspace.firstSync.status")}</th>
                                <th className="px-3 py-2">{t("workspace.firstSync.choice")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {resolved.map((item) => (
                                <tr key={item.key} data-testid={`workspace-sync-row-${item.key}`} className="border-t border-edge align-top">
                                    <td className="px-3 py-2">
                                        <span className="block font-medium text-strong">{item.title}</span>
                                        <span className="block text-xs text-faint">{t(`workspace.kind.${item.kind}`)}{item.fileName ? ` · ${item.fileName}` : ""}</span>
                                        {item.linked && <span className="mt-0.5 block text-xs text-accent" data-testid={`workspace-sync-linked-${item.key}`}>{t("workspace.migrate.linkedRow")}</span>}
                                    </td>
                                    <td className="px-3 py-2 text-mid" data-testid={`workspace-sync-status-${item.key}`}>{t(`workspace.sync.${item.class}`)}</td>
                                    <td className="px-3 py-2">
                                        <select
                                            value={item.choice}
                                            disabled={item.choices.length < 2}
                                            onChange={(event) => setChoices((current) => ({ ...current, [item.key]: event.target.value as PlanChoice }))}
                                            aria-label={`${item.title}: ${t("workspace.firstSync.choice")}`}
                                            data-testid={`workspace-sync-choice-${item.key}`}
                                            className="w-full rounded-lg border border-edge bg-surface-1 px-2 py-1.5 text-sm text-strong disabled:opacity-60"
                                        >
                                            {item.choices.map((choice) => <option key={choice} value={choice}>{item.linked && choice === "keep-app" ? t("workspace.migrate.move") : item.linked && choice === "skip" ? t("workspace.migrate.keep") : t(`workspace.choice.${choice}`)}</option>)}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                    {needsLook && (
                        <label className="mr-auto flex items-center gap-2 text-xs text-mid">
                            <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} data-testid="workspace-first-sync-reviewed" />
                            {t("workspace.firstSync.confirmDiffs")}
                        </label>
                    )}
                    <button type="button" onClick={onCancel} data-testid="workspace-first-sync-cancel" className="rounded-xl border border-edge bg-surface-4 px-4 py-2 text-sm font-bold text-mid hover:border-faint hover:text-strong">{t("dashboard.cancel")}</button>
                    <button type="button" disabled={busy || (needsLook && !reviewed)} onClick={() => onApply(resolved)} data-testid="workspace-first-sync-apply" className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-surface-2 hover:bg-accent-soft disabled:opacity-60">
                        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {t("workspace.firstSync.apply")}
                    </button>
                </div>
            </div>
        </div>
    );
}
