"use client";

import { useAI } from "@/hooks/useAI";
import { useTranslation } from "@/lib/i18n";
import { AI_ENABLED } from "@/lib/features";
import { Input, AutocompleteInput, LinkInput } from "./FormUtils";
import { DatePicker } from "@/components/ui/date-picker";
import { Eye, EyeOff, Trash2, Loader2 } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useResumeStore } from "@/lib/store";
import { GetTipsLink } from "./GetTipsLink";
import { MarkdownField } from "./MarkdownField";

export type EntryConfig = {
    titleLabel: string;
    titlePlaceholder: string;
    titleKey: string;
    titleUrlKey?: string;
    titleUrlIconKey?: string;

    subtitleLabel?: string;
    subtitlePlaceholder?: string;
    subtitleKey?: string;

    urlKey?: string;
    urlIconKey?: string;

    locationKey?: string;
    descriptionKey: string;
    descriptionLabel?: string;

    dateMode?: "range" | "single" | "none";
    datePrecision?: "day" | "month" | "year";
    startDateLabel?: string;
    endDateLabel?: string;
    singleDateKey?: string;
    singleDateLabel?: string;
    singleDatePrecision?: "day" | "month" | "year";
    extraFields?: (item: any, onChange: (updated: any) => void) => ReactNode;
};

