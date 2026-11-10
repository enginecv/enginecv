"use client";

import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { ApplyMode } from "@/lib/import/staging/types";
import type { ImportHub } from "./useImportHub";

interface ApplyBarProps {
    hub: ImportHub;
    /** The target is fixed to a new CV (the dashboard): no choice to show. */
    fixedNew?: boolean;
    /** Replacing is not offered, for example when the first source is a data export. */
    canReplace: boolean;
    busy: boolean;
    onApply: () => void;
}

const TARGETS: Array<{ mode: ApplyMode; labelKey: string; descKey: string }> = [
    { mode: "merge", labelKey: "importHub.target.merge", descKey: "importHub.target.merge.desc" },
    { mode: "new", labelKey: "importHub.target.new", descKey: "importHub.target.new.desc" },
    { mode: "replace", labelKey: "importHub.target.replace", descKey: "importHub.target.replace.desc" },
];

/** Where the result goes, what applying will do, and the Apply button. Stays visible at the bottom. */
export function ApplyBar({ hub, fixedNew = false, canReplace, busy, onApply }: ApplyBarProps) {
    const { t, tn } = useTranslation();
    const { add, update } = hub.summary;
    const nothing = add + update === 0;
    const targets = TARGETS.filter((target) => target.mode !== "replace" || canReplace);

    return (
        <div data-testid="import-hub-applybar" className="space-y-3">
            {!fixedNew && (
                <fieldset>
                    <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">{t("importHub.target.title")}</legend>
                    <div className="grid gap-2 sm:grid-cols-3">
                        {targets.map((target) => (
                            <label
                                key={target.mode}
                                className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm ${hub.mode === target.mode ? "border-accent bg-accent/5" : "border-edge"}`}
                            >
                                <input
                                    type="radio"
                                    name="import-hub-target"
                                    checked={hub.mode === target.mode}
                                    onChange={() => hub.setMode(target.mode)}
                                    data-testid={`import-hub-target-${target.mode}`}
                                    className="mt-1"
                                />
                                <span>
                                    <span className="block text-bright">{t(target.labelKey)}</span>
                                    <span className="block text-xs text-faint">{t(target.descKey)}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                </fieldset>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <p className="min-w-0 flex-1 text-xs text-faint" data-testid="import-hub-summary" aria-live="polite">
                    {nothing
                        ? t("importHub.nothingSelected")
                        : [add > 0 ? tn("importHub.count.add", add) : "", update > 0 ? tn("importHub.count.update", update) : ""].filter(Boolean).join(" · ")}
                </p>
                <button
                    type="button"
                    onClick={onApply}
                    disabled={nothing || busy}
                    data-testid="import-hub-apply"
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-medium text-white outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50"
                >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {t("importHub.apply")}
                </button>
            </div>
        </div>
    );
}
