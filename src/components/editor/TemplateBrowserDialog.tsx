"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Search, X } from "lucide-react";

import { db } from "@/lib/db";
import { useResumeStore } from "@/lib/store";
import { getBuiltinTemplates } from "@/lib/templates/enginecv-templates";
import { templateDisplayMeta } from "@/lib/templates/template-display";
import { type TemplateDocument } from "@/lib/templates/template-schema";
import { TemplatePreviewCard } from "@/components/templates/TemplatePreviewCard";
import { useTranslation } from "@/lib/i18n";

export interface TemplateBrowserDialogProps {
    open: boolean;
    onClose: () => void;
    /** Optional callback after a template is applied to the current resume. */
    onApplied?: (templateId: string) => void;
    currentTemplateId?: string | null;
}

type Tab = "enginecv" | "user";

export function TemplateBrowserDialog({ open, onClose, onApplied, currentTemplateId }: TemplateBrowserDialogProps) {
    const { t } = useTranslation();
    const applyTemplateById = useResumeStore((s) => s.applyTemplateById);

    const [tab, setTab] = useState<Tab>("enginecv");
    const [query, setQuery] = useState("");

    const handleClose = useCallback(() => {
        setQuery("");
        onClose();
    }, [onClose]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, handleClose]);

    const builtins = useMemo(() => getBuiltinTemplates(), []);
    const userTemplates = useLiveQuery(async () => {
        const all = await db.templates.toArray();
        return all.sort((a, b) => b.updatedAt - a.updatedAt);
    }, []) ?? [];

    const filter = (list: TemplateDocument[]) => {
        const q = query.trim().toLowerCase();
        if (!q) return list;
        return list.filter((tpl) => {
            const display = templateDisplayMeta(tpl, t);
            if ([display.name, display.description, ...display.tags].some((value) => value.toLowerCase().includes(q))) return true;
            if (tpl.meta.name.toLowerCase().includes(q)) return true;
            if (tpl.meta.description.toLowerCase().includes(q)) return true;
            if (tpl.meta.tags.some((tag) => tag.toLowerCase().includes(q))) return true;
            return false;
        });
    };

    const visible = filter(tab === "enginecv" ? builtins : userTemplates);

    if (!open) return null;

    const handleApply = async (template: TemplateDocument) => {
        const ok = await applyTemplateById(template.id);
        if (ok) {
            onApplied?.(template.id);
            handleClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) handleClose();
            }}
        >
            <div className="flex w-full max-w-5xl max-h-[88dvh] flex-col overflow-hidden rounded-2xl border border-edge bg-surface-2 text-strong shadow-2xl">
                <div className="flex items-center justify-between p-5 border-b border-edge">
                    <div>
                        <h2 className="text-lg font-semibold">{t("dashboard.tabTemplates")}</h2>
                        <p className="text-xs text-faint mt-0.5">{t("templateBrowser.subtitle")}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="w-8 h-8 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint transition-colors flex items-center justify-center"
                        aria-label={t("common.close")}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 p-4 border-b border-edge">
                    <div className="flex items-center bg-surface-4 border border-edge rounded-xl p-1">
                        <button
                            type="button"
                            onClick={() => setTab("enginecv")}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "enginecv" ? "bg-edge text-strong" : "text-faint hover:text-strong"}`}
                        >
                            {t("dashboard.builtinTemplates")} ({builtins.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab("user")}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "user" ? "bg-edge text-strong" : "text-faint hover:text-strong"}`}
                        >
                            {t("dashboard.yourTemplates")} ({userTemplates.length})
                        </button>
                    </div>

                    <div className="relative w-full min-w-0 flex-1 sm:min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("dashboard.searchTemplates")}
                            className="w-full bg-surface-4 border border-edge rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-faint placeholder:text-faint"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {visible.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center gap-2 py-16 text-faint">
                            <p className="text-sm">{t("templateBrowser.noMatch")}</p>
                            {tab === "user" && (
                                <p className="text-xs">{t("templateBrowser.noUserTemplatesHint")}</p>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {visible.map((template) => (
                                <TemplateGridCard
                                    key={template.id}
                                    template={template}
                                    isCurrent={template.id === currentTemplateId}
                                    onApply={() => handleApply(template)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

interface TemplateGridCardProps {
    template: TemplateDocument;
    isCurrent: boolean;
    onApply: () => void;
}

function TemplateGridCard({ template, isCurrent, onApply }: TemplateGridCardProps) {
    const { t } = useTranslation();
    const meta = templateDisplayMeta(template, t);
    return (
        <button
            type="button"
            onClick={onApply}
            title={t("templateBrowser.apply", { name: meta.name })}
            className={`group flex flex-col rounded-2xl border p-3 text-left transition-colors ${isCurrent ? "border-accent bg-accent/5" : "border-edge bg-surface-4 hover:border-faint"}`}
        >
            <TemplatePreviewCard
                template={template}
                variant="catalog"
                showName={false}
                className="[&>div]:!h-auto [&>div]:!min-h-0 [&>div]:aspect-[0.72] [&>div]:!max-w-none [&>div]:!w-full"
            />
            <div className="mt-3 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-strong">{meta.name}</span>
                {isCurrent && (
                    <span className="shrink-0 rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                        {t("templateBrowser.active")}
                    </span>
                )}
            </div>
            {meta.description && (
                <p className="mt-1 line-clamp-2 text-xs text-faint">{meta.description}</p>
            )}
        </button>
    );
}
