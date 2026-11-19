"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Grid2X2, Grid3X3, LayoutGrid, Loader2, Mail, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CvChoiceGrid, type CvChoice } from "@/components/letters/CvChoiceGrid";
import { RepointDialog } from "@/components/letters/RepointDialog";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { db } from "@/lib/db";
import { useTranslation } from "@/lib/i18n";
import type { LetterDocument } from "@/lib/letters/schema";
import { createLetterRecord, deleteLetter, duplicateLetter, listLetters, repointLetter, restoreLetter } from "@/lib/letters/store";
import { LetterCard, letterDisplayTitle } from "./LetterCard";
import { NavSearch } from "./NavSearch";
import { DASHBOARD_CONTENT_CLASS, DASHBOARD_NAV_CLASS } from "./layout";

const UNDO_WINDOW_MS = 8000;
type Density = "large" | "normal" | "compact";

type CvOption = CvChoice;

interface LetterGroup {
    cvId: string | null;
    title: string;
    letters: LetterDocument[];
}

function CvPickerDialog({ cvs, onPick, onClose, busy, error }: { cvs: CvOption[]; onPick: (cvId: string) => void; onClose: () => void; busy: boolean; error: boolean }) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onClose);
    const [cvId, setCvId] = useState(cvs[0]?.id ?? "");
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onClose} />
            <div ref={ref} role="dialog" aria-modal="true" aria-label={t("dashboard.letters.pickCv")} className="glass-panel relative w-full max-w-2xl rounded-2xl p-6 shadow-2xl" data-testid="letters-cv-picker">
                <h2 className="text-lg font-bold text-strong">{t("dashboard.letters.pickCv")}</h2>
                <p className="mt-2 text-sm text-mid">{t("dashboard.letters.pickCvHint")}</p>
                <CvChoiceGrid choices={cvs} value={cvId} onChange={setCvId} name="letters-cv" testIdPrefix="letters-cv" />
                {error && <p role="alert" className="mt-3 text-sm text-danger" data-testid="letters-cv-picker-error">{t("dashboard.letters.createError")}</p>}
                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-xl border border-edge bg-surface-4 px-4 py-2 text-sm font-bold text-mid hover:border-faint hover:text-strong">{t("dashboard.cancel")}</button>
                    <button type="button" disabled={busy || !cvId} onClick={() => onPick(cvId)} data-testid="letters-cv-create" className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-surface-2 hover:bg-accent-soft disabled:opacity-60">
                        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {t("dashboard.letters.create")}
                    </button>
                </div>
            </div>
        </div>
    );
}

const DENSITY_ICONS = { large: LayoutGrid, normal: Grid2X2, compact: Grid3X3 } as const;
const DENSITY_LABEL_KEY = { large: "palette.optionLarge", normal: "palette.optionNormal", compact: "palette.optionCompact" } as const;

/**
 * The Cover Letters tab: letters grouped by the CV they follow, with search, density,
 * and per-letter actions. A letter needs a CV, so with none the person is sent to create one.
 */
