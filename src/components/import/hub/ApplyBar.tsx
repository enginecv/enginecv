"use client";

import { FilePlus2, Layers, Loader2, Replace, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { ApplyMode } from "@/lib/import/staging/types";
import { ChoiceInput } from "./ChoiceInput";
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

const TARGETS: Array<{ mode: ApplyMode; labelKey: string; descKey: string; Icon: LucideIcon }> = [
    { mode: "merge", labelKey: "importHub.target.merge", descKey: "importHub.target.merge.desc", Icon: Layers },
    { mode: "new", labelKey: "importHub.target.new", descKey: "importHub.target.new.desc", Icon: FilePlus2 },
    { mode: "replace", labelKey: "importHub.target.replace", descKey: "importHub.target.replace.desc", Icon: Replace },
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
                    <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">{t("importHub.target.title")}</legend>
                    <div className={`grid gap-2 ${targets.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                        {targets.map(({ mode, labelKey, descKey, Icon }) => {
                            const selected = hub.mode === mode;
                            // Replacing throws the CV away: its selected card reads as a warning.
                            const tone = mode === "replace" ? "danger" : "accent";
                            const frame = selected
                                ? tone === "danger" ? "border-danger bg-danger/5" : "border-accent bg-accent/5"
                                : "border-edge hover:border-edge-strong hover:bg-surface-3";
                            const iconTone = selected ? (tone === "danger" ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent") : "bg-surface-4 text-mid";
                            return (
                                <label
                                    key={mode}
                                    className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors ${frame}`}
                                >
                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${iconTone}`} aria-hidden="true">
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-medium text-bright">{t(labelKey)}</span>
                                        <span className="mt-0.5 block text-xs leading-snug text-faint">{t(descKey)}</span>
                                    </span>
                                    <ChoiceInput
                                        type="radio"
                                        tone={tone}
                                        name="import-hub-target"
                                        checked={selected}
                                        onChange={() => hub.setMode(mode)}
                                        data-testid={`import-hub-target-${mode}`}
                                    />
                                </label>
                            );
                        })}
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
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-medium text-surface-2 outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50"
                >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {t("importHub.apply")}
                </button>
            </div>
        </div>
    );
}