export function EntryForm({
    item,
    onChange,
    onRemove,
    config,
    sectionId,
    locationSuggestions,
    subtitleSuggestions,
    flush,
}: {
    item: any;
    onChange: (updated: any) => void;
    onRemove: () => void;
    config: EntryConfig;
    /** Editor section id, so Get Tips can open that section's guide. */
    sectionId?: string;
    locationSuggestions?: string[];
    subtitleSuggestions?: string[];
    // When true, drop the card chrome (border/background/padding) so the form
    // sits flush in its container instead of reading as a nested box.
    flush?: boolean;
}) {
    const { t } = useTranslation();
    const cvLanguage = useResumeStore((state) => state.resume.settings?.language || "en");
    const { generateAIContent } = useAI();
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiMode, setAiMode] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleAIGeneration = async (mode: string, promptPrefix: string) => {
        setIsGenerating(true);
        setAiMode(mode);
        try {
            const currentDesc = item[config.descriptionKey] || "";
            const prompt = `${promptPrefix}:\n\n${currentDesc}`;
            const newDesc = await generateAIContent([{ role: "user", content: prompt }], "local");
            if (newDesc) {
                onChange({ ...item, [config.descriptionKey]: newDesc });
            }
        } catch (e) {
            alert(t("editor.aiFailed"));
        } finally {
            setIsGenerating(false);
            setAiMode(null);
        }
    };

    const descriptionLabelId = useId();

    return (
        <div className={`space-y-5 text-strong relative group ${flush ? "" : "bg-surface-1 border border-edge rounded-2xl p-6 shadow-sm"}`}>
            <ConfirmModal
                open={showDeleteConfirm}
                title={t("editor.deleteEntry")}
                description={t("editor.deleteEntryConfirm", { type: config.titleLabel.split('/')[0].trim().toLowerCase() })}
                confirmLabel={t("editor.delete")}
                destructive={true}
                onCancel={() => setShowDeleteConfirm(false)}
                onConfirm={() => {
                    setShowDeleteConfirm(false);
                    onRemove();
                }}
            />
            {/* In flush (single-entry) mode these controls live in the section
                header instead, so the row is hidden here. */}
            {!flush && (
            <div className="flex items-center justify-end mb-4">
                <div className="flex items-center gap-2">
                    {sectionId ? <GetTipsLink sectionId={sectionId} className="bg-surface-4" /> : null}
                    <button
                        type="button"
                        data-testid="entry-form-visibility"
                        onClick={() => onChange({ ...item, hidden: !item.hidden })}
                        aria-label={item.hidden ? t("editor.showEntry") : t("editor.hideEntry")}
                        title={item.hidden ? t("editor.showEntry") : t("editor.hideEntry")}
                        className={`w-8 h-8 rounded-lg bg-surface-4 border transition-colors flex items-center justify-center shadow-sm ${
                            item.hidden
                                ? "border-faint text-mid hover:text-strong"
                                : "border-edge text-faint hover:text-strong"
                        }`}
                    >
                        {item.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={() => setShowDeleteConfirm(true)} aria-label={t("editor.deleteEntryAction")} title={t("editor.deleteEntryAction")} className="w-8 h-8 rounded-lg bg-surface-4 border border-edge text-faint hover:text-danger transition-colors flex items-center justify-center shadow-sm">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
            )}

            {config.titleUrlKey ? (
                <LinkInput
                    label={config.titleLabel}
                    url={item[config.titleUrlKey] || ""}
                    displayLabel={item[config.titleKey] || ""}
                    onUrlChange={(val) => onChange({ ...item, [config.titleUrlKey!]: val })}
                    onLabelChange={(val) => onChange({ ...item, [config.titleKey]: val })}
                    iconValue={config.titleUrlIconKey ? (item[config.titleUrlIconKey] || "auto") : undefined}
                    onIconChange={config.titleUrlIconKey ? ((val) => onChange({ ...item, [config.titleUrlIconKey!]: val })) : undefined}
                    placeholder={config.titlePlaceholder}
                    displayLabelInputProps={{ "data-testid": `entry-input-${config.titleKey}` }}
                />
            ) : (
                <Input
                    label={config.titleLabel}
                    value={item[config.titleKey] || ""}
                    onChange={(e: any) => onChange({ ...item, [config.titleKey]: e.target.value })}
                    placeholder={config.titlePlaceholder}
                    data-testid={`entry-input-${config.titleKey}`}
                />
            )}

            {config.subtitleKey && config.subtitleLabel && (
                <div className="relative group">
                    {config.urlKey ? (
                        <LinkInput
                            label={config.subtitleLabel}
                            url={item[config.urlKey] || ""}
                            displayLabel={item[config.subtitleKey] || ""}
                            onUrlChange={(val) => onChange({ ...item, [config.urlKey!]: val })}
                            onLabelChange={(val) => onChange({ ...item, [config.subtitleKey!]: val })}
                            iconValue={config.urlIconKey ? (item[config.urlIconKey] || "auto") : undefined}
                            onIconChange={config.urlIconKey ? ((val) => onChange({ ...item, [config.urlIconKey!]: val })) : undefined}
                            placeholder={config.subtitlePlaceholder || ""}
                            subtitleSuggestions={subtitleSuggestions}
                            displayLabelInputProps={{ "data-testid": `entry-input-${config.subtitleKey}` }}
                        />
                    ) : (
                        subtitleSuggestions && subtitleSuggestions.length > 0 ? (
                            <AutocompleteInput
                                label={config.subtitleLabel}
                                value={item[config.subtitleKey] || ""}
                                onChange={(val) => onChange({ ...item, [config.subtitleKey!]: val })}
                                placeholder={config.subtitlePlaceholder}
                                suggestions={subtitleSuggestions}
                                data-testid={`entry-input-${config.subtitleKey}`}
                            />
                        ) : (
                            <Input
                                label={config.subtitleLabel}
                                value={item[config.subtitleKey] || ""}
                                onChange={(e: any) => onChange({ ...item, [config.subtitleKey!]: e.target.value })}
                                placeholder={config.subtitlePlaceholder}
                                data-testid={`entry-input-${config.subtitleKey}`}
                            />
                        )
                    )}
                </div>
            )}

            {config.extraFields?.(item, onChange)}

            {config.dateMode === "none" ? null : config.dateMode === "single" ? (
                <DatePicker
                    label={config.singleDateLabel || t("editor.dateLabel")}
                    value={item[config.singleDateKey || "date"] || ""}
                    onChange={(v) => onChange({ ...item, [config.singleDateKey || "date"]: v })}
                    precision={config.singleDatePrecision ?? config.datePrecision ?? "month"}
                    language={cvLanguage}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DatePicker
                        label={config.startDateLabel ?? t("editor.startDate")}
                        value={item.start || ""}
                        onChange={(v) => onChange({ ...item, start: v })}
                        precision={config.datePrecision ?? "month"}
                        language={cvLanguage}
                    />
                    <DatePicker
                        label={config.endDateLabel ?? t("editor.endDate")}
                        value={item.end || ""}
                        onChange={(v) => onChange({ ...item, end: v })}
                        precision={config.datePrecision ?? "month"}
                        allowPresent
                        language={cvLanguage}
                    />
                </div>
            )}
            {config.locationKey && (
                <AutocompleteInput
                    label={t("editor.locationLabel")}
                    value={item[config.locationKey] || ""}
                    onChange={(val) => onChange({ ...item, [config.locationKey!]: val })}
                    placeholder={t("editor.entryLocationPlaceholder")}
                    suggestions={locationSuggestions || []}
                    data-testid={`entry-input-${config.locationKey}`}
                />
            )}

            {/* Markdown Description Editor */}
            <div className="space-y-2">
                <label id={descriptionLabelId} className="text-[11px] font-medium text-faint uppercase tracking-wider">{config.descriptionLabel || t("editor.description")}</label>
                <MarkdownField
                    value={item[config.descriptionKey] || ""}
                    onChange={(value) => onChange({ ...item, [config.descriptionKey]: value })}
                    labelledBy={descriptionLabelId}
                />
            </div>

            {AI_ENABLED && (
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center mr-1">
                        <svg className="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                        </svg>
                    </div>

                    <button
                        onClick={() => handleAIGeneration("improve", "Improve this text to be more professional")}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                    >
                        {isGenerating && aiMode === "improve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        {t("editor.improveWriting")}
                    </button>

                    <button
                        onClick={() => handleAIGeneration("suggest", "Suggest content additions based on this text")}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                    >
                        {isGenerating && aiMode === "suggest" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        {t("editor.suggestContent")}
                    </button>

                    <button
                        onClick={() => handleAIGeneration("grammar", "Fix any grammar or spelling mistakes in this text")}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                    >
                        {isGenerating && aiMode === "grammar" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        {t("editor.grammarCheck")}
                    </button>

                    <button
                        onClick={() => handleAIGeneration("shorter", "Make this text shorter and more concise")}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
                    >
                        {isGenerating && aiMode === "shorter" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        {t("editor.shorter")}
                    </button>
                </div>
            )}
        </div>
    );
}