export function LettersTab({ onCreateCv, gridClass = "grid-cols-1 md:grid-cols-2 xl:grid-cols-3", density = "normal", onDensityChange, navLead, navTrail }: {
    onCreateCv: () => void;
    /** Tailwind grid-column classes for the card grid (shared with the other tabs). */
    gridClass?: string;
    density?: Density;
    onDensityChange?: (density: Density) => void;
    /** Left end of the toolbar (the sidebar trigger on narrow screens). */
    navLead?: ReactNode;
    /** Right end of the toolbar (theme and language controls). */
    navTrail?: ReactNode;
}) {
    const { t } = useTranslation();
    const router = useRouter();
    const letters = useLiveQuery(() => listLetters(), []);
    const cvs = useLiveQuery(async (): Promise<CvOption[]> => {
        const rows = await db.resumes.toArray();
        return rows.map((row) => ({ id: row.id as string, label: row.meta?.title?.trim() || row.basics?.name?.trim() || t("dashboard.untitled"), resume: row, detail: row.basics?.headline?.trim() || undefined }));
    }, [t]);
    const [picking, setPicking] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [dialog, setDialog] = useState<{ mode: "repoint" | "duplicate"; letter: LetterDocument } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<LetterDocument | null>(null);
    const [undoRow, setUndoRow] = useState<LetterDocument | null>(null);
    const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (undoTimer.current) clearTimeout(undoTimer.current);
    }, []);

    const groups = useMemo<LetterGroup[]>(() => {
        if (!letters || !cvs) return [];
        const needle = query.trim().toLowerCase();
        const matches = needle
            ? letters.filter((letter) => [letter.title, letter.company, letter.role, letter.recipient.name].some((field) => field.toLowerCase().includes(needle)))
            : letters;
        const byId = new Map(cvs.map((cv) => [cv.id, cv.label]));
        const grouped = new Map<string | null, LetterDocument[]>();
        for (const letter of matches) {
            const key = letter.cvId && byId.has(letter.cvId) ? letter.cvId : null;
            grouped.set(key, [...(grouped.get(key) ?? []), letter]);
        }
        const result: LetterGroup[] = [...grouped.entries()]
            .filter(([key]) => key !== null)
            .map(([key, items]) => ({ cvId: key, title: byId.get(key as string) ?? "", letters: items }))
            .sort((a, b) => a.title.localeCompare(b.title));
        const orphans = grouped.get(null);
        if (orphans) result.push({ cvId: null, title: t("dashboard.letters.noCvGroup"), letters: orphans });
        return result;
    }, [letters, cvs, query, t]);

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch {
            setError(t("dashboard.letters.actionError"));
        } finally {
            setBusy(false);
        }
    };

    /** Creates a letter and opens it. Returns false (and says why) when it could not be created. */
    const create = async (cvId: string): Promise<boolean> => {
        setBusy(true);
        setError(null);
        try {
            const letter = await createLetterRecord(cvId);
            router.push(`/letters/${letter.id}`);
            return true;
        } catch (cause) {
            console.error("[EngineCV] Could not create a cover letter.", cause);
            setError(t("dashboard.letters.createError"));
            return false;
        } finally {
            setBusy(false);
        }
    };

    const startNew = () => {
        if (!cvs || cvs.length === 0) return;
        if (cvs.length === 1) void create(cvs[0].id);
        else setPicking(true);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const row = await deleteLetter(deleteTarget.id);
        setDeleteTarget(null);
        if (!row) return;
        if (undoTimer.current) clearTimeout(undoTimer.current);
        setUndoRow(row);
        undoTimer.current = setTimeout(() => setUndoRow(null), UNDO_WINDOW_MS);
    };

    const undoDelete = async () => {
        if (!undoRow) return;
        await restoreLetter(undoRow);
        if (undoTimer.current) clearTimeout(undoTimer.current);
        setUndoRow(null);
    };

    /** The toolbar every dashboard tab has, then the tab's content in the shared page column. */
    const frame = (content: ReactNode, controls?: ReactNode) => (
        <>
            <nav className={DASHBOARD_NAV_CLASS} data-testid="letters-nav">
                <div className="relative mx-auto flex h-full w-full max-w-7xl items-center gap-2 px-4 py-3 sm:px-6 md:py-0 lg:px-8">
                    {navLead}
                    {controls}
                    <div className="ml-auto flex items-center gap-2">
                        {cvs && cvs.length > 0 && (
                            <button type="button" onClick={startNew} disabled={busy} data-testid="letter-new" title={t("dashboard.letters.new")} aria-label={t("dashboard.letters.new")} className="flex h-10 items-center gap-2 rounded-xl bg-accent px-3 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-soft disabled:opacity-60">
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                <span className="hidden sm:inline">{t("dashboard.letters.new")}</span>
                            </button>
                        )}
                        {navTrail}
                    </div>
                </div>
            </nav>
            <div className={`${DASHBOARD_CONTENT_CLASS} pt-8`}>{content}</div>
        </>
    );

    if (letters === undefined || cvs === undefined) {
        return frame(
            <div className={`grid ${gridClass} gap-5`} data-testid="letters-loading">
                {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-36 w-full rounded-2xl" />)}
            </div>,
        );
    }

    if (cvs.length === 0 && letters.length === 0) {
        return frame(
            <div className="flex flex-col items-center gap-3 rounded-[1.25rem] border border-dashed border-edge p-12 text-center text-faint" data-testid="letters-no-cvs">
                <Mail className="h-10 w-10" aria-hidden="true" />
                <p className="text-sm font-medium text-strong">{t("dashboard.letters.noCvs")}</p>
                <p className="max-w-md text-xs">{t("dashboard.letters.noCvsHint")}</p>
                <button type="button" onClick={onCreateCv} data-testid="letters-create-cv" className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-surface-2 hover:bg-accent-soft">{t("dashboard.letters.createCv")}</button>
            </div>,
        );
    }

    const dialogName = deleteTarget ? letterDisplayTitle(deleteTarget, t("letters.editor.untitled")) : "";

    const controls = (
        <>
            {letters.length > 0 && (
                <NavSearch value={query} onChange={setQuery} placeholder={t("dashboard.letters.search")} testId="letters-search" />
            )}
            {onDensityChange && letters.length > 0 && (
                <div className="hidden items-center gap-1 rounded-xl border border-edge bg-surface-4 p-1 sm:flex" data-testid="letters-density">
                    {(["large", "normal", "compact"] as const).map((value) => {
                        const Icon = DENSITY_ICONS[value];
                        return (
                            <button key={value} type="button" onClick={() => onDensityChange(value)} aria-pressed={density === value} title={t("dashboard.densityTitle", { density: t(DENSITY_LABEL_KEY[value]) })} aria-label={t("dashboard.densityTitle", { density: t(DENSITY_LABEL_KEY[value]) })} data-testid={`letters-density-${value}`} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${density === value ? "bg-edge text-accent shadow-sm" : "text-faint hover:text-strong"}`}>
                                <Icon className="h-4 w-4" aria-hidden="true" />
                            </button>
                        );
                    })}
                </div>
            )}
        </>
    );

    return frame(
        <div className="space-y-6" data-testid="letters-tab">
            {error && <p role="alert" className="text-sm text-danger" data-testid="letters-error">{error}</p>}

            {letters.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-[1.25rem] border border-dashed border-edge p-10 text-center text-faint" data-testid="letters-empty">
                    <Mail className="h-8 w-8" aria-hidden="true" />
                    <p className="text-sm font-medium text-strong">{t("dashboard.letters.empty")}</p>
                    <p className="text-xs">{t("dashboard.letters.emptyHint")}</p>
                </div>
            ) : groups.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-edge p-10 text-center text-sm text-faint" data-testid="letters-no-match">
                    {t("dashboard.letters.noMatch", { query })}
                </div>
            ) : (
                groups.map((group) => (
                    <section key={group.cvId ?? "none"} data-testid={`letters-group-${group.cvId ?? "none"}`} aria-label={group.title} className="space-y-3">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-strong">
                            {group.title}
                            <span className="rounded-md bg-surface-1 px-1.5 py-0.5 text-[11px] font-semibold text-mid" data-testid="letters-group-count">{group.letters.length}</span>
                        </h3>
                        <div className={`grid ${gridClass} gap-5`}>
                            {group.letters.map((letter) => (
                                <LetterCard
                                    key={letter.id}
                                    letter={letter}
                                    needsCv={letter.status === "draft" && group.cvId === null}
                                    onOpen={() => router.push(`/letters/${letter.id}`)}
                                    actions={{
                                        onDuplicate: () => void run(async () => {
                                            // A letter whose CV is gone needs a CV to copy onto: ask which.
                                            if (!letter.cvId || !cvs.some((cv) => cv.id === letter.cvId)) {
                                                setDialog({ mode: "duplicate", letter });
                                                return;
                                            }
                                            await duplicateLetter(letter.id, { copyLabel: t("dashboard.copy") });
                                        }),
                                        onDuplicateInto: () => setDialog({ mode: "duplicate", letter }),
                                        onRepoint: () => setDialog({ mode: "repoint", letter }),
                                        onDelete: () => setDeleteTarget(letter),
                                    }}
                                />
                            ))}
                        </div>
                    </section>
                ))
            )}

            {undoRow && (
                <div role="status" className="fixed bottom-6 left-1/2 z-[210] flex -translate-x-1/2 items-center gap-4 rounded-xl border border-edge bg-surface-4 px-4 py-3 shadow-2xl" data-testid="letter-undo">
                    <span className="text-sm text-strong">{t("dashboard.letters.deleted")}</span>
                    <button type="button" onClick={() => void undoDelete()} data-testid="letter-undo-button" className="text-sm font-bold text-accent hover:underline">{t("dashboard.letters.undo")}</button>
                </div>
            )}

            {picking && <CvPickerDialog cvs={cvs} busy={busy} error={error !== null} onClose={() => { setPicking(false); setError(null); }} onPick={(cvId) => void create(cvId).then((created) => { if (created) setPicking(false); })} />}

            {dialog && (
                <RepointDialog
                    letter={dialog.letter}
                    cvs={cvs}
                    mode={dialog.mode}
                    busy={busy}
                    onClose={() => setDialog(null)}
                    onConfirm={(cvId) => void run(async () => {
                        if (dialog.mode === "repoint") await repointLetter(dialog.letter.id, cvId);
                        else await duplicateLetter(dialog.letter.id, { cvId, copyLabel: t("dashboard.copy") });
                        setDialog(null);
                    })}
                />
            )}

            <ConfirmModal
                open={!!deleteTarget}
                title={t("dashboard.letters.deleteTitle")}
                description={deleteTarget?.status === "draft" ? t("dashboard.letters.deleteConfirm", { name: dialogName }) : t("dashboard.letters.deleteConfirmSent", { name: dialogName })}
                confirmLabel={t("dashboard.letters.deleteLetter")}
                destructive
                onConfirm={() => void confirmDelete()}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>,
        controls,
    );
}
