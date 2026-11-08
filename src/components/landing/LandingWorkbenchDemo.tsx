"use client";

import { ChevronLeft, ChevronRight, CircleCheck, LayoutTemplate, MousePointerClick, Palette, Type } from "lucide-react";
import { useMemo, useState, type ChangeEvent } from "react";
import { ResumePreview } from "@/components/editor/ResumePreview";
import { Input as EditorInput } from "@/components/editor/FormUtils";
import { useTemplateResume } from "@/components/templates/useTemplateResume";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n";
import {
    getNextTemplateIndex,
    getPreviousTemplateIndex,
    getTemplateCounterParams,
    limitShowcaseTemplates,
    normalizeTemplateIndex,
} from "@/lib/landing-template-carousel";
import { getBuiltinTemplates } from "@/lib/templates/enginecv-templates";
import { applyTemplateToResume } from "@/lib/templates/template-apply";
import { getSampleResumeForTemplatePreview } from "@/lib/templates/template-preview";

const ACCENTS = ["#ff8a66", "#7187ff", "#19a974", "#d97706", "#7c3aed"];

type DemoTab = "content" | "design";

export function LandingWorkbenchDemo() {
    const { t } = useTranslation();
    const templates = useMemo(() => limitShowcaseTemplates(getBuiltinTemplates()), []);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [tab, setTab] = useState<DemoTab>("content");
    const [name, setName] = useState("Alex Carter");
    const [headline, setHeadline] = useState("Senior Product Designer");
    const [accent, setAccent] = useState(templates[0]?.settings.colors.accent ?? ACCENTS[0]);
    const [density, setDensity] = useState<"compact" | "comfortable">("comfortable");
    const templateAction = useTemplateResume();
    const total = templates.length;
    const selectedTemplate = templates[selectedIndex];
    const counterParams = getTemplateCounterParams(selectedIndex, total);

    const demoResume = useMemo(() => {
        if (!selectedTemplate) return null;

        const sample = getSampleResumeForTemplatePreview();
        const { resume } = applyTemplateToResume(sample, selectedTemplate);
        const itemSpacing = density === "compact"
            ? Math.max(4, resume.settings.spacing.itemSpacing - 3)
            : resume.settings.spacing.itemSpacing;

        return {
            ...resume,
            basics: {
                ...resume.basics,
                name,
                headline,
            },
            settings: {
                ...resume.settings,
                colors: {
                    ...resume.settings.colors,
                    accent,
                },
                spacing: {
                    ...resume.settings.spacing,
                    itemSpacing,
                },
            },
        };
    }, [accent, density, headline, name, selectedTemplate]);

    const selectTemplate = (index: number) => {
        const nextIndex = normalizeTemplateIndex(index, total);
        const nextTemplate = templates[nextIndex];
        setSelectedIndex(nextIndex);
        if (nextTemplate) {
            setAccent(nextTemplate.settings.colors.accent);
            setDensity("comfortable");
        }
    };

    if (!selectedTemplate || !demoResume) {
        return (
            <aside
                data-testid="landing-template-showcase"
                className="flex min-h-96 items-center justify-center border border-dashed border-edge bg-surface-1 p-8 text-center"
            >
                <div>
                    <LayoutTemplate className="mx-auto h-8 w-8 text-accent" aria-hidden="true" />
                    <h2 className="mt-4 text-lg font-semibold text-strong">
                        {t("templates.showcase.emptyTitle")}
                    </h2>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-mid">
                        {t("templates.showcase.emptyDescription")}
                    </p>
                </div>
            </aside>
        );
    }

    return (
        <aside
            data-testid="landing-template-showcase"
            data-selected="true"
            aria-hidden="false"
            className="min-w-0 overflow-hidden rounded-xl border border-edge-strong bg-surface-1 shadow-[0_20px_55px_rgba(0,0,0,0.2)]"
        >
            <p className="sr-only" aria-live="polite">
                {t("landing.workbench.previewLabel")}: {name}, {headline}, {selectedTemplate.meta.name}
            </p>
            <div className="flex min-h-14 items-center justify-between gap-4 border-b border-accent/20 bg-accent/[0.08] px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                    <MousePointerClick className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-strong">
                            {t("landing.workbench.tryTitle")}
                        </p>
                        <p className="truncate text-xs text-mid">
                            {t("landing.workbench.tryHint")}
                        </p>
                    </div>
                </div>
                <span className="hidden shrink-0 items-center gap-1.5 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.14em] text-success sm:inline-flex">
                    <CircleCheck className="h-3 w-3" aria-hidden="true" />
                    {t("landing.workbench.localStatus")}
                </span>
            </div>

            <div className="grid min-w-0 lg:grid-cols-[235px_minmax(0,1fr)]">
                <div className="border-b border-edge bg-surface-2 p-4 lg:border-b-0 lg:border-r">
                    <Tabs
                        data-tabs-root
                        value={tab}
                        onValueChange={(value) => setTab(value as DemoTab)}
                    >
                        <TabsList className="grid w-full grid-cols-2 rounded-lg bg-surface-1">
                            <TabsTrigger value="content" className="rounded-md">
                                <Type className="h-3.5 w-3.5" aria-hidden="true" />
                                {t("landing.workbench.contentTab")}
                            </TabsTrigger>
                            <TabsTrigger value="design" className="rounded-md">
                                <Palette className="h-3.5 w-3.5" aria-hidden="true" />
                                {t("landing.workbench.designTab")}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="content" className="mt-4 space-y-3">
                            <EditorInput
                                label={t("landing.workbench.nameLabel")}
                                value={name}
                                onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
                                data-testid="landing-demo-name"
                            />
                            <EditorInput
                                label={t("landing.workbench.headlineLabel")}
                                value={headline}
                                onChange={(event: ChangeEvent<HTMLInputElement>) => setHeadline(event.target.value)}
                                data-testid="landing-demo-headline"
                            />
                        </TabsContent>

                        <TabsContent value="design" className="mt-4 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[11px] font-medium uppercase tracking-wider text-faint">
                                    {t("landing.workbench.templateLabel")}
                                </label>
                                <Select
                                    value={selectedTemplate.id}
                                    onValueChange={(templateId) => {
                                        const index = templates.findIndex((template) => template.id === templateId);
                                        if (index >= 0) selectTemplate(index);
                                    }}
                                >
                                    <SelectTrigger className="h-10 w-full bg-surface-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.map((template) => (
                                            <SelectItem key={template.id} value={template.id}>
                                                {template.meta.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <fieldset className="space-y-2">
                                <legend className="text-[11px] font-medium uppercase tracking-wider text-faint">
                                    {t("landing.workbench.accentLabel")}
                                </legend>
                                <div className="flex flex-wrap gap-2">
                                    {ACCENTS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setAccent(color)}
                                            aria-label={`${t("landing.workbench.accentLabel")}: ${color}`}
                                            aria-pressed={accent.toLowerCase() === color.toLowerCase()}
                                            className="h-8 w-8 rounded-full border-2 border-surface-2 outline outline-1 outline-edge transition-transform hover:scale-110 aria-pressed:outline-2 aria-pressed:outline-strong"
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </fieldset>

                            <fieldset className="space-y-2">
                                <legend className="text-[11px] font-medium uppercase tracking-wider text-faint">
                                    {t("landing.workbench.densityLabel")}
                                </legend>
                                <div className="grid grid-cols-2 gap-2">
                                    {(["compact", "comfortable"] as const).map((value) => (
                                        <Button
                                            key={value}
                                            type="button"
                                            size="sm"
                                            variant={density === value ? "secondary" : "ghost"}
                                            aria-pressed={density === value}
                                            onClick={() => setDensity(value)}
                                            className="w-full"
                                        >
                                            {t(`landing.workbench.density${value === "compact" ? "Compact" : "Comfortable"}`)}
                                        </Button>
                                    ))}
                                </div>
                            </fieldset>
                        </TabsContent>
                    </Tabs>

                    <div className="mt-5 border-t border-edge pt-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <span
                                data-testid="landing-template-counter"
                                className="font-[family-name:var(--font-geist-mono)] text-[11px] text-mid"
                            >
                                {t("templates.showcase.counter", counterParams)}
                            </span>
                            <div className="flex gap-1">
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    data-testid="landing-template-previous"
                                    aria-label={t("templates.showcase.previous")}
                                    onClick={() => selectTemplate(getPreviousTemplateIndex(selectedIndex, total))}
                                    className="h-8 w-8"
                                >
                                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                                </Button>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    data-testid="landing-template-next"
                                    aria-label={t("templates.showcase.next")}
                                    onClick={() => selectTemplate(getNextTemplateIndex(selectedIndex, total))}
                                    className="h-8 w-8"
                                >
                                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                </Button>
                            </div>
                        </div>
                        <Button
                            type="button"
                            data-testid="landing-template-use-button"
                            disabled={templateAction.pendingTemplateId !== null}
                            onClick={() => void templateAction.useTemplate(selectedTemplate.id)}
                            aria-label={t("templates.use.named", { name: selectedTemplate.meta.name })}
                            className="w-full"
                        >
                            {templateAction.pendingTemplateId === selectedTemplate.id
                                ? t("templates.use.creating")
                                : t("landing.workbench.useTemplate")}
                        </Button>
                    </div>
                </div>

                <div className="relative min-w-0 bg-surface-3">
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-4 pt-3 text-[10px]">
                        <span className="font-[family-name:var(--font-geist-mono)] uppercase tracking-[0.14em] text-faint">
                            {t("landing.workbench.previewLabel")}
                        </span>
                        <span className="truncate text-dim">{selectedTemplate.meta.name}</span>
                    </div>
                    <div
                        data-testid="landing-template-preview"
                        data-template-id={selectedTemplate.id}
                        data-template-theme={selectedTemplate.settings.theme}
                        data-template-accent={selectedTemplate.settings.colors.accent}
                        className="relative h-[400px] min-w-0 overflow-hidden bg-surface-3 sm:h-[490px] lg:h-[550px]"
                    >
                        <div className="absolute left-1/2 top-8 h-[1123px] w-[794px] origin-top -translate-x-1/2 scale-[0.32] sm:scale-[0.4] lg:scale-[0.46]">
                            <ResumePreview
                                resumeOverride={demoResume}
                                paperSizeOverride={selectedTemplate.paperSize}
                                thumbnailMode
                            />
                        </div>
                    </div>
                </div>
            </div>

            {templateAction.error && (
                <div
                    role="alert"
                    data-testid="landing-template-use-error"
                    className="flex items-start justify-between gap-3 border-t border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-danger-soft"
                >
                    <span>{templateAction.error}</span>
                    <button
                        type="button"
                        onClick={templateAction.clearError}
                        className="shrink-0 text-xs font-semibold underline underline-offset-2"
                    >
                        {t("templates.use.dismissError")}
                    </button>
                </div>
            )}
        </aside>
    );
}
