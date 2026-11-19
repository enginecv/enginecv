"use client";

import { arrayMove } from "@dnd-kit/sortable";
import { BookmarkPlus, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { MarkdownField } from "@/components/editor/MarkdownField";
import { SortableList } from "@/components/ui/sortable";
import { useTranslation } from "@/lib/i18n";
import { createId } from "@/lib/id";
import type { LetterDocument } from "@/lib/letters/schema";
import { saveParagraph } from "@/lib/letters/store";
import type { LetterToken, TokenValues } from "@/lib/letters/tokens";
import { PaneSection, TextField } from "./fields";
import { TokenTray } from "./TokenTray";

const TIP_KEYS = ["intro", "company", "evidence", "closing"] as const;
const iconButton = "w-7 h-7 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint disabled:opacity-35 disabled:hover:text-faint disabled:hover:border-edge transition-colors flex items-center justify-center";

/**
 * Salutation, the paragraphs and the closing. The paragraphs are a list of any length, laid out
 * like the CV editor's entry lists: drag by the grip (or use the arrows) to reorder, add as many
 * as the letter needs. Each is markdown (bold, italic, links, bullet lists); pasted formatted
 * text is reduced to plain text, so only the supported markdown can get in.
 */
export function LetterTextPane({ letter, tokenValues, onChange, readOnly = false }: {
    letter: LetterDocument;
    tokenValues: TokenValues;
    onChange: (change: (current: LetterDocument) => LetterDocument) => void;
    readOnly?: boolean;
}) {
    const { t } = useTranslation();
    const rootRef = useRef<HTMLDivElement>(null);
    const activeId = useRef<string | null>(null);
    // The paragraph being named for the library, and the outcome of the last save.
    const [saving, setSaving] = useState<{ id: string; name: string } | null>(null);
    const [savedId, setSavedId] = useState<string | null>(null);

    const saveToLibrary = async () => {
        if (!saving) return;
        const source = letter.paragraphs.find((paragraph) => paragraph.id === saving.id);
        if (!source) return;
        await saveParagraph({ name: saving.name, markdown: source.markdown });
        setSavedId(saving.id);
        setSaving(null);
    };

    const setParagraph = (id: string, markdown: string) =>
        onChange((current) => ({ ...current, paragraphs: current.paragraphs.map((paragraph) => (paragraph.id === id ? { ...paragraph, markdown } : paragraph)) }));

    const addParagraph = () =>
        onChange((current) => ({ ...current, paragraphs: [...current.paragraphs, { id: createId(), markdown: "", prompt: "" }] }));

    const removeParagraph = (id: string) =>
        onChange((current) => ({ ...current, paragraphs: current.paragraphs.filter((paragraph) => paragraph.id !== id) }));

    const reorder = (from: number, to: number) =>
        onChange((current) => ({ ...current, paragraphs: arrayMove(current.paragraphs, from, to) }));

    /** Puts `{{token}}` at the caret of the paragraph the person was last typing in. */
    const insertToken = useCallback((token: LetterToken) => {
        const text = `{{${token}}}`;
        const paragraphs = letter.paragraphs;
        const targetId = activeId.current && paragraphs.some((paragraph) => paragraph.id === activeId.current) ? activeId.current : paragraphs[paragraphs.length - 1]?.id;
        if (!targetId) {
            onChange((current) => ({ ...current, paragraphs: [{ id: createId(), markdown: text, prompt: "" }] }));
            return;
        }
        const textarea = rootRef.current?.querySelector<HTMLTextAreaElement>(`[data-letter-paragraph="${targetId}"] textarea`);
        const target = paragraphs.find((paragraph) => paragraph.id === targetId);
        const source = target?.markdown ?? "";
        const start = textarea?.selectionStart ?? source.length;
        const end = textarea?.selectionEnd ?? source.length;
        setParagraph(targetId, source.slice(0, start) + text + source.slice(end));
        requestAnimationFrame(() => {
            textarea?.focus();
            textarea?.setSelectionRange(start + text.length, start + text.length);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [letter.paragraphs]);

    /** Formatted pastes (web pages, Word) arrive as plain text; markdown typed by hand is untouched. */
    const reducePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
        const clipboard = event.clipboardData;
        if (!clipboard || !clipboard.types.includes("text/html")) return;
        const plain = clipboard.getData("text/plain");
        const textarea = event.target as HTMLTextAreaElement;
        if (!textarea || textarea.tagName !== "TEXTAREA") return;
        event.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const id = (textarea.closest("[data-letter-paragraph]") as HTMLElement | null)?.dataset.letterParagraph;
        const target = letter.paragraphs.find((paragraph) => paragraph.id === id);
        if (id && target) setParagraph(id, target.markdown.slice(0, start) + plain + target.markdown.slice(end));
    };

    return (
        <PaneSection title={t("letters.section.text")} testId="letter-text-pane" tips="text">
            <div ref={rootRef} className="space-y-4" onPasteCapture={reducePaste}>
                <TextField label={t("letters.salutation")} value={letter.salutation} disabled={readOnly} testId="letter-salutation"
                    onChange={(salutation) => onChange((current) => ({ ...current, salutation }))} />

                {!readOnly && <TokenTray values={tokenValues} onInsert={insertToken} />}

                <div className="space-y-3" data-testid="letter-paragraph-list">
                    <SortableList
                        items={letter.paragraphs}
                        getId={(paragraph) => paragraph.id}
                        onReorder={reorder}
                        describe={(paragraph) => paragraph.markdown.slice(0, 40) || t("letters.paragraph.label", { number: letter.paragraphs.indexOf(paragraph) + 1 })}
                        disabled={readOnly}
                    >
                        {(paragraph, index, { itemProps, handleProps, isDragging }) => {
                            const labelId = `letter-paragraph-label-${paragraph.id}`;
                            return (
                                <div
                                    {...itemProps}
                                    data-letter-paragraph={paragraph.id}
                                    data-testid={`letter-paragraph-card-${index}`}
                                    onFocusCapture={() => { activeId.current = paragraph.id; }}
                                    className={`bg-surface-1 border rounded-xl p-3 hover:border-faint transition-colors ${isDragging ? "border-accent shadow-lg" : "border-edge"} [&_input]:select-text [&_textarea]:select-text [&_input]:caret-accent [&_textarea]:caret-accent`}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center min-w-0 gap-2">
                                            {!readOnly && (
                                                <button
                                                    type="button"
                                                    {...handleProps}
                                                    data-testid={`letter-paragraph-drag-${index}`}
                                                    aria-label={t("editor.dragFromHere")}
                                                    title={t("editor.dragFromHere")}
                                                    className="w-6 h-6 rounded-md border border-edge text-faint hover:text-strong hover:border-faint cursor-grab active:cursor-grabbing flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                                >
                                                    <span className="grid grid-cols-2 gap-[2px]">
                                                        {Array.from({ length: 6 }).map((_, dot) => <span key={dot} className="w-[2px] h-[2px] rounded-full bg-current" />)}
                                                    </span>
                                                </button>
                                            )}
                                            <span id={labelId} className="text-sm text-strong/90 truncate">{t("letters.paragraph.label", { number: index + 1 })}</span>
                                        </div>
                                        {!readOnly && (
                                            <div className="flex items-center gap-1">
                                                <button type="button" onClick={() => reorder(index, index - 1)} disabled={index === 0} aria-label={t("letters.paragraph.moveUp")} title={t("letters.paragraph.moveUp")} className={iconButton} data-testid={`letter-paragraph-up-${index}`}>
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button type="button" onClick={() => reorder(index, index + 1)} disabled={index === letter.paragraphs.length - 1} aria-label={t("letters.paragraph.moveDown")} title={t("letters.paragraph.moveDown")} className={iconButton} data-testid={`letter-paragraph-down-${index}`}>
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                </button>
                                                <button type="button" disabled={!paragraph.markdown.trim()} onClick={() => { setSavedId(null); setSaving({ id: paragraph.id, name: "" }); }} aria-label={t("letters.library.saveToLibrary")} title={t("letters.library.saveToLibrary")} className={iconButton} data-testid={`letter-paragraph-save-${index}`}>
                                                    <BookmarkPlus className="w-3.5 h-3.5" />
                                                </button>
                                                <button type="button" onClick={() => removeParagraph(paragraph.id)} aria-label={t("letters.paragraph.remove")} title={t("letters.paragraph.remove")} className={`${iconButton} hover:!text-danger`} data-testid={`letter-paragraph-remove-${index}`}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {saving?.id === paragraph.id && (
                                        <div className="mb-3 flex flex-wrap items-end gap-2" data-testid="letter-paragraph-save-form">
                                            <div className="min-w-0 flex-1 basis-48">
                                                <TextField label={t("letters.library.name")} value={saving.name} placeholder={t("letters.library.namePlaceholder")} onChange={(name) => setSaving({ ...saving, name })} testId="letter-paragraph-save-name" />
                                            </div>
                                            <button type="button" onClick={() => void saveToLibrary()} data-testid="letter-paragraph-save-confirm" className="rounded-lg border border-edge px-3 py-2 text-sm font-medium text-bright hover:border-faint hover:text-strong">{t("letters.library.saveConfirm")}</button>
                                            <button type="button" onClick={() => setSaving(null)} className="rounded-lg border border-edge px-3 py-2 text-sm font-medium text-mid hover:border-faint hover:text-strong">{t("dashboard.cancel")}</button>
                                        </div>
                                    )}
                                    {savedId === paragraph.id && <p role="status" className="mb-2 text-xs text-success" data-testid="letter-paragraph-saved">{t("letters.library.saved")}</p>}

                                    {readOnly ? (
                                        <p className="whitespace-pre-wrap text-sm text-mid" data-testid={`letter-paragraph-text-${index}`}>{paragraph.markdown}</p>
                                    ) : (
                                        <MarkdownField
                                            value={paragraph.markdown}
                                            onChange={(markdown) => setParagraph(paragraph.id, markdown)}
                                            labelledBy={labelId}
                                            height={140}
                                            toolbar="letter"
                                            textareaProps={{ placeholder: paragraph.prompt || t("letters.paragraph.placeholder"), "data-testid": `letter-paragraph-input-${index}` }}
                                        />
                                    )}
                                </div>
                            );
                        }}
                    </SortableList>
                </div>

                {letter.paragraphs.length === 0 && <p className="rounded-xl border border-dashed border-edge p-4 text-center text-xs text-faint" data-testid="letter-paragraphs-empty">{t("letters.paragraph.none")}</p>}

                {!readOnly && (
                    <button type="button" onClick={addParagraph} data-testid="letter-paragraph-add" className="flex items-center gap-2 rounded-xl border border-edge px-3 py-2 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {t("letters.paragraph.add")}
                    </button>
                )}

                {!readOnly && (
                    <details className="rounded-xl border border-edge bg-surface-1 px-3 py-2 text-xs text-mid" data-testid="letter-tips">
                        <summary className="cursor-pointer text-sm font-medium text-strong/90">{t("letters.tips.title")}</summary>
                        <p className="mt-2 text-faint">{t("letters.tips.note")}</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                            {TIP_KEYS.map((key) => <li key={key}>{t(`letters.tips.${key}`)}</li>)}
                        </ul>
                    </details>
                )}

                <TextField label={t("letters.closing")} value={letter.closing} disabled={readOnly} testId="letter-closing"
                    onChange={(closing) => onChange((current) => ({ ...current, closing }))} />
            </div>
        </PaneSection>
    );
}
