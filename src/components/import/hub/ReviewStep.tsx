"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { STAGE_SECTIONS, type MergeRow } from "@/lib/import/staging/types";
import type { ImportHub } from "./useImportHub";
import { BasicsChoices } from "./BasicsChoices";
import { SECTION_LABEL_KEYS, fieldLabelKey, optionLabel, shorten } from "./labels";

interface RowProps {
    row: MergeRow;
    hub: ImportHub;
}

function Row({ row, hub }: RowProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const selected = hub.isSelected(row);
    const sources = row.origins.map((origin) => origin.label).join(", ");

    return (
        <li className="rounded-lg border border-edge p-3" data-testid="import-hub-row">
            <div className="flex items-start gap-3">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => hub.setRows([row], event.target.checked)}
                    aria-label={row.title}
                    className="mt-1 h-5 w-5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                    <p className="break-words text-sm text-bright">{row.title}</p>
                    <p className="text-xs text-faint">{t("importHub.fromSource", { source: sources })}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                        {row.origins.length > 1 && (
                            <span data-testid="import-hub-badge-several" className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                                {t("importHub.foundIn", { count: row.origins.length })}
                            </span>
                        )}
                        {row.existing && (
                            <span data-testid="import-hub-badge-existing" className="rounded-full bg-surface-4 px-2 py-0.5 text-[11px] text-faint">
                                {t("importHub.alreadyInCv")}
                            </span>
                        )}
                    </div>
                </div>
                {row.conflicts.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setOpen((value) => !value)}
                        aria-expanded={open}
                        aria-label={`${open ? t("importHub.hideDifferences") : t("importHub.showDifferences")}: ${row.title}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-faint outline-none transition-colors hover:text-strong focus-visible:ring-1 focus-visible:ring-accent"
                    >
                        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                )}
            </div>

            {open && (
                <div className="mt-3 space-y-3" data-testid="import-hub-conflicts">
                    {row.conflicts.map((conflict) => {
                        const chosen = hub.selection.fields[row.id]?.[conflict.field] ?? conflict.defaultId;
                        const name = `${row.id}-${conflict.field}`;
                        const label = t(fieldLabelKey(conflict.field));
                        return (
                            <fieldset key={conflict.field} className="rounded-md border border-edge p-2">
                                <legend className="px-1 text-xs font-medium text-faint">{label}</legend>
                                {conflict.options.map((option) => (
                                    <label key={option.id} className="flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-1 py-2 text-sm hover:bg-surface-4">
                                        <input
                                            type="radio"
                                            name={name}
                                            checked={chosen === option.id}
                                            onChange={() => hub.pickField(row.id, conflict.field, option.id)}
                                            aria-label={`${t("importHub.pick", { field: label })}: ${optionLabel(option.id, hub.plan.batches, t)}`}
                                            className="mt-1"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-xs text-faint">{optionLabel(option.id, hub.plan.batches, t)}</span>
                                            <span className="block break-words text-bright">{shorten(option.value) || t("importHub.empty")}</span>
                                        </span>
                                    </label>
                                ))}
                            </fieldset>
                        );
                    })}
                </div>
            )}
        </li>
    );
}

/** Sections with one row per item found, a tick on each, and a way to pick between versions. */
export function ReviewStep({ hub }: { hub: ImportHub }) {
    const { t } = useTranslation();
    const sections = STAGE_SECTIONS
        .map((section) => ({ section, rows: hub.plan.rows.filter((row) => row.section === section) }))
        .filter((group) => group.rows.length > 0);

    if (sections.length === 0 && hub.plan.basics.length === 0) {
        return <p data-testid="import-hub-empty" className="py-8 text-center text-sm text-faint">{t("importHub.review.empty")}</p>;
    }

    return (
        <div className="space-y-6">
            <BasicsChoices plan={hub.plan} selection={hub.selection} onPick={hub.pickBasics} />
            {sections.map(({ section, rows }) => {
                const selectedCount = rows.filter((row) => hub.isSelected(row)).length;
                const label = t(SECTION_LABEL_KEYS[section]);
                return (
                    <section key={section} aria-label={label} data-testid={`import-hub-section-${section}`} className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="min-w-0 flex-1 text-sm font-medium text-bright">{label}</h3>
                            <span className="text-xs text-faint">{t("importHub.selectedCount", { selected: selectedCount, total: rows.length })}</span>
                            <button
                                type="button"
                                onClick={() => hub.setRows(rows, true)}
                                className="min-h-11 rounded-md px-2 text-xs text-accent outline-none hover:underline focus-visible:ring-1 focus-visible:ring-accent"
                            >
                                {t("importHub.selectAll")}
                            </button>
                            <button
                                type="button"
                                onClick={() => hub.setRows(rows, false)}
                                className="min-h-11 rounded-md px-2 text-xs text-accent outline-none hover:underline focus-visible:ring-1 focus-visible:ring-accent"
                            >
                                {t("importHub.selectNone")}
                            </button>
                        </div>
                        <ul className="space-y-2">
                            {rows.map((row) => <Row key={row.id} row={row} hub={hub} />)}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}
