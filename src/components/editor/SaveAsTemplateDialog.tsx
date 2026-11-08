"use client";

import { useEffect, useState } from "react";
import { X, Plus, Save } from "lucide-react";

import type { TemplateMeta } from "@/lib/templates/template-schema";
import { useTranslation } from "@/lib/i18n";

const SUGGESTED_TAGS = ["Simple", "Modern", "Creative", "Clean", "Compact", "Classic"];

export interface SaveAsTemplateDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: (meta: Partial<TemplateMeta>) => Promise<void> | void;
    initialName?: string;
}

export function SaveAsTemplateDialog({ open, onClose, onSave, initialName }: SaveAsTemplateDialogProps) {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [tagDraft, setTagDraft] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setName(initialName ?? "Untitled template");
            setDescription("");
            setTags([]);
            setTagDraft("");
        }
    }, [open, initialName]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    const addTag = (raw: string) => {
        const value = raw.trim();
        if (!value) return;
        if (tags.includes(value)) return;
        setTags((prev) => [...prev, value]);
        setTagDraft("");
    };

    const removeTag = (value: string) => {
        setTags((prev) => prev.filter((tag) => tag !== value));
    };

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try {
            await onSave({ name: name.trim() || t("dashboard.untitledTemplate"), description: description.trim(), tags });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-2xl border border-edge bg-surface-2 p-5 text-strong shadow-2xl sm:p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">{t("saveTemplate.title")}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint transition-colors flex items-center justify-center"
                        aria-label={t("common.close")}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <p className="text-xs text-bright mb-5">
                    {t("saveTemplate.description")}
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-1.5 block">{t("saveTemplate.name")}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-surface-4 border border-edge rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-faint placeholder:text-faint"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-1.5 block">{t("saveTemplate.notes")}</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="w-full bg-surface-4 border border-edge rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-faint placeholder:text-faint resize-none"
                            placeholder={t("saveTemplate.notesPlaceholder")}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-1.5 block">{t("dashboard.tags")}</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-4 border border-edge text-xs text-strong"
                                >
                                    {tag}
                                    <button
                                        type="button"
                                        onClick={() => removeTag(tag)}
                                        className="text-faint hover:text-danger"
                                        aria-label={t("saveTemplate.removeTag", { tag })}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={tagDraft}
                                onChange={(e) => setTagDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addTag(tagDraft);
                                    }
                                }}
                                placeholder={t("editor.customTagsPlaceholder")}
                                className="flex-1 bg-surface-4 border border-edge rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-faint placeholder:text-faint"
                            />
                            <button
                                type="button"
                                onClick={() => addTag(tagDraft)}
                                disabled={!tagDraft.trim()}
                                className="w-9 h-9 rounded-lg bg-surface-4 border border-edge text-faint hover:text-strong hover:border-faint disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                                aria-label={t("saveTemplate.addTag")}
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {SUGGESTED_TAGS.filter((suggested) => !tags.includes(suggested)).map((tag) => (
                                <button
                                    type="button"
                                    key={tag}
                                    onClick={() => addTag(tag)}
                                    className="px-2 py-1 rounded-md text-[11px] border border-dashed border-edge text-faint hover:text-strong hover:border-faint transition-colors"
                                >
                                    + {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-sm font-medium border border-edge text-bright hover:text-strong hover:border-faint transition-colors"
                    >
                        {t("dashboard.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-accent text-surface-2 hover:bg-accent-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" /> {t("saveTemplate.save")}
                    </button>
                </div>
            </div>
        </div>
    );
}
