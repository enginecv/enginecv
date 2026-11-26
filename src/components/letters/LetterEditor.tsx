"use client";

import { AlertTriangle, ArrowLeft, Eye, FileText, Loader2, Pencil } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ensureWorkspace } from "@/lib/workspace/controller";
import { Group, Panel, Separator } from "react-resizable-panels";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { db } from "@/lib/db";
import { useTranslation } from "@/lib/i18n";
import { createId } from "@/lib/id";
import { DEFAULT_LETTER_DESIGN, pickLetterDesign } from "@/lib/letters/design";
import { sendWarnings } from "@/lib/letters/freeze";
import { senderFromCv } from "@/lib/letters/sender";
import { convertToSnapshot, duplicateLetter, markSent, repointLetter, unfreeze } from "@/lib/letters/store";
import { useLetter } from "@/lib/letters/use-letter";
import { DesignPane } from "./DesignPane";
import { LayoutPane } from "./LayoutPane";
import { LetterExportMenu } from "./LetterExportMenu";
import { LetterPreview } from "./LetterPreview";
import { useJobReturnHref } from "@/hooks/useJobReturnHref";
import { LetterTextPane } from "./LetterTextPane";
import { MarkSentDialog } from "./MarkSentDialog";
import { ParagraphLibrary } from "./ParagraphLibrary";
import { RecipientPane } from "./RecipientPane";
import { RepointDialog } from "./RepointDialog";
import { SenderPane } from "./SenderPane";
import { DocStateBadge } from "@/components/workspace/DocStateBadge";
import { StatusPane } from "./StatusPane";
import { warningText } from "./warnings";

const LETTERS_HREF = "/dashboard?tab=letters";

/** Stable ids so the panel group can address each panel. */
const PANEL_ID = { sidebar: "letter-form-panel", preview: "letter-preview-panel" } as const;

function MobileFooterButton({ active, onClick, icon, label, testId }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; testId: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            data-testid={testId}
            data-state={active ? "active" : "inactive"}
            aria-pressed={active}
            className={`inline-flex h-10 min-w-0 items-center justify-center gap-1 rounded-xl border px-1.5 text-[11px] font-medium transition-all duration-200 ${active ? "border-faint bg-edge text-strong shadow-sm" : "border-edge bg-surface-4 text-faint hover:border-faint hover:text-strong"}`}
        >
            {icon}
            <span className="min-w-0 truncate max-[374px]:hidden">{label}</span>
        </button>
    );
}

/**
 * The cover letter editor, in the CV editor's shell: the same header, a resizable split between
 * the form and the live preview, and the same phone layout with a footer to switch panes.
 */
