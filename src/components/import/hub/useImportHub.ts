"use client";

import { useCallback, useMemo, useState } from "react";
import type { Resume } from "@/lib/schema";
import { summarizeSelection } from "@/lib/import/staging/apply";
import { buildMergePlan } from "@/lib/import/staging/plan";
import { isRowSelected } from "@/lib/import/staging/apply";
import type { ApplyMode, BasicsField, MergeRow, Selection, StagedBatch } from "@/lib/import/staging/types";

export type HubStep = "sources" | "review" | "done";

const EMPTY_SELECTION: Selection = { rows: {}, fields: {}, basics: {} };

/**
 * In-memory state of the Import data dialog: the sources added so far, the
 * person's ticks and choices, the step, and where the result goes. Nothing is
 * stored; closing the dialog drops it all.
 */
export function useImportHub(current: Resume, initialMode: ApplyMode = "merge") {
    const [batches, setBatches] = useState<StagedBatch[]>([]);
    const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
    const [mode, setMode] = useState<ApplyMode>(initialMode);
    const [step, setStep] = useState<HubStep>("sources");

    const plan = useMemo(() => buildMergePlan(current, batches), [current, batches]);
    const summary = useMemo(() => summarizeSelection(plan, selection, mode), [plan, selection, mode]);

    const addBatches = useCallback((added: StagedBatch[]) => {
        if (added.length > 0) setBatches((previous) => [...previous, ...added]);
    }, []);

    const removeBatch = useCallback((id: string) => {
        setBatches((previous) => previous.filter((batch) => batch.id !== id));
    }, []);

    const isSelected = useCallback((row: MergeRow) => isRowSelected(row, selection, mode), [selection, mode]);

    const setRows = useCallback((rows: MergeRow[], value: boolean) => {
        setSelection((previous) => ({
            ...previous,
            rows: { ...previous.rows, ...Object.fromEntries(rows.map((row) => [row.id, value])) },
        }));
    }, []);

    const pickField = useCallback((rowId: string, field: string, optionId: string) => {
        setSelection((previous) => ({
            ...previous,
            fields: { ...previous.fields, [rowId]: { ...previous.fields[rowId], [field]: optionId } },
        }));
    }, []);

    const pickBasics = useCallback((field: BasicsField, optionId: string) => {
        setSelection((previous) => ({ ...previous, basics: { ...previous.basics, [field]: optionId } }));
    }, []);

    const reset = useCallback(() => {
        setBatches([]);
        setSelection(EMPTY_SELECTION);
        setMode(initialMode);
        setStep("sources");
    }, [initialMode]);

    return {
        batches,
        plan,
        selection,
        summary,
        mode,
        step,
        setMode,
        setStep,
        addBatches,
        removeBatch,
        isSelected,
        setRows,
        pickField,
        pickBasics,
        reset,
    };
}

export type ImportHub = ReturnType<typeof useImportHub>;
