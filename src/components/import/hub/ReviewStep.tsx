"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { STAGE_SECTIONS, type MergeRow, type StageSection } from "@/lib/import/staging/types";
import type { ImportHub } from "./useImportHub";
import { BasicsChoices } from "./BasicsChoices";
import { ChoiceChips } from "./ChoiceChips";
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
        <li className="px-3 py-2" data-testid="import-hub-row">
            <div className="flex items-center gap-2">
                <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => hub.setRows([row], event.target.checked)}
                        aria-label={row.title}
                        className="h-4 w-4 shrink-0 accent-accent"
                    />
                    <span className="min-w-0 flex-1">
                        <span className={`block break-words text-sm ${selected ? "text-bright" : "text-mid"}`}>{row.title}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
                            <span>{t("importHub.fromSource", { source: sources })}</span>
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
                        </span>
                    </span>
                </label>
                {row.conflicts.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setOpen((value) => !value)}
                        aria-expanded={open}
                        aria-label={`${open ? t("importHub.hideDifferences") : t("importHub.showDifferences")}: ${row.title}`}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md outline-none transition-colors hover:text-strong focus-visible:ring-1 focus-visible:ring-accent ${open ? "bg-accent/10 text-accent" : "text-faint"}`}
                    >
                        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                )}
            </div>

            {open && (
                <div className="mb-1 ml-7 mt-2 space-y-3 border-l-2 border-accent/30 pl-3" data-testid="import-hub-conflicts">
                    {row.conflicts.map((conflict) => {
                        const chosen = hub.selection.fields[row.id]?.[conflict.field] ?? conflict.defaultId;
                        const label = t(fieldLabelKey(conflict.field));
                        return (
                            <ChoiceChips
                                key={conflict.field}
                                legend={label}
                                name={`${row.id}-${conflict.field}`}
                                chosen={chosen}
                                onPick={(optionId) => hub.pickField(row.id, conflict.field, optionId)}
                                options={conflict.options.map((option) => {
                                    const source = optionLabel(option.id, hub.plan.batches, t);
                                    return {
                                        id: option.id,
                                        source,
                                        ariaLabel: `${t("importHub.pick", { field: label })}: ${source}`,
                                        value: shorten(option.value) || t("importHub.empty"),
                                    };
                                })}
                            />
                        );
                    })}
                </div>
            )}
        </li>
    );
}

/** One section: a header with a fold toggle and bulk ticks, then its rows as a divided list. */
function Section({ section, rows, hub }: { section: StageSection; rows: MergeRow[]; hub: ImportHub }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(true);
    const selectedCount = rows.filter((row) => hub.isSelected(row)).length;
    const label = t(SECTION_LABEL_KEYS[section]);
    const listId = `import-hub-list-${section}`;

    return (
        <section aria-label={label} data-testid={`import-hub-section-${section}`} className="overflow-hidden rounded-xl border border-edge">
            <div className="flex flex-wrap items-center gap-x-2 bg-surface-3 px-3">
                <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    aria-expanded={expanded}
                    aria-controls={listId}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                    <ChevronRight className={`h-4 w-4 shrink-0 text-faint transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden="true" />
                    <h3 className="min-w-0 text-sm font-medium text-bright">{label}</h3>
                    <span className="text-xs text-faint">{t("importHub.selectedCount", { selected: selectedCount, total: rows.length })}</span>
                </button>
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
            {/* Folded sections stay mounted (hidden), so a fold never drops a tick or a chosen version. */}
            <ul id={listId} hidden={!expanded} className="divide-y divide-edge">
                {rows.map((row) => <Row key={row.id} row={row} hub={hub} />)}
            </ul>
        </section>
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
            {sections.map(({ section, rows }) => <Section key={section} section={section} rows={rows} hub={hub} />)}
        </div>
    );
}
