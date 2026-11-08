"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Loader2, Lock, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { useResumeStore } from "@/lib/store";
import { db } from "@/lib/db";
import { ResumePreview } from "@/components/editor/ResumePreview";
import { CustomizeSidebar } from "@/components/editor/CustomizeSidebar";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useTranslation } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
    const { t, locale } = useTranslation();
    const unwrappedParams = use(params);
    const { id } = unwrappedParams;
    const router = useRouter();

    const documentMode = useResumeStore((s) => s.documentMode);
    const activeTemplateId = useResumeStore((s) => s.activeTemplateId);
    const templateMeta = useResumeStore((s) => s.templateMeta);
    const isTemplateReadOnly = useResumeStore((s) => s.isTemplateReadOnly);
    const isSaving = useResumeStore((s) => s.isSaving);
    const isDirty = useResumeStore((s) => s.isDirty);
    const lastSavedAt = useResumeStore((s) => s.lastSavedAt);
    const paperSize = useResumeStore((s) => s.paperSize);
    const loadTemplateFromDb = useResumeStore((s) => s.loadTemplateFromDb);
    const saveTemplateToDb = useResumeStore((s) => s.saveTemplateToDb);
    const setTemplateMeta = useResumeStore((s) => s.setTemplateMeta);
    const clearTemplateMode = useResumeStore((s) => s.clearTemplateMode);

    const [isLoaded, setIsLoaded] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [isMobileLayout, setIsMobileLayout] = useState(false);
    const [mobilePane, setMobilePane] = useState<"customize" | "preview">("customize");
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const template = await loadTemplateFromDb(id);
            if (cancelled) return;
            if (!template) {
                setNotFound(true);
            }
            setIsLoaded(true);
        })();
        return () => {
            cancelled = true;
        };
    }, [id, loadTemplateFromDb]);

    useEffect(() => {
        return () => {
            // Restore resume mode when leaving the route.
            clearTemplateMode();
        };
    }, [clearTemplateMode]);

    useEffect(() => {
        if (!isLoaded || isTemplateReadOnly) return;
        if (!isDirty || !activeTemplateId) return;
        const timeout = setTimeout(() => {
            saveTemplateToDb();
        }, 400);
        return () => clearTimeout(timeout);
    }, [isLoaded, isDirty, activeTemplateId, isTemplateReadOnly, saveTemplateToDb]);

    useEffect(() => {
        const update = () => {
            setIsMobileLayout(window.innerWidth < 1024);
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-surface-2 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-strong animate-spin" />
            </div>
        );
    }

    if (notFound || documentMode !== "template" || !templateMeta) {
        return (
            <div className="min-h-screen bg-surface-2 flex flex-col items-center justify-center text-strong gap-3">
                <p className="text-sm text-bright">{t("templateEditor.notFound")}</p>
                <Link
                    href="/dashboard"
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-surface-2 hover:bg-accent-soft transition-colors"
                >
                    {t("palette.backToDashboard")}
                </Link>
            </div>
        );
    }

    const handleDelete = async () => {
        if (!activeTemplateId || isTemplateReadOnly) return;
        if (!confirm(t("templateEditor.deleteConfirm"))) return;
        await db.templates.delete(activeTemplateId);
        clearTemplateMode();
        router.push("/dashboard");
    };

    return (
        <div className="flex h-[100dvh] min-h-screen min-h-[100dvh] flex-col overflow-hidden bg-surface-2 font-sans text-strong">
            <header className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-y-2 px-4 pt-4 pb-2 sm:px-8">
                <div className="flex items-center space-x-4">
                    <Link
                        href="/dashboard"
                        className="p-2 -ml-2 rounded-full text-faint hover:text-strong hover:bg-edge transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="h-6 w-[2px] bg-edge rounded-full" />
                    <div className="flex flex-col">
                        <input
                            type="text"
                            value={templateMeta.name}
                            placeholder={t("dashboard.untitledTemplate")}
                            disabled={isTemplateReadOnly}
                            onChange={(e) => setTemplateMeta({ name: e.target.value })}
                            className="text-sm font-medium text-strong/90 bg-transparent border-none outline-none placeholder:text-strong/50 w-56 truncate p-0 focus:ring-0 disabled:cursor-not-allowed"
                        />
                        {isTemplateReadOnly ? (
                            <span className="text-[11px] text-info flex items-center gap-1">
                                <Lock className="w-3 h-3" /> {t("templateEditor.readOnly")}
                            </span>
                        ) : isSaving ? (
                            <span className="text-[11px] text-info flex items-center">
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" /> {t("dashboard.saving")}
                            </span>
                        ) : isDirty ? (
                            <span className="text-[11px] text-accent">{t("dashboard.unsaved")}</span>
                        ) : lastSavedAt ? (
                            <span className="text-[11px] text-faint">
                                {t("dashboard.savedAt", { time: new Date(lastSavedAt).toLocaleTimeString(locale, {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                }) })}
                            </span>
                        ) : (
                            <span className="text-[11px] text-faint">{t("templateEditor.title")}</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center space-x-2 sm:space-x-3">
                    <ThemeToggle />
                    <LanguageSwitcher compact />
                    {!isTemplateReadOnly && (
                        <button
                            type="button"
                            onClick={() => saveTemplateToDb()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-accent text-surface-2 hover:bg-accent-soft transition-colors"
                        >
                            <Save className="w-4 h-4" /> {t("editor.save")}
                        </button>
                    )}
                    {!isTemplateReadOnly && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-edge text-bright hover:text-danger hover:border-danger/60 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" /> {t("editor.delete")}
                        </button>
                    )}
                </div>
            </header>

            <div className="px-4 pb-2 sm:px-8">
                <input
                    type="text"
                    value={templateMeta.description}
                    placeholder={t("templateEditor.description")}
                    disabled={isTemplateReadOnly}
                    onChange={(e) => setTemplateMeta({ description: e.target.value })}
                    className="w-full max-w-2xl text-xs text-bright bg-transparent border border-edge rounded-lg px-3 py-2 placeholder:text-faint focus:outline-none focus:border-faint disabled:cursor-not-allowed"
                />
            </div>

            <div className="relative flex-1 overflow-hidden p-3 sm:p-6 sm:pt-2">
                {isMobileLayout ? (
                    <div className="flex h-full flex-col gap-3">
                        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-edge bg-surface-4 p-1">
                            <button
                                type="button"
                                onClick={() => setMobilePane("customize")}
                                className={`flex items-center justify-center gap-2 rounded-xl py-2 text-sm transition-colors ${mobilePane === "customize" ? "bg-edge text-strong" : "text-faint hover:text-strong"}`}
                            >
                                <SlidersHorizontal className="h-4 w-4" />
                                {t("editor.customizeTab")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMobilePane("preview")}
                                className={`flex items-center justify-center gap-2 rounded-xl py-2 text-sm transition-colors ${mobilePane === "preview" ? "bg-edge text-strong" : "text-faint hover:text-strong"}`}
                            >
                                <FileText className="h-4 w-4" />
                                {t("editor.preview")}
                            </button>
                        </div>

                        <div className="min-h-0 flex-1">
                            {mobilePane === "customize" ? (
                                <CustomizeSidebar />
                            ) : (
                                <div className="relative h-full w-full rounded-[1rem] border border-edge bg-surface-4 sm:rounded-[1.25rem]">
                                    <div className="absolute inset-0 overflow-hidden rounded-[1rem] sm:rounded-[1.25rem]">
                                        <ResumePreview paperSizeOverride={paperSize} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <Group orientation="horizontal">
                        <Panel defaultSize={35} minSize={25} className="z-10 flex flex-col">
                            <CustomizeSidebar />
                        </Panel>

                        <Separator className="group flex w-6 cursor-col-resize items-center justify-center bg-transparent transition-colors">
                            <div className="h-12 w-1.5 rounded-full bg-edge transition-colors group-hover:bg-faint" />
                        </Separator>

                        <Panel defaultSize={65} minSize={40} className="flex h-full justify-center">
                            <div className="relative h-full w-full flex-1 rounded-[1.25rem] border border-edge bg-surface-4">
                                <div className="absolute inset-0 overflow-hidden rounded-[1.25rem]">
                                    <ResumePreview paperSizeOverride={paperSize} />
                                </div>
                            </div>
                        </Panel>
                    </Group>
                )}
            </div>
        </div>
    );
}