export function LetterEditor({ letterId }: { letterId: string }) {
    const backHref = useJobReturnHref(LETTERS_HREF);
    const { t } = useTranslation();
    const { loadState, letter, cv, resolved, saveState, conflict, update, keepMine, loadTheirs, flush } = useLetter(letterId);
    const router = useRouter();
    const [pane, setPane] = useState<"edit" | "preview">("edit");
    const [isMobileLayout, setIsMobileLayout] = useState(false);
    const [dialog, setDialog] = useState<"send" | "unfreeze" | "link" | null>(null);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState(false);
    const cvChoices = useLiveQuery(async () => (await db.resumes.toArray()).map((row) => ({ id: row.id as string, label: row.meta?.title?.trim() || row.basics?.name?.trim() || t("dashboard.untitled") })), [t]) ?? [];

    // A connected workspace folder keeps syncing after a reload or a direct link to this letter.
    useEffect(() => {
        void ensureWorkspace();
    }, []);

    // The same breakpoint as the CV editor: below it, one pane at a time with a footer to switch.
    useEffect(() => {
        const update = () => setIsMobileLayout(window.innerWidth < 1024);
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    /** Runs a status change. Pending text is saved first, so it is part of what gets frozen. */
    const act = async (action: () => Promise<void>) => {
        setBusy(true);
        setActionError(false);
        try {
            await flush();
            await action();
            setDialog(null);
        } catch {
            setActionError(true);
        } finally {
            setBusy(false);
        }
    };

    if (loadState === "loading") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-surface-2" data-testid="letter-editor-loading">
                <Loader2 className="h-6 w-6 animate-spin text-strong" aria-label={t("letters.editor.loading")} />
            </div>
        );
    }

    if (loadState === "missing" || !letter) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface-2 p-6 text-center" data-testid="letter-editor-missing">
                <p className="text-base font-semibold text-strong">{t("letters.editor.notFound")}</p>
                <p className="max-w-md text-sm text-mid">{t("letters.editor.notFoundHint")}</p>
                <Link href={backHref} className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-bright hover:border-faint hover:text-strong">{t("letters.editor.back")}</Link>
            </div>
        );
    }

    const readOnly = letter.status !== "draft";
    const title = letter.title;
    const placeholder = [letter.company, letter.role].filter(Boolean).join(" - ") || t("letters.editor.untitled");

    const form = (
        <div className="sidebar-scroll h-full min-h-0 bg-surface-4 rounded-[1.25rem] border border-edge p-6 pb-24 md:p-8 md:pb-24 lg:pb-8 space-y-8 text-strong overflow-y-auto [overscroll-behavior-y:contain]" data-testid="letter-form">
            <StatusPane
                letter={letter}
                busy={busy}
                canDuplicate={Boolean(letter.cvId) || letter.standalone}
                onLinkCv={() => setDialog("link")}
                onMarkSent={() => setDialog("send")}
                onUnfreeze={() => setDialog("unfreeze")}
                onDuplicate={() => void act(async () => {
                    const copy = await duplicateLetter(letter.id, { copyLabel: t("dashboard.copy") });
                    router.push(`/letters/${copy.id}`);
                })}
            />
            {actionError && <p role="alert" className="text-sm text-danger" data-testid="letter-action-error">{t("letters.action.error")}</p>}
            <RecipientPane letter={letter} onChange={update} readOnly={readOnly} />
            <LetterTextPane letter={letter} tokenValues={resolved?.tokenValues ?? { name: "", role: "", location: "", skills: "" }} onChange={update} readOnly={readOnly} />
            <LayoutPane letter={letter} onChange={update} readOnly={readOnly} />
            {resolved && (
                <DesignPane
                    design={resolved.design}
                    baseDesign={cv && !letter.standalone ? pickLetterDesign(cv.settings) : DEFAULT_LETTER_DESIGN}
                    overridden={resolved.designOverridden}
                    standalone={letter.standalone}
                    onChange={update}
                    readOnly={readOnly}
                />
            )}
            <ParagraphLibrary
                readOnly={readOnly}
                onInsert={(markdown) => update((current) => ({ ...current, paragraphs: [...current.paragraphs, { id: createId(), markdown, prompt: "" }] }))}
            />
            {resolved && (
                <SenderPane
                    sender={resolved.sender}
                    cvSender={cv && !letter.standalone ? senderFromCv(cv) : null}
                    standalone={letter.standalone}
                    overridden={resolved.overridden}
                    onChange={update}
                    readOnly={readOnly}
                />
            )}
            {!readOnly && resolved && resolved.warnings.some((warning) => warning.code !== "cv-missing") && (
                <ul className="space-y-1 rounded-xl border border-edge bg-surface-1 p-3 text-xs text-mid" data-testid="letter-warnings">
                    {resolved.warnings.filter((warning) => warning.code !== "cv-missing").map((warning, index) => <li key={index}>{warningText(t, warning)}</li>)}
                </ul>
            )}
        </div>
    );

    // The CV editor's preview container: a bordered surface holding the zoomable, pannable viewport.
    const preview = (
        <div className="flex-1 bg-surface-4 rounded-[1.25rem] relative w-full h-full border border-edge print:border-none print:w-auto print:h-auto print:bg-white" data-testid="letter-preview-pane">
            <div className="absolute inset-0 overflow-hidden rounded-[1.25rem] print:static print:overflow-visible print:h-auto">
                {resolved && <LetterPreview letter={resolved} />}
            </div>
        </div>
    );

    const savedTime = new Date(letter.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return (
        <div className="flex h-[100dvh] min-h-screen min-h-[100dvh] flex-col overflow-hidden bg-surface-2 font-sans text-strong print:h-auto print:bg-white print:text-black" data-testid="letter-editor">
            <header className="z-10 flex shrink-0 items-center gap-2 px-3 pt-2 pb-1.5 sm:px-6 print:hidden">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 lg:gap-2">
                    <Link href={backHref} aria-label={t("letters.editor.back")} title={t("letters.editor.back")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint transition-colors hover:bg-edge hover:text-strong lg:-ml-1">
                        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    </Link>

                    <div className="h-5 w-px shrink-0 bg-edge" />
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <label className="group flex shrink-0 cursor-text items-center gap-1" title={t("letters.editor.titleLabel")}>
                            <input
                                type="text"
                                value={title}
                                disabled={readOnly}
                                aria-label={t("letters.editor.titleLabel")}
                                placeholder={placeholder}
                                data-testid="letter-title"
                                onChange={(event) => update((current) => ({ ...current, title: event.target.value }))}
                                className="min-w-0 max-w-[34vw] flex-none truncate border-none bg-transparent p-0 text-sm font-medium sm:max-w-[16rem] text-strong/90 outline-none transition-colors placeholder:text-strong/50 focus:ring-0 group-hover:text-strong"
                                style={{ width: `${Math.max(3, Math.min(18, (title || placeholder).length + 1))}ch` }}
                            />
                            <Pencil className="pointer-events-none h-3 w-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                        </label>
                        <DocStateBadge docId={letter.id} />
                        <span role="status" aria-live="polite" className={`flex min-w-0 shrink items-center truncate text-[11px] ${saveState === "error" ? "text-danger" : saveState === "saving" ? "text-info" : "text-faint"}`} data-testid="letter-save-state">
                            {saveState === "saving" ? (
                                <><Loader2 className="w-3 h-3 mr-1 shrink-0 animate-spin" /> {t("dashboard.saving")}</>
                            ) : saveState === "error" ? (
                                t("letters.editor.saveError")
                            ) : saveState === "saved" ? (
                                <span className="hidden truncate sm:inline">{t("dashboard.savedAt", { time: savedTime })}</span>
                            ) : (
                                <span className="hidden truncate sm:inline">{t("dashboard.allSaved")}</span>
                            )}
                        </span>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    <ThemeToggle />
                    <LanguageSwitcher compact />
                    {resolved && <LetterExportMenu letter={resolved} onNeedPreview={isMobileLayout ? () => setPane("preview") : undefined} />}
                </div>
            </header>

            {conflict && (
                <div role="alert" className="mx-3 mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-accent/30 bg-surface-4 px-4 py-3 sm:mx-6 print:hidden" data-testid="letter-conflict">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    <div className="min-w-0 flex-1 basis-64">
                        <p className="text-sm font-medium text-strong">{t("letters.conflict.title")}</p>
                        <p className="text-xs text-mid">{t("letters.conflict.body")}</p>
                    </div>
                    <button type="button" onClick={keepMine} data-testid="letter-conflict-keep" className="rounded-lg border border-edge bg-surface-1 px-3 py-1.5 text-xs font-medium text-strong hover:border-faint">{t("letters.conflict.keepMine")}</button>
                    <button type="button" onClick={loadTheirs} data-testid="letter-conflict-load" className="rounded-lg border border-edge bg-surface-1 px-3 py-1.5 text-xs font-medium text-strong hover:border-faint">{t("letters.conflict.loadTheirs")}</button>
                </div>
            )}

            {letter.status === "draft" && resolved?.warnings.some((warning) => warning.code === "cv-missing") && (
                <div role="status" className="mx-3 mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-accent/30 bg-surface-4 px-4 py-3 sm:mx-6 print:hidden" data-testid="letter-cv-missing">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    <div className="min-w-0 flex-1 basis-64">
                        <p className="text-sm font-medium text-strong">{t("letters.missingCv.title")}</p>
                        <p className="text-xs text-mid">{t("letters.missingCv.body")}</p>
                    </div>
                    <button type="button" onClick={() => setDialog("link")} disabled={cvChoices.length === 0} data-testid="letter-cv-missing-link" className="rounded-lg border border-edge bg-surface-1 px-3 py-1.5 text-xs font-medium text-strong hover:border-faint disabled:opacity-50">{t("letters.missingCv.link")}</button>
                    <button type="button" onClick={() => void act(async () => { await convertToSnapshot(letter.id); })} disabled={busy} data-testid="letter-cv-missing-snapshot" className="rounded-lg border border-edge bg-surface-1 px-3 py-1.5 text-xs font-medium text-strong hover:border-faint disabled:opacity-50">{t("letters.missingCv.snapshot")}</button>
                </div>
            )}

            <main className="min-h-0 flex-1 px-3 pb-3 sm:px-6 sm:pb-4 print:p-0">
                {isMobileLayout ? (
                    <div className="h-full pb-20">
                        {pane === "edit" ? form : preview}
                    </div>
                ) : (
                    <Group orientation="horizontal">
                        <Panel id={PANEL_ID.sidebar} defaultSize={40} minSize={25} className="flex flex-col print:hidden z-10">
                            {form}
                        </Panel>

                        <Separator className="w-6 bg-transparent transition-colors flex items-center justify-center cursor-col-resize print:hidden group">
                            <div className="w-1.5 h-12 rounded-full bg-edge group-hover:bg-faint transition-colors" />
                        </Separator>

                        <Panel id={PANEL_ID.preview} defaultSize={60} minSize={30} className="flex justify-center print:py-0 print:px-0 print:bg-white print:block h-full print:h-auto">
                            {preview}
                        </Panel>
                    </Group>
                )}
            </main>

            {isMobileLayout && (
                <div className="fixed inset-x-0 bottom-0 z-40 grid shrink-0 grid-cols-2 items-center gap-2 border-t border-edge bg-surface-2/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.28)] backdrop-blur lg:hidden print:hidden">
                    <MobileFooterButton testId="letter-pane-edit" active={pane === "edit"} onClick={() => setPane("edit")} icon={<FileText className="h-3.5 w-3.5 shrink-0" />} label={t("letters.editor.pane.edit")} />
                    <MobileFooterButton testId="letter-pane-preview" active={pane === "preview"} onClick={() => setPane("preview")} icon={<Eye className="h-3.5 w-3.5 shrink-0" />} label={t("letters.editor.pane.preview")} />
                </div>
            )}

            {dialog === "link" && (
                <RepointDialog letter={letter} cvs={cvChoices} mode="repoint" busy={busy} onClose={() => setDialog(null)} onConfirm={(cvId) => void act(async () => { await repointLetter(letter.id, cvId); })} />
            )}
            {dialog === "send" && (
                <MarkSentDialog warnings={sendWarnings(letter, cv)} busy={busy} onClose={() => setDialog(null)} onConfirm={() => void act(async () => { await markSent(letter.id); })} />
            )}
            <ConfirmModal
                open={dialog === "unfreeze"}
                title={t("letters.unfreeze.title")}
                description={t(letter.standalone ? "letters.unfreeze.bodyStandalone" : "letters.unfreeze.body")}
                confirmLabel={t("letters.unfreeze.confirm")}
                onConfirm={() => void act(async () => { await unfreeze(letter.id); })}
                onCancel={() => setDialog(null)}
            />
        </div>
    );
}
