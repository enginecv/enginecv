"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useTranslation } from "@/lib/i18n";
import type { ParagraphEntry } from "@/lib/letters/schema";
import { deleteParagraph, listParagraphs, saveParagraph } from "@/lib/letters/store";
import { PaneSection, TextAreaField, TextField } from "./fields";

/**
 * The person's saved paragraphs. Inserting one into a letter copies it, so changing the
 * saved version or the letter's version never changes the other.
 */
export function ParagraphLibrary({ onInsert, readOnly = false }: { onInsert: (markdown: string) => void; readOnly?: boolean }) {
    const { t } = useTranslation();
    const entries = useLiveQuery(() => listParagraphs(), []);
    const [editing, setEditing] = useState<{ id: string; name: string; markdown: string } | null>(null);
    const [deleting, setDeleting] = useState<ParagraphEntry | null>(null);
    const [failed, setFailed] = useState(false);

    const saveEdit = async () => {
        if (!editing) return;
        setFailed(false);
        try {
            await saveParagraph(editing);
            setEditing(null);
        } catch {
            setFailed(true);
        }
    };

    const small = "rounded-lg border border-edge px-2.5 py-1 text-xs font-medium text-bright transition-colors hover:border-faint hover:text-strong disabled:opacity-50";

    return (
        <PaneSection title={t("letters.library.title")} testId="letter-library">
            <p className="text-xs text-mid">{t("letters.library.hint")}</p>
            {entries === undefined ? null : entries.length === 0 ? (
                <p className="rounded-xl border border-dashed border-edge p-4 text-center text-xs text-faint" data-testid="letter-library-empty">{t("letters.library.empty")}</p>
            ) : (
                <ul className="space-y-3">
                    {entries.map((entry) => (
                        <li key={entry.id} className="space-y-2 rounded-xl border border-edge bg-surface-1 p-3" data-testid="letter-library-entry">
                            {editing?.id === entry.id ? (
                                <div className="space-y-3">
                                    <TextField label={t("letters.library.name")} value={editing.name} onChange={(name) => setEditing({ ...editing, name })} testId="letter-library-edit-name" />
                                    <TextAreaField label={t("letters.library.text")} value={editing.markdown} rows={4} onChange={(markdown) => setEditing({ ...editing, markdown })} testId="letter-library-edit-text" />
                                    {failed && <p role="alert" className="text-xs text-danger">{t("letters.action.error")}</p>}
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => void saveEdit()} data-testid="letter-library-edit-save" className={small}>{t("letters.library.editSave")}</button>
                                        <button type="button" onClick={() => setEditing(null)} className={small}>{t("dashboard.cancel")}</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className="truncate text-sm font-medium text-strong" data-testid="letter-library-entry-name">{entry.name}</p>
                                    <p className="line-clamp-3 whitespace-pre-wrap text-xs text-mid">{entry.markdown}</p>
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" disabled={readOnly} onClick={() => onInsert(entry.markdown)} data-testid="letter-library-insert" className={small}>{t("letters.library.insert")}</button>
                                        <button type="button" onClick={() => setEditing({ id: entry.id, name: entry.name, markdown: entry.markdown })} data-testid="letter-library-edit" className={small}>{t("letters.library.edit")}</button>
                                        <button type="button" onClick={() => setDeleting(entry)} data-testid="letter-library-delete" className={`${small} hover:text-danger`}>{t("letters.library.delete")}</button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            <ConfirmModal
                open={!!deleting}
                title={t("letters.library.deleteTitle")}
                description={t("letters.library.deleteBody", { name: deleting?.name ?? "" })}
                confirmLabel={t("letters.library.deleteConfirm")}
                destructive
                onConfirm={() => {
                    if (deleting) void deleteParagraph(deleting.id);
                    setDeleting(null);
                }}
                onCancel={() => setDeleting(null)}
            />
        </PaneSection>
    );
}
