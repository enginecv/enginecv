"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { STAGE_SECTIONS, type MergeRow } from "@/lib/import/staging/types";
import type { ImportHub } from "./useImportHub";
import { BasicsChoices } from "./BasicsChoices";
import { ChoiceInput } from "./ChoiceInput";
import { SECTION_LABEL_KEYS, entryDetails, fieldLabelKey, optionLabel, shorten } from "./labels";
import { VersionOption } from "./VersionOption";

/** Turns a stored date ("2024-03", "Present") into display text. */
type FormatDate = (value: string) => string;

interface RowProps {
    row: MergeRow;
    hub: ImportHub;
    formatDate: FormatDate;
}

const MAX_TAGS = 6;

function Row({ row, hub, formatDate }: RowProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const selected = hub.isSelected(row);
    const sources = row.origins.map((origin) => origin.label).join(", ");
    // The incoming version: what ticking the row adds.
    const details = entryDetails(row.section, row.origins[0].entry, formatDate);
    const hiddenTags = details.tags.length - MAX_TAGS;

    return (
        <li
            className={`rounded-xl border transition-colors ${selected ? "border-accent/50 bg-accent/[0.04]" : "border-edge bg-surface-1/40"}`}
            data-testid="import-hub-row"
        >
            <div className="flex items-start gap-3 p-3">
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                    <span className="mt-0.5">
                        <ChoiceInput
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => hub.setRows([row], event.target.checked)}
                            aria-label={row.title}
                        />
                    </span>
                    <span className={`min-w-0 flex-1 transition-opacity ${selected ? "" : "opacity-60"}`}>
                        <span className="block break-words text-sm font-medium text-strong">{row.title}</span>
                        {details.meta.length > 0 && (
                            <span className="mt-0.5 block break-words text-xs text-mid" data-testid="import-hub-row-meta">
                                {details.meta.join(" · ")}
                            </span>
                        )}
                        {details.text && (
                            <span className="mt-1.5 line-clamp-2 block break-words text-xs leading-relaxed text-faint" data-testid="import-hub-row-text">
                                {details.text}
                            </span>
                        )}
                        {details.tags.length > 0 && (
                            <span className="mt-2 flex flex-wrap gap-1" data-testid="import-hub-row-tags">
                                {details.tags.slice(0, MAX_TAGS).map((tag) => (
                                    <span key={tag} className="rounded-md bg-surface-4 px-1.5 py-0.5 text-[11px] text-mid">{tag}</span>
                                ))}
                                {hiddenTags > 0 && <span className="px-1 py-0.5 text-[11px] text-faint">+{hiddenTags}</span>}
                            </span>
                        )}
                        <span className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-faint">{t("importHub.fromSource", { source: sources })}</span>
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
                        className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-accent outline-none transition-colors hover:bg-accent/10 focus-visible:ring-1 focus-visible:ring-accent"
                    >
                        <span className="hidden sm:inline">{open ? t("importHub.hideDifferences") : t("importHub.showDifferences")}</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                )}
            </div>

            {open && (
                <div className="space-y-3 border-t border-edge px-3 pb-3 pt-3" data-testid="import-hub-conflicts">
                    {row.conflicts.map((conflict) => {
                        const chosen = hub.selection.fields[row.id]?.[conflict.field] ?? conflict.defaultId;
                        const name = `${row.id}-${conflict.field}`;
                        const label = t(fieldLabelKey(conflict.field));
                        return (
                            <fieldset key={conflict.field}>
                                <legend className="mb-1.5 text-xs font-medium text-mid">{label}</legend>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {conflict.options.map((option) => {
                                        const source = optionLabel(option.id, hub.plan.batches, t);
                                        return (
                                            <VersionOption
                                                key={option.id}
                                                name={name}
                                                checked={chosen === option.id}
                                                onPick={() => hub.pickField(row.id, conflict.field, option.id)}
                                                ariaLabel={`${t("importHub.pick", { field: label })}: ${source}`}
                                                source={source}
                                            >
                                                {shorten(option.value) || <span className="text-faint">{t("importHub.empty")}</span>}
                                            </VersionOption>
                                        );
                                    })}
                                </div>
                            </fieldset>
                        );
                    })}
                </div>
            )}
        </li>
    );
}

/** Sections with one row per item found, a tick on each, and a way to pick between versions. */
export function ReviewStep({ hub, formatDate }: { hub: ImportHub; formatDate: FormatDate }) {
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
                            <h3 className="min-w-0 flex-1 text-sm font-semibold text-strong">{label}</h3>
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
                            {rows.map((row) => <Row key={row.id} row={row} hub={hub} formatDate={formatDate} />)}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}
