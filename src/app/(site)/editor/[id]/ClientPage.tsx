"use client";

import { useEffect, useMemo, useRef, useState, use, useCallback, useSyncExternalStore, type ChangeEvent, type ReactNode } from "react";
import { getJsonSession, getEmptyJsonSession, subscribeJsonSession, requestJsonEditorLeave } from "@/lib/editor-json-session";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useLiveQuery } from "dexie-react-hooks";
import { useResumeStore } from "@/lib/store";
import { db } from "@/lib/db";
import { createId } from "@/lib/id";
import { getRelativeHistorySelection, loadResumeHistory, parseHistoryResume, recordResumeHistory } from "@/lib/history";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { JsonEditorHost } from "@/components/editor/JsonEditorLoader";
import { ResumePreview } from "@/components/editor/ResumePreview";
import { EXPORT_FORMAT_ICONS, ExportDialog, ExportMenu } from "@/components/editor/ExportMenu";
import { ExportSupportCard } from "@/components/editor/ExportSupportCard";
import { EXPORT_FORMATS } from "@/lib/export-formats";
import { downloadBlob, hasPreviewPages, waitForPreviewPages } from "@/lib/export";
import { getExportFormat } from "@/lib/export-formats";
import { copyResumeToClipboard } from "@/lib/export-clipboard";
import { toDocumentModel } from "@/lib/document-model";
import { HistoryPanel } from "@/components/editor/HistoryPanel";
import { SaveAsTemplateDialog } from "@/components/editor/SaveAsTemplateDialog";
const ShortcutsOverlay = dynamic(() => import("@/components/editor/ShortcutsOverlay").then(module => module.ShortcutsOverlay), { ssr: false });
import { CommandPalette, type CommandAction } from "@/components/editor/CommandPalette";
import {
    findCommandAction,
    flattenCommandActions,
} from "@/components/editor/command-actions";
import {
    loadCommandPreferences,
    recordRecentCommand,
    saveCommandPreferences,
    togglePinnedCommand,
} from "@/components/editor/command-preferences";
import {
    CUSTOMIZE_GROUP_BY_ID,
    CUSTOMIZE_SECTIONS,
} from "@/components/editor/customize-section-registry";
import {
    CONTENT_SECTION_BY_ID,
    CONTENT_SECTIONS,
    contentSectionBaseId,
    getContentSectionDefinition,
    isContentSectionAvailable,
} from "@/components/editor/content-section-registry";
import { getContentEntryTargets } from "@/components/editor/content-entry-targets";
import { getBuiltinTemplates } from "@/lib/templates/enginecv-templates";
import { createResumeFromTemplate } from "@/lib/templates/use-template";
import { duplicateResume } from "@/lib/resume-operations";
import { runResumeExport, type ResumeExportFormat } from "@/lib/resume-export";
import { CV_LANGUAGE_OPTIONS } from "@/lib/cv-language";
import { PRESET_FONTS } from "@/lib/fonts";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import {
    DEFAULT_CLIENT_PREFERENCES,
    type ClientPreferences,
} from "@/lib/preferences/schema";
import {
    parseImportedClientPreferences,
    serializeClientPreferences,
} from "@/lib/preferences/storage";
import {
    duplicateContentEntry,
    getContentEntry,
    removeContentEntry,
    removeContentSection,
    toggleContentEntryHidden,
    toggleContentSectionHidden,
} from "@/lib/content-operations";
import { ArrowLeft, Loader2, Bug, Eye, EyeOff, FileText, FileJson, SlidersHorizontal, Menu, X, History, Copy, BookmarkPlus, Save, RefreshCw, Download, Upload, Languages, Pencil, Keyboard, Search, Sun, Moon, Monitor, Maximize2, Columns3, PanelLeftClose, PanelLeftOpen, Plus, FolderOpen, LayoutTemplate, Clock3, ListTree, FilePlus2, CopyPlus, Paintbrush, Trash2, BringToFront, SendToBack, Pin, Undo2, Redo2, RotateCcw, ZoomIn, ZoomOut, Type, ShieldCheck, Radiation } from "lucide-react";
import { Group, Panel, Separator, type GroupImperativeHandle } from "react-resizable-panels";
import Link from "next/link";
import { localeLabels, useTranslation, type Locale } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTheme, type ThemePreference } from "@/lib/theme";
import { Kbd } from "@/components/ui/kbd";
const FeedbackDialog = dynamic(() => import("@/components/feedback/FeedbackDialog").then(module => module.FeedbackDialog), { ssr: false });
import { ConfirmModal } from "@/components/ui/ConfirmModal";

function getHistoryTimestamp() {
    return Date.now();
}

function isMac() {
    return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform ?? "");
}

function getSaveShortcut() {
    return isMac() ? "⌘S" : "Ctrl+S";
}

function getPaletteShortcut() {
    return isMac() ? "⌘K" : "Ctrl+K";
}

/** Flat, borderless header affordance — matches ThemeToggle and the language switcher. */
function headerIconButton(active: boolean) {
    return `flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-edge hover:text-strong ${
        active ? "bg-edge text-accent" : "text-faint"
    }`;
}

/** Stable ids so the group's imperative `setLayout` can address each panel. */
const PANEL_ID = {
    sidebar: "editor-sidebar",
    preview: "editor-preview",
    right: "editor-right",
} as const;

/**
 * Relative widths per preset. They are weights, not percentages: whichever
 * panels are actually mounted get normalised to 100 between them, so a preset
 * still means the same thing with the right-hand panel closed.
 */
const PANEL_LAYOUTS = {
    balanced: { sidebar: 30, preview: 45, right: 25 },
    preview: { sidebar: 20, preview: 60, right: 20 },
    editor: { sidebar: 45, preview: 35, right: 20 },
} as const;

type PanelLayoutPreset = keyof typeof PANEL_LAYOUTS;

function isEditableShortcutTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    if (target.isContentEditable) {
        return true;
    }

    const editableAncestor = target.closest("input, textarea, select, [contenteditable='true']");
    return editableAncestor !== null;
}

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = use(params);
    const { id } = unwrappedParams;
    const router = useRouter();

    const loadFromDb = useResumeStore((state) => state.loadFromDb);
    const saveToDb = useResumeStore((state) => state.saveToDb);
    const isSaving = useResumeStore((state) => state.isSaving);
    const isDirty = useResumeStore((state) => state.isDirty);
    const lastSavedAt = useResumeStore((state) => state.lastSavedAt);
    const activeResumeId = useResumeStore((state) => state.activeResumeId);
    const resume = useResumeStore((state) => state.resume);
    const selectedContentTarget = useResumeStore((state) => state.selectedContentTarget);
    const applyContentTransform = useResumeStore((state) => state.applyContentTransform);
    const selectedDesignElementId = useResumeStore((state) => state.selectedDesignElementId);
    const removeDesignElement = useResumeStore((state) => state.removeDesignElement);
    const duplicateDesignElement = useResumeStore((state) => state.duplicateDesignElement);
    const moveDesignElementLayer = useResumeStore((state) => state.moveDesignElementLayer);
    const updateMeta = useResumeStore((state) => state.updateMeta);
    const paperSize = useResumeStore((state) => state.paperSize);
    const updatePaperSize = useResumeStore((state) => state.updatePaperSize);
    const updateSettings = useResumeStore((state) => state.updateSettings);
    const saveResumeAsTemplate = useResumeStore((state) => state.saveResumeAsTemplate);
    const autoSaveEnabled = useResumeStore((state) => state.autoSaveEnabled);
    const setAutoSaveEnabled = useResumeStore((state) => state.setAutoSaveEnabled);
    const sidebarTab = useResumeStore((state) => state.sidebarTab);
    const jsonSession = useSyncExternalStore(subscribeJsonSession, getJsonSession, getEmptyJsonSession);
    const setSidebarTab = useResumeStore((state) => state.setSidebarTab);
    const requestContentSection = useResumeStore((state) => state.requestContentSection);
    const requestCustomizePanel = useResumeStore((state) => state.requestCustomizePanel);
    const requestPreviewCommand = useResumeStore((state) => state.requestPreviewCommand);
    const createNewResume = useResumeStore((state) => state.createNew);
    const applyTemplateById = useResumeStore((state) => state.applyTemplateById);

    const [isSaveAsTemplateOpen, setIsSaveAsTemplateOpen] = useState(false);
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [showHistoryPanel, setShowHistoryPanel] = useState(false);
    const [isMobileLayout, setIsMobileLayout] = useState(false);
    const [mobilePane, setMobilePane] = useState<"content" | "preview" | "history">("content");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [pendingCommandConfirmation, setPendingCommandConfirmation] = useState<{
        title: string;
        description: string;
        confirmLabel: string;
        destructive?: boolean;
        run: () => void;
    } | null>(null);
    
    const panelGroupRef = useRef<GroupImperativeHandle | null>(null);
    const preferencesFileInputRef = useRef<HTMLInputElement | null>(null);
    const { t, locale, setLocale } = useTranslation();
    const { preference: themePreference, setPreference: setThemePreference } = useTheme();
    const clientPreferences = useClientPreferencesStore((state) => state.preferences);
    const updateClientPreferenceSection = useClientPreferencesStore(
        (state) => state.updateSection,
    );
    const replaceClientPreferences = useClientPreferencesStore(
        (state) => state.replacePreferences,
    );
    const commandPreferences = useMemo(() => ({
        recentIds: clientPreferences.commandPalette.recentCommandIds,
        pinnedIds: clientPreferences.commandPalette.pinnedCommandIds,
    }), [
        clientPreferences.commandPalette.pinnedCommandIds,
        clientPreferences.commandPalette.recentCommandIds,
    ]);

    const historyEntriesResult = useLiveQuery(
        async () => activeResumeId ? loadResumeHistory(activeResumeId) : [],
        [activeResumeId]
    );
    const recentResumesResult = useLiveQuery(
        async () => db.resumes.orderBy("updatedAt").reverse().limit(12).toArray(),
        [],
    );
    const userTemplatesResult = useLiveQuery(
        async () => db.templates.orderBy("updatedAt").reverse().toArray(),
        [],
    );
    const builtinTemplates = useMemo(() => getBuiltinTemplates(), []);
    const historyEntries = useMemo(() => historyEntriesResult ?? [], [historyEntriesResult]);
    const recentResumes = useMemo(() => recentResumesResult ?? [], [recentResumesResult]);
    const userTemplates = useMemo(() => userTemplatesResult ?? [], [userTemplatesResult]);
    const historyEntryIds = useMemo(
        () => historyEntries
            .map((entry) => entry.id)
            .filter((entryId): entryId is number => typeof entryId === "number"),
        [historyEntries],
    );
    const selectedHistoryEntry = selectedHistoryId === null
        ? null
        : historyEntries.find((entry) => entry.id === selectedHistoryId) ?? null;
    const previewResume = useMemo(
        () => selectedHistoryEntry ? parseHistoryResume(selectedHistoryEntry) : null,
        [selectedHistoryEntry],
    );
    const canActOnSelectedHistory = !!selectedHistoryEntry && !!previewResume;

    const selectRelativeHistory = useCallback((direction: "back" | "forward") => {
        const nextSelectedHistoryId = getRelativeHistorySelection(
            historyEntryIds,
            selectedHistoryId,
            direction,
        );
        if (nextSelectedHistoryId === selectedHistoryId) return;
        setSelectedHistoryId(nextSelectedHistoryId);
        if (isMobileLayout) setMobilePane("preview");
    }, [historyEntryIds, isMobileLayout, selectedHistoryId]);

    const closeHistoryPreview = useCallback(() => {
        setSelectedHistoryId(null);
    }, []);

    const handleRestoreHistory = useCallback(async () => {
        if (!previewResume || !activeResumeId) return;

        const restoredResume = {
            ...previewResume,
            id: activeResumeId,
            createdAt: resume.createdAt,
            updatedAt: getHistoryTimestamp(),
        };
        useResumeStore.setState({
            resume: restoredResume,
            isDirty: true,
            selectedDesignElementId: null,
            activeDesignPage: 0,
            previewPageCount: 1,
        });
        await useResumeStore.getState().saveToDb("restore");
        setSelectedHistoryId(null);
        setMobilePane("preview");
    }, [activeResumeId, previewResume, resume.createdAt]);

    const handleDuplicateHistory = useCallback(async () => {
        if (!previewResume) return;

        const duplicatedResume = structuredClone(previewResume);
        const duplicateId = createId();
        const now = getHistoryTimestamp();
        duplicatedResume.id = duplicateId;
        duplicatedResume.createdAt = now;
        duplicatedResume.updatedAt = now;

        await db.resumes.add(duplicatedResume);
        await recordResumeHistory(duplicatedResume, "duplicate");
        setSelectedHistoryId(null);
        router.push(`/editor/${duplicateId}`);
    }, [previewResume, router]);

    useEffect(() => {
        if (id) {
            loadFromDb(id as string).then(() => {
                const preferencesStore = useClientPreferencesStore.getState();
                if (!preferencesStore.hydrated) preferencesStore.hydrate();
                const editorPreferences =
                    useClientPreferencesStore.getState().preferences.editor;
                setShowHistoryPanel(editorPreferences.rightPanelVisible);
                setAutoSaveEnabled(editorPreferences.autoSave);
                setIsLoaded(true);
            });
        }
    }, [id, loadFromDb, setAutoSaveEnabled]);

    useEffect(() => {
        if (isLoaded) {
            useClientPreferencesStore.getState().updateSection("editor", {
                autoSave: autoSaveEnabled,
                rightPanelVisible: showHistoryPanel,
            });
        }
    }, [autoSaveEnabled, isLoaded, showHistoryPanel]);

    useEffect(() => {
        const update = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobileLayout(mobile);
            if (!mobile) {
                setMobileMenuOpen(false);
            }
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    useEffect(() => {
        if (!isLoaded || !activeResumeId || !isDirty || !autoSaveEnabled) {
            return;
        }

        const timeoutId = setTimeout(() => {
            saveToDb();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [saveToDb, isLoaded, activeResumeId, isDirty, autoSaveEnabled]);

    useEffect(() => {
        const flush = () => {
            const { isDirty: dirty } = useResumeStore.getState();
            if (dirty) {
                void useResumeStore.getState().saveToDb();
            }
        };
        const handleVisibility = () => {
            if (document.visibilityState === "hidden") {
                flush();
            }
        };

        window.addEventListener("beforeunload", flush);
        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            window.removeEventListener("beforeunload", flush);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, []);

    useEffect(() => {
        const handleHistoryNavigation = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey) {
                return;
            }

            if (isEditableShortcutTarget(event.target)) {
                return;
            }

            const key = event.key.toLowerCase();
            const isUndoShortcut = key === "z" && !event.shiftKey;
            const isRedoShortcut = key === "y" || (key === "z" && event.shiftKey);
            if (!isUndoShortcut && !isRedoShortcut) {
                return;
            }

            event.preventDefault();
            selectRelativeHistory(isUndoShortcut ? "back" : "forward");
        };

        document.addEventListener("keydown", handleHistoryNavigation);
        return () => document.removeEventListener("keydown", handleHistoryNavigation);
    }, [selectRelativeHistory]);

    useEffect(() => {
        const handleDesignDeletion = (event: KeyboardEvent) => {
            if (selectedHistoryId !== null || isShortcutsOpen || isPaletteOpen) {
                return;
            }

            if (!selectedDesignElementId) {
                return;
            }

            if (event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }

            if (isEditableShortcutTarget(event.target)) {
                return;
            }

            if (event.key !== "Delete" && event.key !== "Backspace") {
                return;
            }

            event.preventDefault();
            removeDesignElement(selectedDesignElementId);
        };

        document.addEventListener("keydown", handleDesignDeletion);
        return () => document.removeEventListener("keydown", handleDesignDeletion);
    }, [isPaletteOpen, isShortcutsOpen, removeDesignElement, selectedDesignElementId, selectedHistoryId]);

    useEffect(() => {
        const handleFocusModeShortcut = (event: KeyboardEvent) => {
            if (isEditableShortcutTarget(event.target) || isShortcutsOpen || isPaletteOpen) return;

            if (event.key.toLowerCase() === "f" && !(event.ctrlKey || event.metaKey || event.altKey)) {
                event.preventDefault();
                setIsFocusMode((prev) => !prev);
            }
            
            if (event.key === "Escape" && isFocusMode) {
                event.preventDefault();
                setIsFocusMode(false);
            }
        };
        document.addEventListener("keydown", handleFocusModeShortcut);
        return () => document.removeEventListener("keydown", handleFocusModeShortcut);
    }, [isFocusMode, isPaletteOpen, isShortcutsOpen]);

    const handleManualSave = useCallback(async () => {
        const { isDirty: dirty, isSaving: saving } = useResumeStore.getState();
        if (dirty && !saving) {
            await useResumeStore.getState().saveToDb("manual");
        }
    }, []);

    const navigateAfterSave = useCallback(async (href: string) => {
        const state = useResumeStore.getState();
        if (state.isDirty && !state.isSaving) {
            await state.saveToDb("manual");
        }
        requestJsonEditorLeave(() => router.push(href));
    }, [router]);

    const handleCreateBlankResume = useCallback(async () => {
        requestJsonEditorLeave(async () => {
        await handleManualSave();
        const resumeId = await createNewResume();
        router.push(`/editor/${resumeId}`);
        });
    }, [createNewResume, handleManualSave, router]);

    const handleDuplicateCurrentResume = useCallback(async () => {
        requestJsonEditorLeave(async () => {
        await handleManualSave();
        const resumeId = await duplicateResume(
            useResumeStore.getState().resume,
            t("dashboard.copy"),
        );
        router.push(`/editor/${resumeId}`);
        });
    }, [handleManualSave, router, t]);

    const handleCreateFromTemplate = useCallback(async (templateId: string) => {
        requestJsonEditorLeave(async () => {
        await handleManualSave();
        const resumeId = await createResumeFromTemplate(templateId);
        router.push(`/editor/${resumeId}`);
        });
    }, [handleManualSave, router]);

    const showMobilePreview = useCallback(() => setMobilePane("preview"), []);

    const handleQuickExport = useCallback(async (format: ResumeExportFormat) => {
        try {
            // A phone renders the preview pages only while the preview pane is showing.
            if (getExportFormat(format).needsPreview && !hasPreviewPages()) {
                if (isMobileLayout) setMobilePane("preview");
                if (!(await waitForPreviewPages())) throw new Error("No preview pages to export");
            }
            await runResumeExport({
                resume: useResumeStore.getState().resume,
                paperSize: useResumeStore.getState().paperSize,
                format,
                messages: {
                    printDialogUnavailable: t("export.printDialogUnavailable"),
                    encryptionKeyRequired: t("export.encryptionKeyRequired"),
                },
            });
        } catch {
            setIsExportDialogOpen(true);
        }
    }, [isMobileLayout, t]);

    const handleCopyToClipboard = useCallback(async () => {
        const { resume } = useResumeStore.getState();
        try {
            await copyResumeToClipboard(toDocumentModel(resume), resume.settings.colors.accent);
        } catch {
            // The dialog's Text and Markdown tabs offer a copy retry.
            setIsExportDialogOpen(true);
        }
    }, []);

    const applyClientPreferences = useCallback((preferences: ClientPreferences) => {
        replaceClientPreferences(preferences);
        setAutoSaveEnabled(preferences.editor.autoSave);
        setShowHistoryPanel(preferences.editor.rightPanelVisible);
    }, [replaceClientPreferences, setAutoSaveEnabled]);

    const handleExportPreferences = useCallback(() => {
        const preferences = useClientPreferencesStore.getState().preferences;
        const blob = new Blob(
            [serializeClientPreferences(preferences)],
            { type: "application/json" },
        );
        downloadBlob(blob, "enginecv-preferences.json");
    }, []);

    const handlePreferencesFileChange = useCallback(async (
        event: ChangeEvent<HTMLInputElement>,
    ) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;

        try {
            if (file.size > 512 * 1024) throw new Error("Preference file is too large");
            const preferences = parseImportedClientPreferences(await file.text());
            setPendingCommandConfirmation({
                title: t("palette.preferencesImportTitle"),
                description: t("palette.preferencesImportDescription"),
                confirmLabel: t("palette.preferencesImportConfirm"),
                destructive: false,
                run: () => applyClientPreferences(preferences),
            });
        } catch {
            setPendingCommandConfirmation({
                title: t("palette.preferencesImportErrorTitle"),
                description: t("palette.preferencesImportErrorDescription"),
                confirmLabel: t("palette.preferencesClose"),
                destructive: false,
                run: () => {},
            });
        }
    }, [applyClientPreferences, t]);

    const handleResetPreferences = useCallback(() => {
        setPendingCommandConfirmation({
            title: t("palette.preferencesResetTitle"),
            description: t("palette.preferencesResetDescription"),
            confirmLabel: t("palette.preferencesResetConfirm"),
            run: () => applyClientPreferences(DEFAULT_CLIENT_PREFERENCES),
        });
    }, [applyClientPreferences, t]);

    const handleCommandRun = useCallback((action: CommandAction) => {
        if (action.id.startsWith("pin-command-")) return;
        const next = recordRecentCommand(loadCommandPreferences(), action.id);
        saveCommandPreferences(next);
    }, []);

    const handleToggleCommandPin = useCallback((commandId: string) => {
        const next = togglePinnedCommand(loadCommandPreferences(), commandId);
        saveCommandPreferences(next);
    }, []);

    /** Open the History panel, or close it when already showing. */
    const toggleHistoryPanel = useCallback(() => {
        if (showHistoryPanel) {
            setShowHistoryPanel(false);
            if (mobilePane === "history") setMobilePane("content");
            return;
        }
        setShowHistoryPanel(true);
    }, [mobilePane, showHistoryPanel]);

    const requestPanelLayout = useCallback((preset: PanelLayoutPreset) => {
        window.dispatchEvent(new CustomEvent("enginecv:panel-layout", { detail: preset }));
    }, []);

    useEffect(() => {
        const handlePanelLayout = (event: Event) => {
            const preset = (event as CustomEvent<PanelLayoutPreset>).detail;
            const group = panelGroupRef.current;
            if (!group || !(preset in PANEL_LAYOUTS)) return;

            const weights = PANEL_LAYOUTS[preset];
            const mounted: [string, number][] = [
                [PANEL_ID.sidebar, weights.sidebar],
                [PANEL_ID.preview, weights.preview],
            ];
            if (showHistoryPanel) mounted.push([PANEL_ID.right, weights.right]);

            const total = mounted.reduce((sum, [, weight]) => sum + weight, 0);
            group.setLayout(
                Object.fromEntries(
                    mounted.map(([panelId, weight]) => [panelId, (weight / total) * 100]),
                ),
            );
        };
        window.addEventListener("enginecv:panel-layout", handlePanelLayout);
        return () => window.removeEventListener("enginecv:panel-layout", handlePanelLayout);
    }, [showHistoryPanel]);

    /**
     * Drop the caret into the live preview on the first editable field, which is
     * where the arrow-key / hjkl field navigation takes over. Two frames so the
     * mobile pane switch has painted before we go looking for the field.
     */
    const goToPreviewFields = useCallback(() => {
        if (isMobileLayout) setMobilePane("preview");
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const field = document.querySelector<HTMLElement>(
                    ".resume-document [data-editable-field]",
                );
                if (!field) return;
                field.focus();
                field.scrollIntoView({ block: "center", behavior: "smooth" });
            });
        });
    }, [isMobileLayout]);

    // Everything the old File / View / Help menus offered, plus the actions that
    // only had keyboard bindings. Keywords are deliberately English aliases so
    // power users can search for "pdf" or "dark" in any interface language.
    const baseCommandActions = useMemo<CommandAction[]>(() => {
        const configuredSectionKeys = resume.settings?.contentSections || [];
        const openContent = (section: string, mode: "open" | "add") => {
            requestContentSection(section, mode);
            if (isMobileLayout) setMobilePane("content");
        };
        const configuredContentActions: CommandAction[] = [
            {
                id: "content-basics",
                group: t("palette.group.onResume"),
                label: t(CONTENT_SECTION_BY_ID.basics.labelKey),
                icon: CONTENT_SECTION_BY_ID.basics.icon,
                keywords: [...CONTENT_SECTION_BY_ID.basics.keywords],
                run: () => openContent("basics", "open"),
            },
            ...configuredSectionKeys.flatMap((sectionKey) => {
                const base = contentSectionBaseId(sectionKey);
                const definition = getContentSectionDefinition(base);
                if (!definition) return [];
                const customTitle = base === "custom"
                    ? resume.customSections.find((section) => `custom:${section.id}` === sectionKey)?.title?.trim()
                    : "";
                return [{
                    id: `content-${sectionKey}`,
                    group: t("palette.group.onResume"),
                    label: customTitle || t(definition.labelKey),
                    icon: definition.icon,
                    keywords: [sectionKey, ...definition.keywords],
                    run: () => openContent(sectionKey, "open"),
                }];
            }),
        ];
        const availableContentActions: CommandAction[] = CONTENT_SECTIONS
            .filter((section) => isContentSectionAvailable(configuredSectionKeys, section))
            .map((section) => ({
                id: `content-add-${section.id}`,
                group: t("palette.group.available"),
                label: t("palette.addContentSection", { section: t(section.labelKey) }),
                icon: section.icon,
                keywords: [section.id, ...section.keywords],
                status: t("palette.notAdded"),
                trailingIcon: Plus,
                run: () => openContent(section.id, "add"),
            }));
        const contentEntryActions: CommandAction[] = getContentEntryTargets(resume, t)
            .map((target) => ({
                id: `jump-entry-${target.id}`,
                group: t("palette.group.entries"),
                label: target.label,
                icon: getContentSectionDefinition(target.sectionKey)?.icon ?? FileText,
                status: target.hidden ? t("editor.hidden") : target.description,
                keywords: target.keywords,
                run: () => {
                    requestContentSection(target.sectionKey, "open", target.entryIndex);
                    if (isMobileLayout) setMobilePane("content");
                },
            }));
        const historyVersionActions: CommandAction[] = historyEntries
            .filter((entry) => typeof entry.id === "number")
            .map((entry) => ({
                id: `quick-history-${entry.id}`,
                group: t("history.title"),
                label: new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                }).format(new Date(entry.createdAt)),
                icon: Clock3,
                checked: entry.id === selectedHistoryId,
                status: entry.trigger,
                keywords: [entry.trigger, String(entry.createdAt)],
                run: () => {
                    setSelectedHistoryId(entry.id ?? null);
                    if (isMobileLayout) setMobilePane("preview");
                },
            }));
        const quickOpenActions: CommandAction[] = [
            ...recentResumes.map((item) => ({
                id: `quick-resume-${item.id}`,
                group: t("palette.group.recentResumes"),
                label: item.meta?.title || item.basics?.name || t("dashboard.untitled"),
                icon: FileText,
                checked: item.id === activeResumeId,
                keywords: [item.id, item.basics?.name, item.basics?.headline]
                    .filter((value): value is string => Boolean(value)),
                run: () => void navigateAfterSave(`/editor/${item.id}`),
            })),
            ...builtinTemplates.map((template) => ({
                id: `quick-template-${template.id}`,
                group: t("palette.group.templates"),
                label: template.meta.name,
                icon: LayoutTemplate,
                keywords: [template.id, template.meta.description, ...template.meta.tags],
                run: () => void navigateAfterSave(`/templates/${template.id}`),
            })),
            ...userTemplates.map((template) => ({
                id: `quick-template-user-${template.id}`,
                group: t("palette.group.templates"),
                label: template.meta.name,
                icon: LayoutTemplate,
                keywords: [template.id, template.meta.description, ...template.meta.tags],
                run: () => void navigateAfterSave(`/templates/${template.id}`),
            })),
            ...historyVersionActions,
        ];
        const allTemplates = [...builtinTemplates, ...userTemplates];
        const createActions: CommandAction[] = [
            {
                id: "create-blank-resume",
                group: t("palette.group.create"),
                label: t("palette.createBlankResume"),
                icon: FilePlus2,
                keywords: ["new", "blank", "resume", "cv", "create"],
                run: () => void handleCreateBlankResume(),
            },
            {
                id: "duplicate-current-resume",
                group: t("palette.group.create"),
                label: t("palette.duplicateCurrentResume"),
                icon: CopyPlus,
                keywords: ["copy", "duplicate", "clone", "resume"],
                run: () => void handleDuplicateCurrentResume(),
            },
            {
                id: "save-as-template",
                group: t("palette.group.create"),
                label: t("editor.saveAsTemplate"),
                icon: BookmarkPlus,
                keywords: ["template", "preset", "reuse", "save"],
                run: () => setIsSaveAsTemplateOpen(true),
            },
            ...allTemplates.map((template) => ({
                id: `create-from-template-${template.id}`,
                group: t("palette.group.createFromTemplate"),
                label: template.meta.name,
                icon: LayoutTemplate,
                status: t("palette.createNew"),
                keywords: [template.id, template.meta.description, ...template.meta.tags],
                run: () => void handleCreateFromTemplate(template.id),
            })),
            ...allTemplates.map((template) => ({
                id: `apply-template-${template.id}`,
                group: t("palette.group.applyTemplate"),
                label: template.meta.name,
                icon: Paintbrush,
                status: t("palette.applyCurrent"),
                keywords: [template.id, template.meta.description, ...template.meta.tags],
                run: () => void applyTemplateById(template.id),
            })),
        ];
        const exportActions: CommandAction[] = EXPORT_FORMATS.map((format) => ({
            id: `export-${format.id}`,
            group: t("palette.group.exportFormat"),
            label: t("export.exportFormat", { format: t(format.labelKey) }),
            icon: EXPORT_FORMAT_ICONS[format.id],
            keywords: ["export", "download", format.id, format.extension],
            run: () => void handleQuickExport(format.id),
        }));
        exportActions.push({
            id: "export-copy",
            group: t("palette.group.exportFormat"),
            label: t("export.copy"),
            icon: Copy,
            keywords: ["export", "copy", "clipboard", "paste"],
            run: () => void handleCopyToClipboard(),
        });
        exportActions.push({
            id: "export-options",
            group: t("palette.group.exportOptions"),
            label: t("palette.exportOptions"),
            icon: SlidersHorizontal,
            keywords: ["export", "options", "encrypt", "sidecar"],
            run: () => setIsExportDialogOpen(true),
        });
        const previousHistoryId = getRelativeHistorySelection(
            historyEntryIds,
            selectedHistoryId,
            "back",
        );
        const nextHistoryId = getRelativeHistorySelection(
            historyEntryIds,
            selectedHistoryId,
            "forward",
        );
        const historyActions: CommandAction[] = [
            {
                id: "history-previous",
                group: t("palette.group.historyNavigation"),
                label: t("palette.previousVersion"),
                icon: Undo2,
                shortcut: isMac() ? "⌘Z" : "Ctrl+Z",
                disabled: previousHistoryId === selectedHistoryId,
                keywords: ["history", "previous", "older", "undo", "back"],
                run: () => selectRelativeHistory("back"),
            },
            {
                id: "history-next",
                group: t("palette.group.historyNavigation"),
                label: t("palette.nextVersion"),
                icon: Redo2,
                shortcut: isMac() ? "⇧⌘Z" : "Ctrl+Y",
                disabled: nextHistoryId === selectedHistoryId,
                keywords: ["history", "next", "newer", "redo", "forward"],
                run: () => selectRelativeHistory("forward"),
            },
            {
                id: "history-current",
                group: t("palette.group.historyNavigation"),
                label: t("history.currentDraft"),
                icon: RotateCcw,
                checked: selectedHistoryId === null,
                disabled: selectedHistoryId === null,
                keywords: ["history", "current", "live", "draft"],
                run: closeHistoryPreview,
            },
            {
                id: "history-restore-selected",
                group: t("palette.group.historySelected"),
                label: t("history.restoreSelected"),
                icon: RefreshCw,
                disabled: !canActOnSelectedHistory,
                keywords: ["history", "restore", "selected", "version"],
                run: () => void handleRestoreHistory(),
            },
            {
                id: "history-duplicate-selected",
                group: t("palette.group.historySelected"),
                label: t("history.duplicateAsNew"),
                icon: CopyPlus,
                disabled: !canActOnSelectedHistory,
                keywords: ["history", "duplicate", "copy", "selected", "version"],
                run: () => void handleDuplicateHistory(),
            },
            {
                id: "history-open-panel",
                group: t("palette.group.historySelected"),
                label: t("palette.openHistoryPanel"),
                icon: History,
                checked: showHistoryPanel,
                keywords: ["history", "panel", "versions"],
                run: toggleHistoryPanel,
            },
            ...historyVersionActions,
        ];
        const selectedContentDefinition = selectedContentTarget
            ? getContentSectionDefinition(contentSectionBaseId(selectedContentTarget.section))
            : null;
        const selectedCustomTitle = selectedContentTarget
            ? resume.customSections.find(
                (section) => `custom:${section.id}` === selectedContentTarget.section,
            )?.title?.trim()
            : "";
        const selectedSectionLabel = selectedContentDefinition
            ? selectedCustomTitle || t(selectedContentDefinition.labelKey)
            : "";
        const selectedEntry = selectedContentTarget?.entryIndex !== null
            && selectedContentTarget?.entryIndex !== undefined
            ? getContentEntry(
                resume,
                selectedContentTarget.section,
                selectedContentTarget.entryIndex,
            )
            : null;
        const selectedEntryTarget = selectedContentTarget?.entryIndex !== null
            && selectedContentTarget?.entryIndex !== undefined
            ? getContentEntryTargets(resume, t).find(
                (target) => target.sectionKey === selectedContentTarget.section
                    && target.entryIndex === selectedContentTarget.entryIndex,
            )
            : null;
        const contextActions: CommandAction[] = [];

        if (selectedContentTarget && selectedContentDefinition && selectedContentTarget.section !== "basics") {
            const sectionHidden = (resume.settings.hiddenSections ?? [])
                .includes(selectedContentTarget.section);
            contextActions.push(
                {
                    id: "context-toggle-section-visibility",
                    group: t("palette.group.selectedSection"),
                    label: sectionHidden
                        ? t("palette.showSection", { section: selectedSectionLabel })
                        : t("palette.hideSection", { section: selectedSectionLabel }),
                    icon: sectionHidden ? Eye : EyeOff,
                    checked: sectionHidden,
                    keywords: ["section", "show", "hide", "visibility"],
                    run: () => applyContentTransform(
                        (current) => toggleContentSectionHidden(
                            current,
                            selectedContentTarget.section,
                        ),
                    ),
                },
                {
                    id: "context-remove-section",
                    group: t("palette.group.selectedSection"),
                    label: t("palette.removeSection", { section: selectedSectionLabel }),
                    icon: Trash2,
                    keywords: ["section", "remove", "delete"],
                    run: () => setPendingCommandConfirmation({
                        title: t("palette.removeSectionTitle", { section: selectedSectionLabel }),
                        description: t("palette.removeSectionDescription"),
                        confirmLabel: t("palette.remove"),
                        run: () => {
                            applyContentTransform(
                                (current) => removeContentSection(
                                    current,
                                    selectedContentTarget.section,
                                ),
                            );
                            requestContentSection("basics", "open");
                        },
                    }),
                },
            );
        }

        if (
            selectedContentTarget
            && selectedContentTarget.entryIndex !== null
            && selectedEntry
        ) {
            const entryLabel = selectedEntryTarget?.label || selectedSectionLabel;
            contextActions.push(
                {
                    id: "context-duplicate-entry",
                    group: t("palette.group.selectedEntry"),
                    label: t("palette.duplicateEntry", { entry: entryLabel }),
                    icon: CopyPlus,
                    keywords: ["entry", "duplicate", "copy"],
                    run: () => {
                        applyContentTransform(
                            (current) => duplicateContentEntry(
                                current,
                                selectedContentTarget.section,
                                selectedContentTarget.entryIndex!,
                            ),
                        );
                        requestContentSection(
                            selectedContentTarget.section,
                            "open",
                            selectedContentTarget.entryIndex! + 1,
                        );
                    },
                },
                {
                    id: "context-toggle-entry-visibility",
                    group: t("palette.group.selectedEntry"),
                    label: selectedEntry.hidden
                        ? t("palette.showEntry", { entry: entryLabel })
                        : t("palette.hideEntry", { entry: entryLabel }),
                    icon: selectedEntry.hidden ? Eye : EyeOff,
                    checked: selectedEntry.hidden,
                    keywords: ["entry", "show", "hide", "visibility"],
                    run: () => applyContentTransform(
                        (current) => toggleContentEntryHidden(
                            current,
                            selectedContentTarget.section,
                            selectedContentTarget.entryIndex!,
                        ),
                    ),
                },
                {
                    id: "context-remove-entry",
                    group: t("palette.group.selectedEntry"),
                    label: t("palette.removeEntry", { entry: entryLabel }),
                    icon: Trash2,
                    keywords: ["entry", "remove", "delete"],
                    run: () => setPendingCommandConfirmation({
                        title: t("palette.removeEntryTitle", { entry: entryLabel }),
                        description: t("palette.removeEntryDescription"),
                        confirmLabel: t("palette.remove"),
                        run: () => {
                            applyContentTransform(
                                (current) => removeContentEntry(
                                    current,
                                    selectedContentTarget.section,
                                    selectedContentTarget.entryIndex!,
                                ),
                            );
                            requestContentSection(selectedContentTarget.section, "open");
                        },
                    }),
                },
            );
        }

        if (selectedDesignElementId) {
            contextActions.push(
                {
                    id: "context-duplicate-design",
                    group: t("palette.group.selectedDesign"),
                    label: t("palette.duplicateDesign"),
                    icon: CopyPlus,
                    keywords: ["design", "element", "duplicate", "copy"],
                    run: () => duplicateDesignElement(selectedDesignElementId),
                },
                {
                    id: "context-bring-design-front",
                    group: t("palette.group.selectedDesign"),
                    label: t("palette.bringToFront"),
                    icon: BringToFront,
                    keywords: ["design", "element", "layer", "front"],
                    run: () => moveDesignElementLayer(selectedDesignElementId, "front"),
                },
                {
                    id: "context-send-design-back",
                    group: t("palette.group.selectedDesign"),
                    label: t("palette.sendToBack"),
                    icon: SendToBack,
                    keywords: ["design", "element", "layer", "back"],
                    run: () => moveDesignElementLayer(selectedDesignElementId, "back"),
                },
                {
                    id: "context-remove-design",
                    group: t("palette.group.selectedDesign"),
                    label: t("palette.removeDesign"),
                    icon: Trash2,
                    keywords: ["design", "element", "remove", "delete"],
                    run: () => setPendingCommandConfirmation({
                        title: t("palette.removeDesignTitle"),
                        description: t("palette.removeDesignDescription"),
                        confirmLabel: t("palette.remove"),
                        run: () => removeDesignElement(selectedDesignElementId),
                    }),
                },
            );
        }
        const themeActions: CommandAction[] = (["light", "dark", "system"] as ThemePreference[])
            .map((value) => ({
                id: `theme-${value}`,
                group: t("palette.group.theme"),
                label: t(`theme.${value}`),
                icon: value === "light" ? Sun : value === "dark" ? Moon : Monitor,
                checked: themePreference === value,
                keywords: ["theme", "appearance", value],
                closeOnRun: false,
                run: () => setThemePreference(value),
            }));
        const languageActions: CommandAction[] = (Object.keys(localeLabels) as Locale[])
            .map((code) => ({
                id: `locale-${code}`,
                group: t("palette.group.language"),
                label: localeLabels[code],
                icon: Languages,
                checked: locale === code,
                keywords: ["language", "locale", code],
                closeOnRun: false,
                run: () => setLocale(code),
            }));
        const layoutActions: CommandAction[] = isMobileLayout || isFocusMode ? [] : [
            {
                id: "layout-balanced",
                group: t("palette.group.layout"),
                label: t("palette.layoutBalanced"),
                icon: Columns3,
                keywords: ["layout", "panels", "split", "reset", "even", "balanced"],
                run: () => requestPanelLayout("balanced"),
            },
            {
                id: "layout-preview",
                group: t("palette.group.layout"),
                label: t("palette.layoutPreview"),
                icon: PanelLeftClose,
                keywords: ["layout", "panels", "wider", "preview", "resume", "bigger"],
                run: () => requestPanelLayout("preview"),
            },
            {
                id: "layout-editor",
                group: t("palette.group.layout"),
                label: t("palette.layoutEditor"),
                icon: PanelLeftOpen,
                keywords: ["layout", "panels", "wider", "editor", "sidebar", "bigger"],
                run: () => requestPanelLayout("editor"),
            },
        ];
        const workspaceActions: CommandAction[] = [
            {
                id: "focus-mode",
                group: t("palette.group.workspacePanels"),
                label: t("shortcuts.focusMode"),
                icon: Maximize2,
                shortcut: "F",
                checked: isFocusMode,
                keywords: ["focus", "distraction", "zen", "fullscreen"],
                run: () => setIsFocusMode((enabled) => !enabled),
            },
            ...(!isMobileLayout && !isFocusMode ? [{
                id: "workspace-layout",
                group: t("palette.group.workspacePanels"),
                label: t("palette.layoutMenu"),
                icon: Columns3,
                keywords: ["layout", "panels", "workspace"],
                childrenPlaceholder: t("palette.layoutPlaceholder"),
                children: layoutActions,
            }] : []),
        ];
        const previewActions: CommandAction[] = [
            {
                id: "preview-zoom-in",
                group: t("palette.group.previewZoom"),
                label: t("preview.zoomIn"),
                icon: ZoomIn,
                keywords: ["preview", "zoom", "in", "larger"],
                run: () => {
                    requestPreviewCommand({ type: "zoomIn" });
                    if (isMobileLayout) setMobilePane("preview");
                },
            },
            {
                id: "preview-zoom-out",
                group: t("palette.group.previewZoom"),
                label: t("preview.zoomOut"),
                icon: ZoomOut,
                keywords: ["preview", "zoom", "out", "smaller"],
                run: () => {
                    requestPreviewCommand({ type: "zoomOut" });
                    if (isMobileLayout) setMobilePane("preview");
                },
            },
            {
                id: "preview-reset-view",
                group: t("palette.group.previewZoom"),
                label: t("preview.resetZoom"),
                icon: RotateCcw,
                keywords: ["preview", "zoom", "reset", "position"],
                run: () => {
                    requestPreviewCommand({ type: "resetView" });
                    if (isMobileLayout) setMobilePane("preview");
                },
            },
            {
                id: "preview-toggle-fullscreen",
                group: t("palette.group.previewDisplay"),
                label: t("preview.fullscreen"),
                icon: Maximize2,
                keywords: ["preview", "fullscreen", "expand"],
                run: () => {
                    requestPreviewCommand({ type: "toggleFullscreen" });
                    if (isMobileLayout) setMobilePane("preview");
                },
            },
        ];
        const setValueActions: CommandAction[] = [
            {
                id: "set-paper-size",
                group: t("palette.group.valueTarget"),
                label: t("palette.setPaperSize"),
                icon: FileText,
                keywords: ["set", "value", "paper", "page", "size", "a4", "letter"],
                childrenPlaceholder: t("palette.choosePaperSize"),
                children: (["a4", "letter"] as const).map((value) => ({
                    id: `set-paper-size-${value}`,
                    group: t("palette.group.valueOptions"),
                    label: value === "a4" ? "A4" : "Letter",
                    icon: FileText,
                    checked: paperSize === value,
                    keywords: ["paper", "page", "size", value],
                    run: () => updatePaperSize(value),
                })),
            },
            {
                id: "set-resume-language",
                group: t("palette.group.valueTarget"),
                label: t("palette.setResumeLanguage"),
                icon: Languages,
                keywords: ["set", "value", "resume", "cv", "language", "locale"],
                childrenPlaceholder: t("palette.chooseResumeLanguage"),
                children: CV_LANGUAGE_OPTIONS.map((option) => ({
                    id: `set-resume-language-${option.value}`,
                    group: t("palette.group.valueOptions"),
                    label: option.label,
                    icon: Languages,
                    checked: resume.settings.language === option.value,
                    keywords: ["resume", "cv", "language", option.value],
                    run: () => updateSettings({ language: option.value }),
                })),
            },
            {
                id: "set-body-font",
                group: t("palette.group.valueTarget"),
                label: t("palette.setBodyFont"),
                icon: Type,
                keywords: ["set", "value", "body", "font", "typography"],
                childrenPlaceholder: t("palette.chooseBodyFont"),
                children: PRESET_FONTS.map((font) => ({
                    id: `set-body-font-${font.toLowerCase().replace(/\s+/g, "-")}`,
                    group: t("palette.group.valueOptions"),
                    label: font,
                    icon: Type,
                    checked: resume.settings.typography.fontFamily === font,
                    keywords: ["body", "font", "typography", font],
                    run: () => updateSettings({
                        typography: {
                            ...resume.settings.typography,
                            fontFamily: font,
                        },
                    }),
                })),
            },
        ];
        const preferenceActions: CommandAction[] = [
            {
                id: "preferences-theme",
                group: t("palette.group.preferenceAppearance"),
                label: t("palette.themeMenu"),
                icon: themePreference === "light" ? Sun : themePreference === "dark" ? Moon : Monitor,
                keywords: ["theme", "appearance", "light", "dark", "system"],
                childrenPlaceholder: t("palette.themePlaceholder"),
                children: themeActions,
            },
            {
                id: "preferences-language",
                group: t("palette.group.preferenceAppearance"),
                label: t("palette.languageMenu"),
                icon: Languages,
                keywords: ["language", "locale"],
                childrenPlaceholder: t("palette.languagePlaceholder"),
                children: languageActions,
            },
            {
                id: "auto-save",
                group: t("palette.group.preferenceEditor"),
                label: t("editor.autoSave"),
                icon: RefreshCw,
                checked: autoSaveEnabled,
                status: t(autoSaveEnabled ? "palette.optionOn" : "palette.optionOff"),
                keywords: ["autosave", "automatic", "editor"],
                closeOnRun: false,
                run: () => setAutoSaveEnabled(!autoSaveEnabled),
            },
            {
                id: "preferences-right-panel-visible",
                group: t("palette.group.preferenceEditor"),
                label: t("palette.rightPanelVisible"),
                icon: Columns3,
                checked: showHistoryPanel,
                status: t(showHistoryPanel ? "palette.optionOn" : "palette.optionOff"),
                keywords: ["right", "panel", "sidebar", "visible", "history"],
                closeOnRun: false,
                run: () => setShowHistoryPanel((visible) => !visible),
            },
            {
                id: "set-preview-zoom",
                group: t("palette.group.preferencePreview"),
                label: t("palette.setPreviewZoom"),
                icon: ZoomIn,
                keywords: ["preview", "zoom", "percent", "scale"],
                childrenPlaceholder: t("palette.choosePreviewZoom"),
                children: [0.75, 1, 1.25, 1.5, 2].map((value) => ({
                    id: `set-preview-zoom-${value}`,
                    group: t("palette.group.preferencePreview"),
                    label: `${Math.round(value * 100)}%`,
                    icon: ZoomIn,
                    checked: clientPreferences.preview.zoom === value,
                    keywords: ["zoom", "preview", String(value)],
                    closeOnRun: false,
                    run: () => updateClientPreferenceSection("preview", { zoom: value }),
                })),
            },
            {
                id: "preferences-palette-width",
                group: t("palette.group.preferencePalette"),
                label: t("palette.commandPaletteWidth"),
                icon: Columns3,
                keywords: ["command", "palette", "width", "size"],
                children: (["compact", "standard", "wide"] as const).map((width) => ({
                    id: `preferences-palette-width-${width}`,
                    group: t("palette.group.preferencePalette"),
                    label: t(`palette.option${width[0].toUpperCase()}${width.slice(1)}`),
                    icon: Columns3,
                    checked: clientPreferences.commandPalette.width === width,
                    closeOnRun: false,
                    run: () => updateClientPreferenceSection("commandPalette", { width }),
                })),
            },
            {
                id: "preferences-palette-height",
                group: t("palette.group.preferencePalette"),
                label: t("palette.commandPaletteHeight"),
                icon: Maximize2,
                keywords: ["command", "palette", "height", "size"],
                children: (["compact", "standard", "tall"] as const).map((height) => ({
                    id: `preferences-palette-height-${height}`,
                    group: t("palette.group.preferencePalette"),
                    label: t(`palette.option${height[0].toUpperCase()}${height.slice(1)}`),
                    icon: Maximize2,
                    checked: clientPreferences.commandPalette.height === height,
                    closeOnRun: false,
                    run: () => updateClientPreferenceSection("commandPalette", { height }),
                })),
            },
            {
                id: "preferences-dashboard-density",
                group: t("palette.group.preferenceDashboard"),
                label: t("palette.dashboardDensity"),
                icon: LayoutTemplate,
                keywords: ["dashboard", "density", "cards", "grid"],
                children: (["large", "normal", "compact"] as const).map((density) => ({
                    id: `preferences-dashboard-density-${density}`,
                    group: t("palette.group.preferenceDashboard"),
                    label: t(`palette.option${density[0].toUpperCase()}${density.slice(1)}`),
                    icon: LayoutTemplate,
                    checked: clientPreferences.dashboard.density === density,
                    closeOnRun: false,
                    run: () => updateClientPreferenceSection("dashboard", { density }),
                })),
            },
            {
                id: "preferences-export-format",
                group: t("palette.group.preferenceExport"),
                label: t("palette.exportDefaultFormat"),
                icon: Download,
                keywords: ["export", "default", "format", ...EXPORT_FORMATS.map((format) => format.id)],
                children: EXPORT_FORMATS.map((format) => ({
                    id: `preferences-export-format-${format.id}`,
                    group: t("palette.group.preferenceExport"),
                    label: t(format.labelKey),
                    icon: EXPORT_FORMAT_ICONS[format.id],
                    checked: clientPreferences.export.format === format.id,
                    closeOnRun: false,
                    run: () => updateClientPreferenceSection("export", { format: format.id }),
                })),
            },
            {
                id: "preferences-pdf-sidecar",
                group: t("palette.group.preferenceExport"),
                label: t("palette.pdfSidecar"),
                icon: FileJson,
                checked: clientPreferences.export.pdfIncludeSidecar,
                status: t(clientPreferences.export.pdfIncludeSidecar
                    ? "palette.optionOn"
                    : "palette.optionOff"),
                keywords: ["pdf", "json", "sidecar", "backup", "export"],
                closeOnRun: false,
                run: () => updateClientPreferenceSection("export", {
                    pdfIncludeSidecar: !clientPreferences.export.pdfIncludeSidecar,
                }),
            },
            {
                id: "preferences-export-data",
                group: t("palette.group.preferenceData"),
                label: t("palette.preferencesExport"),
                icon: Download,
                keywords: ["preferences", "settings", "export", "download", "backup"],
                run: handleExportPreferences,
            },
            {
                id: "preferences-import-data",
                group: t("palette.group.preferenceData"),
                label: t("palette.preferencesImport"),
                icon: Upload,
                keywords: ["preferences", "settings", "import", "upload", "restore"],
                run: () => preferencesFileInputRef.current?.click(),
            },
            {
                id: "preferences-reset-data",
                group: t("palette.group.preferenceData"),
                label: t("palette.preferencesReset"),
                icon: RotateCcw,
                keywords: ["preferences", "settings", "reset", "defaults", "clear"],
                run: handleResetPreferences,
            },
            {
                id: "your-data-open",
                group: t("palette.group.preferenceData"),
                label: t("palette.yourDataOpen"),
                icon: ShieldCheck,
                keywords: ["data", "privacy", "gdpr", "storage", "cookies"],
                run: () => void navigateAfterSave("/your-data"),
            },
            {
                id: "your-data-download",
                group: t("palette.group.preferenceData"),
                label: t("palette.yourDataDownload"),
                icon: Download,
                keywords: ["data", "privacy", "gdpr", "export", "download", "backup"],
                run: () => void navigateAfterSave("/your-data?action=download"),
            },
            {
                id: "your-data-delete",
                group: t("palette.group.preferenceData"),
                label: t("palette.yourDataDelete"),
                icon: Radiation,
                keywords: ["data", "privacy", "gdpr", "delete", "erase", "nuke"],
                run: () => void navigateAfterSave("/your-data?action=delete"),
            },
        ];

        return [
        {
            id: "context-actions",
            group: t("palette.group.context"),
            label: t("palette.contextMenu"),
            icon: selectedDesignElementId ? Paintbrush : SlidersHorizontal,
            status: contextActions.length === 0 ? t("palette.noSelection") : undefined,
            keywords: ["context", "selected", "selection", "current", "actions"],
            childrenPlaceholder: t("palette.contextPlaceholder"),
            children: contextActions,
            disabled: contextActions.length === 0,
        },
        {
            id: "create",
            group: t("palette.group.file"),
            label: t("palette.createMenu"),
            icon: FilePlus2,
            keywords: ["create", "new", "duplicate", "template", "apply"],
            childrenPlaceholder: t("palette.createPlaceholder"),
            children: createActions,
        },
        {
            id: "quick-open",
            group: t("palette.group.goTo"),
            label: t("palette.quickOpen"),
            icon: FolderOpen,
            keywords: ["open", "resume", "template", "history", "recent", "file"],
            childrenPlaceholder: t("palette.quickOpenPlaceholder"),
            children: quickOpenActions,
        },
        {
            id: "jump-to-entry",
            group: t("palette.group.goTo"),
            label: t("palette.jumpToEntry"),
            icon: ListTree,
            keywords: ["jump", "entry", "company", "school", "project", "skill", "content"],
            childrenPlaceholder: t("palette.jumpToEntryPlaceholder"),
            children: contentEntryActions,
            disabled: contentEntryActions.length === 0,
        },
        {
            id: "go-to-preview",
            group: t("palette.group.goTo"),
            label: t("palette.goToPreview"),
            icon: Eye,
            keywords: ["preview", "editor", "fields", "resume", "page", "canvas"],
            run: goToPreviewFields,
        },
        {
            id: "json-editor-open",
            group: t("palette.group.goTo"),
            label: t("jsonEditor.open"),
            icon: FileJson,
            checked: sidebarTab === "json",
            keywords: ["json", "raw", "data"],
            run: () => { setIsFocusMode(false); setSidebarTab("json"); if (isMobileLayout) setMobilePane("content"); },
        },
        ...(jsonSession.undo ? [{
            id: "json-editor-undo", group: t("palette.group.goTo"), label: t("jsonEditor.undo"), icon: Undo2,
            keywords: ["json", "undo"], run: () => { setIsFocusMode(false); setSidebarTab("json"); if (isMobileLayout) setMobilePane("content"); jsonSession.undo?.(); },
        }] : []),
        {
            id: "go-to-content",
            group: t("palette.group.goTo"),
            label: t("palette.contentMenu"),
            icon: FileText,
            checked: sidebarTab === "content",
            keywords: ["content", "sections", "entries", "text"],
            childrenPlaceholder: t("palette.contentPlaceholder"),
            children: [...configuredContentActions, ...availableContentActions],
        },
        {
            id: "go-to-customize",
            group: t("palette.group.goTo"),
            label: t("palette.customizeMenu"),
            icon: SlidersHorizontal,
            checked: sidebarTab === "customize",
            keywords: ["customize", "design", "style", "layout", "fonts", "colours", "colors"],
            childrenPlaceholder: t("palette.customizePlaceholder"),
            children: CUSTOMIZE_SECTIONS.map((section) => ({
                id: `customize-${section.id}`,
                group: t(CUSTOMIZE_GROUP_BY_ID[section.group].labelKey),
                label: t(section.labelKey),
                icon: section.icon,
                keywords: [section.id, ...section.keywords],
                run: () => {
                    requestCustomizePanel(section.id);
                    if (isMobileLayout) setMobilePane("content");
                },
            })),
        },
        {
            id: "dashboard",
            group: t("palette.group.goTo"),
            label: t("palette.backToDashboard"),
            icon: ArrowLeft,
            keywords: ["dashboard", "home", "resumes", "back"],
            run: () => requestJsonEditorLeave(() => router.push("/dashboard")),
        },
        {
            id: "preferences",
            group: t("palette.group.preferences"),
            label: t("palette.preferencesMenu"),
            icon: SlidersHorizontal,
            keywords: [
                "preferences",
                "settings",
                "configuration",
                "theme",
                "language",
                "autosave",
                "command palette",
            ],
            childrenPlaceholder: t("palette.preferencesPlaceholder"),
            children: preferenceActions,
        },
        {
            id: "save",
            group: t("palette.group.file"),
            label: t("editor.save"),
            icon: Save,
            shortcut: getSaveShortcut(),
            disabled: isSaving || !isDirty,
            keywords: ["save", "write", "store"],
            run: () => void handleManualSave(),
        },
        {
            id: "export",
            group: t("palette.group.file"),
            label: t("palette.exportMenu"),
            icon: Download,
            keywords: ["export", "pdf", "png", "svg", "download", "print"],
            childrenPlaceholder: t("palette.exportPlaceholder"),
            children: exportActions,
        },
        {
            id: "history",
            group: t("palette.group.view"),
            label: t("history.button"),
            icon: History,
            checked: showHistoryPanel,
            keywords: ["history", "versions", "undo", "revisions"],
            childrenPlaceholder: t("palette.historyPlaceholder"),
            children: historyActions,
        },
        {
            id: "preview-controls",
            group: t("palette.group.view"),
            label: t("palette.previewMenu"),
            icon: Eye,
            keywords: ["preview", "zoom", "fullscreen", "view"],
            childrenPlaceholder: t("palette.previewPlaceholder"),
            children: previewActions,
        },
        {
            id: "workspace",
            group: t("palette.group.view"),
            label: t("palette.workspaceMenu"),
            icon: Columns3,
            keywords: ["workspace", "panels", "layout", "focus"],
            childrenPlaceholder: t("palette.workspacePlaceholder"),
            children: workspaceActions,
        },
        {
            id: "set-value",
            group: t("palette.group.view"),
            label: t("palette.setValueMenu"),
            icon: SlidersHorizontal,
            keywords: ["set", "value", "paper", "resume language", "font"],
            childrenPlaceholder: t("palette.setValuePlaceholder"),
            children: setValueActions,
        },
        {
            id: "shortcuts",
            group: t("palette.group.help"),
            label: t("shortcuts.title"),
            icon: Keyboard,
            shortcut: "?",
            keywords: ["shortcuts", "keyboard", "keys", "help"],
            run: () => setIsShortcutsOpen(true),
        },
        {
            id: "feedback",
            group: t("palette.group.help"),
            label: t("feedback.button"),
            icon: Bug,
            keywords: ["feedback", "bug", "report", "contact"],
            run: () => setIsFeedbackOpen(true),
        },
        ];
    }, [
        autoSaveEnabled,
        goToPreviewFields,
        handleManualSave,
        isDirty,
        isFocusMode,
        isMobileLayout,
        isSaving,
        locale,
        paperSize,
        activeResumeId,
        applyContentTransform,
        applyTemplateById,
        builtinTemplates,
        canActOnSelectedHistory,
        clientPreferences,
        closeHistoryPreview,
        handleCreateBlankResume,
        handleCreateFromTemplate,
        handleDuplicateCurrentResume,
        handleDuplicateHistory,
        handleExportPreferences,
        handleQuickExport,
        handleCopyToClipboard,
        handleResetPreferences,
        handleRestoreHistory,
        historyEntryIds,
        historyEntries,
        requestContentSection,
        requestPreviewCommand,
        requestPanelLayout,
        recentResumes,
        removeDesignElement,
        resume,
        requestCustomizePanel,
        router,
        setAutoSaveEnabled,
        setLocale,
        setThemePreference,
        showHistoryPanel,
        sidebarTab,
        jsonSession,
        setSidebarTab,
        selectedContentTarget,
        selectedDesignElementId,
        selectedHistoryId,
        selectRelativeHistory,
        t,
        themePreference,
        toggleHistoryPanel,
        userTemplates,
        updatePaperSize,
        updateClientPreferenceSection,
        updateSettings,
        navigateAfterSave,
        duplicateDesignElement,
        moveDesignElementLayer,
    ]);

    const commandActions = useMemo<CommandAction[]>(() => {
        const resolveCommands = (ids: string[]) => ids
            .map((commandId) => findCommandAction(baseCommandActions, commandId))
            .filter((action): action is CommandAction => Boolean(action?.run));
        const recentActions = resolveCommands(commandPreferences.recentIds);
        const pinnedActions = resolveCommands(commandPreferences.pinnedIds);
        const pinnableActions = flattenCommandActions(baseCommandActions)
            .filter((action) => Boolean(action.run));

        return [
            {
                id: "pinned-commands",
                group: t("palette.group.personal"),
                label: t("palette.pinnedCommands"),
                icon: Pin,
                status: pinnedActions.length === 0 ? t("palette.nonePinned") : undefined,
                keywords: ["pinned", "favorites", "saved", "commands"],
                childrenPlaceholder: t("palette.pinnedPlaceholder"),
                children: pinnedActions,
                disabled: pinnedActions.length === 0,
            },
            {
                id: "recent-commands",
                group: t("palette.group.personal"),
                label: t("palette.recentCommands"),
                icon: Clock3,
                status: recentActions.length === 0 ? t("palette.noRecentCommands") : undefined,
                keywords: ["recent", "last", "history", "commands"],
                childrenPlaceholder: t("palette.recentPlaceholder"),
                children: recentActions,
                disabled: recentActions.length === 0,
            },
            {
                id: "manage-pinned-commands",
                group: t("palette.group.personal"),
                label: t("palette.managePinnedCommands"),
                icon: Pin,
                keywords: ["pin", "unpin", "favorites", "manage", "commands"],
                childrenPlaceholder: t("palette.managePinnedPlaceholder"),
                children: pinnableActions.map((action) => ({
                    id: `pin-command-${action.id}`,
                    group: action.group,
                    label: action.label,
                    icon: action.icon,
                    status: commandPreferences.pinnedIds.includes(action.id)
                        ? t("palette.pinned")
                        : undefined,
                    checked: commandPreferences.pinnedIds.includes(action.id),
                    keywords: ["pin", "unpin", action.id, ...(action.keywords ?? [])],
                    globalSearch: false,
                    run: () => handleToggleCommandPin(action.id),
                })),
            },
            ...baseCommandActions,
        ];
    }, [
        baseCommandActions,
        commandPreferences,
        handleToggleCommandPin,
        t,
    ]);

    useEffect(() => {
        const toggleJson = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== "j") return;
            event.preventDefault();
            setIsFocusMode(false);
            setSidebarTab(useResumeStore.getState().sidebarTab === "json" ? "content" : "json");
            if (isMobileLayout) setMobilePane("content");
        };
        document.addEventListener("keydown", toggleJson);
        return () => document.removeEventListener("keydown", toggleJson);
    }, [isMobileLayout, setSidebarTab]);

    useEffect(() => {
        if (!isLoaded) return;
        const url = new URL(window.location.href);
        if (url.searchParams.get("json-editor") !== "retry") return;
        setSidebarTab("json");
        if (isMobileLayout) setMobilePane("content");
        url.searchParams.delete("json-editor");
        window.history.replaceState(window.history.state, "", url.href);
    }, [isLoaded, isMobileLayout, setSidebarTab]);

    useEffect(() => {
        const handleSaveShortcut = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") {
                return;
            }
            if (isEditableShortcutTarget(event.target)) return;
            event.preventDefault();
            void handleManualSave();
        };
        document.addEventListener("keydown", handleSaveShortcut);
        return () => document.removeEventListener("keydown", handleSaveShortcut);
    }, [handleManualSave]);

    useEffect(() => {
        const handleShortcutsSheet = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            // Most layouts report "?" directly; some report the unshifted key.
            const isQuestionMark = event.key === "?" || (event.shiftKey && event.key === "/");
            if (!isQuestionMark) return;
            if (isEditableShortcutTarget(event.target)) return;
            event.preventDefault();
            setIsShortcutsOpen((open) => !open);
        };
        document.addEventListener("keydown", handleShortcutsSheet);
        return () => document.removeEventListener("keydown", handleShortcutsSheet);
    }, []);

    useEffect(() => {
        const handlePalette = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
            if (event.key.toLowerCase() !== "k") return;
            // Unlike the other shortcuts this one stays live while typing —
            // reaching the palette should never require leaving a field first.
            event.preventDefault();
            setIsPaletteOpen((open) => !open);
        };
        document.addEventListener("keydown", handlePalette);
        return () => document.removeEventListener("keydown", handlePalette);
    }, []);

    if (!isLoaded) {
        return (
            <div className="min-h-screen bg-surface-2 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-strong animate-spin" />
            </div>
        );
    }

    const previewBanner = selectedHistoryEntry ? (
        <div className="absolute top-4 left-4 right-4 z-20 rounded-2xl border border-accent/30 bg-surface-2/90 backdrop-blur-md px-4 py-3 shadow-xl">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="text-sm font-medium text-strong">
                        {t("history.previewingVersion", { date: new Date(selectedHistoryEntry.createdAt).toLocaleString() })}
                    </p>
                    <p className="text-xs text-mid mt-1">
                        {previewResume
                            ? t("history.previewReadOnly")
                            : t("history.previewParseFailed")}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={closeHistoryPreview}
                        className="px-3 py-2 rounded-xl text-xs font-medium border border-edge text-bright hover:text-strong hover:border-faint transition-colors"
                    >
                        {t("history.backToCurrent")}
                    </button>
                    <button
                        type="button"
                        onClick={handleDuplicateHistory}
                        disabled={!canActOnSelectedHistory}
                        className="px-3 py-2 rounded-xl text-xs font-medium border border-edge text-bright hover:text-strong hover:border-faint transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="inline-flex items-center gap-1.5">
                            <Copy className="w-3.5 h-3.5" />
                            {t("history.duplicate")}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={handleRestoreHistory}
                        disabled={!canActOnSelectedHistory}
                        className="px-3 py-2 rounded-xl text-xs font-medium bg-accent text-surface-2 hover:bg-accent-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {t("history.restoreVersion")}
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    const previewElement = (
        <ResumePreview resumeOverride={previewResume ?? undefined} paperSizeOverride={paperSize} />
    );

    

    const rightPanelHeader = (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-edge px-4 py-2.5">
            <span className="text-sm font-semibold text-strong">{t("history.title")}</span>
            <button
                type="button"
                onClick={() => setShowHistoryPanel(false)}
                aria-label={t("common.close")}
                title={t("common.close")}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-edge text-faint transition-colors hover:border-faint hover:text-strong"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );

    const renderMobileFooterButton = (
        key: "content" | "customize" | "preview",
        icon: ReactNode,
        label: string,
        onClick: () => void,
        isActive: boolean,
    ) => {
        return (
            <button
                key={key}
                type="button"
                onClick={onClick}
                data-state={isActive ? "active" : "inactive"}
                aria-pressed={isActive}
                className={`inline-flex h-10 min-w-0 items-center justify-center gap-1 rounded-xl border px-1.5 text-[11px] font-medium transition-all duration-200 ${isActive ? "border-faint bg-edge text-strong shadow-sm" : "border-edge bg-surface-4 text-faint hover:border-faint hover:text-strong"}`}
            >
                {icon}
                <span className="min-w-0 truncate max-[374px]:hidden">{label}</span>
            </button>
        );
    };

    const mobilePersistentFooter = (
        <div className="fixed inset-x-0 bottom-0 z-40 grid shrink-0 grid-cols-3 items-center gap-2 border-t border-edge bg-surface-2/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.28)] backdrop-blur lg:hidden">
            {renderMobileFooterButton(
                "content",
                <FileText className="h-3.5 w-3.5 shrink-0" />,
                t("editor.contentTab"),
                () => {
                    setSidebarTab("content");
                    setMobilePane("content");
                },
                mobilePane === "content" && sidebarTab === "content",
            )}
            {renderMobileFooterButton(
                "customize",
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />,
                t("editor.customizeTab"),
                () => {
                    setSidebarTab("customize");
                    setMobilePane("content");
                },
                mobilePane === "content" && sidebarTab === "customize",
            )}
            {renderMobileFooterButton(
                "preview",
                <Eye className="h-3.5 w-3.5 shrink-0" />,
                t("editor.preview"),
                () => setMobilePane("preview"),
                mobilePane === "preview",
            )}
        </div>
    );

    return (
        <div className="flex h-[100dvh] min-h-screen min-h-[100dvh] flex-col overflow-hidden bg-surface-2 font-sans text-strong print:h-auto print:bg-white print:text-black">
            <header className={`${mobileMenuOpen ? "relative z-[90]" : "z-10"} flex shrink-0 items-center gap-2 px-3 pt-2 pb-1.5 sm:px-6 transition-all duration-500 print:hidden ${isFocusMode ? "opacity-0 pointer-events-none -translate-y-4" : "opacity-100"}`}>
                <div className="flex min-w-0 flex-1 items-center gap-1.5 lg:gap-2">
                    <Link href="/dashboard" aria-label={t("palette.backToDashboard")} title={t("palette.backToDashboard")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint transition-colors hover:bg-edge hover:text-strong lg:-ml-1">
                        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    </Link>

                    <div className="h-5 w-px shrink-0 bg-edge" />
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <label className="group flex shrink-0 cursor-text items-center gap-1" title={t("dashboard.editMeta")}>
                            <input
                                type="text"
                                value={resume.meta?.title || ""}
                                placeholder={t("dashboard.cv")}
                                onChange={(e) => updateMeta({ title: e.target.value })}
                                className="min-w-0 max-w-[34vw] flex-none truncate border-none bg-transparent p-0 text-sm font-medium sm:max-w-[16rem] text-strong/90 outline-none transition-colors placeholder:text-strong/50 focus:ring-0 group-hover:text-strong"
                                style={{ width: `${Math.max(3, Math.min(18, (resume.meta?.title || t("dashboard.cv")).length + 1))}ch` }}
                            />
                            <Pencil className="pointer-events-none h-3 w-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                        </label>
                        {isSaving ? (
                            <span className="flex min-w-0 shrink items-center truncate text-[11px] text-info">
                                <Loader2 className="w-3 h-3 mr-1 shrink-0 animate-spin" /> {t("dashboard.saving")}
                            </span>
                        ) : isDirty ? (
                            <span className="flex min-w-0 shrink items-center gap-1.5 text-[11px] text-accent">
                                <span className="truncate">{t("dashboard.unsaved")}</span>
                                <span className="hidden sm:inline-flex"><Kbd>{getSaveShortcut()}</Kbd></span>
                            </span>
                        ) : lastSavedAt ? (
                            <span className="hidden min-w-0 truncate text-[11px] text-faint sm:inline">
                                {t("dashboard.savedAt", { time: new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })}
                            </span>
                        ) : (
                            <span className="hidden min-w-0 truncate text-[11px] text-faint sm:inline">{t("dashboard.allSaved")}</span>
                        )}
                    </div>
                </div>

                {!isMobileLayout && (
                    <div className="flex shrink-0 items-center justify-end gap-1">
                        <button
                            type="button"
                            onClick={() => setIsPaletteOpen(true)}
                            title={t("palette.title")}
                            className="mr-1 flex h-8 items-center gap-2 rounded-lg border border-edge bg-surface-1 pl-2.5 pr-2 text-xs text-faint transition-colors hover:border-faint hover:text-strong"
                        >
                            <Search className="h-3.5 w-3.5 shrink-0" />
                            <span className="hidden xl:inline">{t("palette.trigger")}</span>
                            <Kbd>{getPaletteShortcut()}</Kbd>
                        </button>

                        <button
                            type="button"
                            onClick={toggleHistoryPanel}
                            aria-pressed={showHistoryPanel}
                            title={t("history.button")}
                            className={headerIconButton(showHistoryPanel)}
                        >
                            <History className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsShortcutsOpen(true)}
                            title={t("shortcuts.title")}
                            className={headerIconButton(false)}
                        >
                            <Keyboard className="h-4 w-4" />
                        </button>

                        <div className="mx-1 h-5 w-px shrink-0 bg-edge" />

                        <ThemeToggle />
                        <LanguageSwitcher compact />
                        <ExportMenu resume={resume} paperSize={paperSize} variant="primary" />
                    </div>
                )}

                {isMobileLayout && (
                    <div className="flex shrink-0 items-center justify-end gap-1">
                        <button
                            type="button"
                            onClick={() => void handleManualSave()}
                            disabled={isSaving || !isDirty}
                            aria-label={t("editor.save")}
                            title={t("editor.saveTitle")}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-edge bg-surface-4 text-accent transition-colors hover:border-accent/60 hover:bg-edge disabled:cursor-not-allowed disabled:opacity-35"
                        >
                            <Save className="h-4 w-4" />
                        </button>
                        <ThemeToggle buttonClassName="!px-1.5" />
                        <LanguageSwitcher compact buttonClassName="!px-1.5" />
                        <div className="relative shrink-0">
                            <button
                                type="button"
                                onClick={() => setMobileMenuOpen((value) => !value)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-edge text-faint transition-colors hover:border-faint hover:text-strong"
                                aria-label={t("editor.openActions")}
                            >
                                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>
                            {mobileMenuOpen && (
                                <div className="absolute right-0 top-12 z-30 w-[min(13rem,calc(100vw-2rem))] rounded-xl border border-edge bg-surface-4 p-2 shadow-xl">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMobileMenuOpen(false);
                                            setIsPaletteOpen(true);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-accent hover:text-accent-soft hover:bg-edge transition-colors cursor-pointer"
                                    >
                                        <Search className="w-4 h-4" />
                                        <span>{t("palette.mobileQuickActions")}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMobilePane("history");
                                            setShowHistoryPanel(true);
                                            setMobileMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-accent hover:text-accent-soft hover:bg-edge transition-colors cursor-pointer"
                                    >
                                        <History className="w-4 h-4" />
                                        <span>{t("history.button")}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAutoSaveEnabled(!autoSaveEnabled);
                                            setMobileMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${autoSaveEnabled ? "text-success hover:text-success" : "text-bright hover:text-strong"} hover:bg-edge`}
                                    >
                                        <RefreshCw className={`w-4 h-4 ${autoSaveEnabled ? "opacity-100" : "opacity-40"}`} />
                                        <span>{t(autoSaveEnabled ? "editor.autoSaveOn" : "editor.autoSaveOff")}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsSaveAsTemplateOpen(true);
                                            setMobileMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-bright hover:text-strong hover:bg-edge transition-colors cursor-pointer"
                                    >
                                        <BookmarkPlus className="w-4 h-4" />
                                        <span>{t("editor.saveAsTemplate")}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsFeedbackOpen(true);
                                            setMobileMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-bright hover:text-strong hover:bg-edge transition-colors cursor-pointer"
                                    >
                                        <Bug className="w-4 h-4" />
                                        <span>{t("feedback.button")}</span>
                                    </button>
                                    <ExportMenu resume={resume} paperSize={paperSize} variant="minimal" onNeedPreview={showMobilePreview} />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </header>

            <ExportDialog
                open={isExportDialogOpen}
                onClose={() => setIsExportDialogOpen(false)}
                resume={resume}
                paperSize={paperSize}
                onNeedPreview={isMobileLayout ? showMobilePreview : undefined}
            />

            <ExportSupportCard />

            {isFeedbackOpen && <FeedbackDialog onClose={() => setIsFeedbackOpen(false)} />}

            {isShortcutsOpen && <ShortcutsOverlay open={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />}

            <input
                ref={preferencesFileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                data-testid="preferences-file-input"
                onChange={handlePreferencesFileChange}
            />

            <CommandPalette
                open={isPaletteOpen}
                onClose={() => setIsPaletteOpen(false)}
                actions={commandActions}
                onRunAction={handleCommandRun}
                variant={isMobileLayout ? "sheet" : "dialog"}
            />

            <ConfirmModal
                open={pendingCommandConfirmation !== null}
                title={pendingCommandConfirmation?.title ?? ""}
                description={pendingCommandConfirmation?.description ?? ""}
                confirmLabel={pendingCommandConfirmation?.confirmLabel ?? ""}
                destructive={pendingCommandConfirmation?.destructive ?? true}
                onCancel={() => setPendingCommandConfirmation(null)}
                onConfirm={() => {
                    pendingCommandConfirmation?.run();
                    setPendingCommandConfirmation(null);
                }}
            />

            <JsonEditorHost />
            <div id="main-content" role="main" className="relative flex-1 overflow-hidden p-3 print:p-0 print:overflow-visible sm:p-6 sm:pt-2">
                {isFocusMode && (
                    <button
                        type="button"
                        onClick={() => setIsFocusMode(false)}
                        className="fixed right-8 top-8 z-[100] flex h-10 items-center gap-2 rounded-xl border border-edge bg-surface-4/80 px-4 text-xs font-bold text-faint backdrop-blur-md transition-all hover:border-accent/40 hover:text-strong group animate-in fade-in slide-in-from-top-4 duration-500"
                    >
                        <X className="h-4 w-4" />
                        {t("editor.exitFocusMode")}
                        <Kbd className="ml-1 opacity-50 group-hover:opacity-100">Esc</Kbd>
                    </button>
                )}
                {isMobileLayout ? (
                    <div className="h-full flex flex-col gap-3 pb-20">
                        <div className="flex-1 min-h-0">
                            {mobilePane === "content" && (
                                <EditorSidebar
                                    onMobilePreview={() => setMobilePane("preview")}
                                />
                            )}
                            {mobilePane === "preview" && (
                                <div className="h-full bg-surface-4 rounded-[1rem] sm:rounded-[1.25rem] relative w-full border border-edge print:border-none print:w-auto print:h-auto">
                                    {previewBanner}
                                    <div className="absolute inset-0 overflow-hidden rounded-[1rem] sm:rounded-[1.25rem] print:static print:overflow-visible">
                                        {previewElement}
                                    </div>
                                </div>
                            )}
                            {mobilePane === "history" && showHistoryPanel && (
                                <div className="h-full bg-surface-4 rounded-[1rem] sm:rounded-[1.25rem] relative border border-edge">
                                    <div className="absolute inset-0 overflow-hidden rounded-[1rem] sm:rounded-[1.25rem] flex flex-col">
                                        {rightPanelHeader}
                                        <div className="flex-1 min-h-0">
                                            <HistoryPanel
                                                entries={historyEntries}
                                                selectedEntryId={selectedHistoryId}
                                                onSelectEntry={setSelectedHistoryId}
                                                onPreviewCurrent={closeHistoryPreview}
                                                onRestoreSelected={handleRestoreHistory}
                                                onDuplicateSelected={handleDuplicateHistory}
                                                canRestoreSelected={canActOnSelectedHistory}
                                                canDuplicateSelected={canActOnSelectedHistory}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <Group orientation="horizontal" groupRef={panelGroupRef}>
                        {!isFocusMode && (
                            <>
                                <Panel id={PANEL_ID.sidebar} defaultSize={30} minSize={20} className="flex flex-col print:hidden z-10">
                                    <EditorSidebar />
                                </Panel>

                                <Separator className="w-6 bg-transparent transition-colors flex items-center justify-center cursor-col-resize print:hidden group">
                                    <div className="w-1.5 h-12 rounded-full bg-edge group-hover:bg-faint transition-colors" />
                                </Separator>
                            </>
                        )}

                        <Panel id={PANEL_ID.preview} defaultSize={isFocusMode ? 100 : 45} minSize={30} className="flex justify-center print:py-0 print:px-0 print:bg-white print:block h-full print:h-auto print:max-h-none print:overflow-visible transition-all duration-500">
                            <div className={`flex-1 bg-surface-4 rounded-[1.25rem] relative w-full h-full border border-edge print:border-none print:w-auto print:h-auto print:max-h-none print:overflow-visible print:bg-white transition-all duration-500 ${isFocusMode ? "border-transparent bg-transparent" : ""}`}>
                                {previewBanner}
                                <div className={`absolute inset-0 overflow-hidden rounded-[1.25rem] print:static print:overflow-visible print:h-auto print:max-h-none transition-all duration-500 ${isFocusMode ? "scale-[1.02]" : ""}`}>
                                    {previewElement}
                                </div>
                            </div>
                        </Panel>

                        {showHistoryPanel && !isFocusMode && (
                            <>
                                <Separator className="w-6 bg-transparent transition-colors flex items-center justify-center cursor-col-resize print:hidden group">
                                    <div className="w-1.5 h-12 rounded-full bg-edge group-hover:bg-faint transition-colors" />
                                </Separator>

                                <Panel id={PANEL_ID.right} defaultSize={25} minSize={20} className="flex flex-col print:hidden z-10">
                                    <div className="flex-1 bg-surface-4 rounded-[1.25rem] relative border border-edge">
                                        <div className="absolute inset-0 overflow-hidden rounded-[1.25rem] flex flex-col">
                                            {rightPanelHeader}
                                            <div className="flex-1 min-h-0">
                                                <HistoryPanel
                                                    entries={historyEntries}
                                                    selectedEntryId={selectedHistoryId}
                                                    onSelectEntry={setSelectedHistoryId}
                                                    onPreviewCurrent={closeHistoryPreview}
                                                    onRestoreSelected={handleRestoreHistory}
                                                    onDuplicateSelected={handleDuplicateHistory}
                                                    canRestoreSelected={canActOnSelectedHistory}
                                                    canDuplicateSelected={canActOnSelectedHistory}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </Panel>
                            </>
                        )}
                    </Group>
                )}
            </div>

            {isMobileLayout && mobilePane !== "content" && mobilePersistentFooter}

            <SaveAsTemplateDialog
                open={isSaveAsTemplateOpen}
                onClose={() => setIsSaveAsTemplateOpen(false)}
                onSave={async (meta) => {
                    const newId = await saveResumeAsTemplate(meta);
                    router.push(`/templates/${newId}`);
                }}
                initialName={resume.meta?.title ? `${resume.meta.title} template` : "Untitled template"}
            />
        </div>
    );
}
