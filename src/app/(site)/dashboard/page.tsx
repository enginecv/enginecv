"use client";

import { templateDisplayMeta } from "@/lib/templates/template-display";

import { useLiveQuery } from "dexie-react-hooks";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { urlAfterDashboardTabSelect } from "@/lib/dashboard-tab-url";
import { isTerminalStage } from "@/lib/jobs/schema";
import { useTrackerUsageNote } from "@/components/jobs/useTrackerUsage";
import { db } from "@/lib/db";
import { useRouter, useSearchParams } from "next/navigation";
import { useResumeStore } from "@/lib/store";
import {
    ArrowLeft, FileText, Plus, Trash2, X, AlertTriangle, Search, Edit2, Check, Copy, Download, LayoutTemplate, Upload, Mail, Briefcase, ListFilter, Grid2X2, Grid3X3, LayoutGrid, Radiation, ShieldCheck, FolderSync, type LucideIcon,
} from "lucide-react";
import { exportTemplateToJson, importTemplateFromJsonText } from "@/lib/templates/template-io";
import { templateDocumentSchema, type TemplateDocument } from "@/lib/templates/template-schema";
import { getBuiltinTemplates } from "@/lib/templates/enginecv-templates";
import { useEffect, useId, useState, useRef, useCallback, useMemo, Suspense, type ReactNode } from "react";
import { createId } from "@/lib/id";
import { duplicateResume } from "@/lib/resume-operations";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { localizedPath } from "@/lib/i18n/locales";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { downloadBlob, exportToJson } from "@/lib/export";
import { createEmptyResume, resumeSchema, type Resume } from "@/lib/schema";
import { LiveResumeThumbnail } from "@/components/dashboard/LiveResumeThumbnail";
import { DashboardCard, LastUpdatedTooltipContent } from "@/components/dashboard/DashboardCard";
import { DashboardTemplateCard } from "@/components/dashboard/DashboardTemplateCard";
import { LettersTab } from "@/components/dashboard/LettersTab";
import { NavSearch } from "@/components/dashboard/NavSearch";
import { OPEN_WORKSPACE_ACTIVITY_EVENT } from "@/components/workspace/DocStateChip";
import { DeleteDocumentDialog } from "@/components/workspace/DeleteDocumentDialog";
import { useWorkspaceMembership } from "@/components/workspace/useWorkspaceMembership";
import { useHasWorkspaceFile } from "@/components/workspace/useHasWorkspaceFile";
import { WorkspacePanel } from "@/components/workspace/WorkspacePanel";
import type { SourceId } from "@/lib/import/sources";
import { ensureWorkspace, retireBeforeDelete, useWorkspaceStore } from "@/lib/workspace/controller";
import type { RetireChoice } from "@/lib/workspace/lifecycle";
import { DASHBOARD_CONTENT_CLASS, DASHBOARD_NAV_CLASS } from "@/components/dashboard/layout";
import { CopyLettersDialog } from "@/components/letters/CopyLettersDialog";
import { DeleteCvDialog } from "@/components/letters/DeleteCvDialog";
import type { DeletionDecision } from "@/lib/letters/deletion";
import type { LetterDocument } from "@/lib/letters/schema";
import { UndoToast, useUndoSlot } from "@/components/dashboard/UndoToast";
import { restoreDeletedCv, restoreDeletedTemplate, snapshotCvForUndo, snapshotTemplateForUndo, type DeletedCvSnapshot } from "@/lib/cv-undo";
import { copyLettersToCv, createLetterRecord, deleteCvWithLetters, importDataExport, listLettersForCv } from "@/lib/letters/store";
import type { DataExportExtras } from "@/lib/import/staging/types";
import { CreateModal } from "@/components/dashboard/CreateModal";
import { StartPanel } from "@/components/dashboard/StartPanel";
import { PageSizeSelect, Pager, SortSelect } from "@/components/dashboard/ListControls";
import { DASHBOARD_SORTS, paginate, sortDashboardItems, type DashboardPageSize, type DashboardSort } from "@/lib/dashboard-list";
import dynamic from "next/dynamic";
import type { StartPathId } from "@/lib/onboarding/start-paths";
import { parseStartParam, urlWithoutStartParam } from "@/lib/onboarding/start-param";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger,
    useSidebar,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useClientPreferencesStore } from "@/lib/preferences/store";

import { Skeleton } from "@/components/ui/skeleton";

type DashboardTab = "resumes" | "letters" | "jobs" | "templates";

// Example content and the picker load when someone opens it, not with the dashboard.
const ExamplePickerDialog = dynamic(() => import("@/components/dashboard/ExamplePickerDialog"), { ssr: false });
const ImportDataDialog = dynamic(() => import("@/components/import/hub/ImportDataDialog").then((m) => m.ImportDataDialog), { ssr: false });
// The Job Tracker loads when its tab opens, not with the dashboard.
const JobsTab = dynamic(() => import("@/components/jobs/JobsTab").then((m) => m.JobsTab), { ssr: false });
type GridDensity = "large" | "normal" | "compact";

const GRID_DENSITY_CLASS: Record<GridDensity, string> = {
    large: "grid-cols-1 md:grid-cols-2 xl:grid-cols-2",
    normal: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
    compact: "grid-cols-1 md:grid-cols-3 xl:grid-cols-4",
};
type TemplateDashboardTab = "all" | "builtin" | "user";

/** How many templates each section of the templates overview shows, by grid density. */
const TEMPLATE_OVERVIEW_COUNT: Record<GridDensity, number> = { large: 2, normal: 3, compact: 4 };
type DashboardNavItem = {
    id: DashboardTab;
    label: string;
    icon: LucideIcon;
    count?: number;
};

const EMPTY_TEMPLATES: TemplateDocument[] = [];

/** One block of the templates overview: a title, a few cards, and a button to see the rest. */
function TemplateOverviewSection({
    title,
    total,
    onSeeAll,
    testId,
    children,
}: {
    title: string;
    total: number;
    onSeeAll: () => void;
    testId: string;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    return (
        <section data-testid={testId} aria-label={title}>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-strong">
                {title}
                <span className="rounded-md bg-surface-1 px-1.5 py-0.5 text-[11px] font-semibold text-mid">{total}</span>
            </h2>
            {children}
            {total > 0 && (
                <div className="mt-5 flex justify-center">
                    <button
                        type="button"
                        onClick={onSeeAll}
                        data-testid={`${testId}-see-all`}
                        className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                    >
                        {t("dashboard.seeAllTemplates", { count: total })}
                    </button>
                </div>
            )}
        </section>
    );
}

function BackToAllTemplates({ onClick }: { onClick: () => void }) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            onClick={onClick}
            data-testid="dashboard-template-back"
            className="mb-4 flex items-center gap-1.5 text-sm font-medium text-mid transition-colors hover:text-strong"
        >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("dashboard.allTemplates")}
        </button>
    );
}

// ---------------------------------------------
// Template Filter Menu
// ---------------------------------------------

/** Compact replacement for the Builtin/Your Templates tabs on narrow widths. */
function TemplateFilterMenu({
    value,
    onChange,
    builtinCount,
    userCount,
    className,
}: {
    value: TemplateDashboardTab;
    onChange: (value: TemplateDashboardTab) => void;
    builtinCount: number;
    userCount: number;
    className?: string;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const options: { id: TemplateDashboardTab; label: string; count: number }[] = [
        { id: "all", label: t("dashboard.allTemplates"), count: builtinCount + userCount },
        { id: "builtin", label: t("dashboard.builtinTemplates"), count: builtinCount },
        { id: "user", label: t("dashboard.yourTemplates"), count: userCount },
    ];
    const active = options.find((option) => option.id === value) ?? options[0];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={t("dashboard.filterTemplates")}
                    title={t("dashboard.filterTemplates")}
                    data-testid="dashboard-template-filter"
                    className={`flex h-10 shrink-0 items-center gap-2 rounded-xl border border-edge bg-surface-4 px-3 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong ${className ?? ""}`}
                >
                    <ListFilter className="h-4 w-4" aria-hidden="true" />
                    <span className="rounded-md bg-surface-1 px-1.5 py-0.5 text-[10px] font-semibold text-mid">
                        {active.count}
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1.5">
                <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
                    {t("dashboard.templateFilterShow")}
                </p>
                {options.map((option) => {
                    const isActive = option.id === value;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                                onChange(option.id);
                                setOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                                isActive
                                    ? "bg-surface-4 text-strong"
                                    : "text-mid hover:bg-surface-4/70 hover:text-strong"
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                {isActive ? (
                                    <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                                ) : (
                                    <span className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                )}
                                {option.label}
                            </span>
                            <span className="rounded-md bg-surface-1 px-1.5 py-0.5 text-[10px] font-semibold text-mid">
                                {option.count}
                            </span>
                        </button>
                    );
                })}
            </PopoverContent>
        </Popover>
    );
}

// ---------------------------------------------
// Confirmation Modal
// ---------------------------------------------

function ConfirmModal({
    open,
    title,
    description,
    confirmLabel,
    onConfirm,
    onCancel,
    destructive,
}: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
    destructive?: boolean;
}) {
    const { t } = useTranslation();
    const titleId = useId();
    const dialogRef = useDialogFocus<HTMLDivElement>(open, onCancel);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-4"
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onCancel();
                }
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative w-full max-w-md rounded-[1rem] border border-edge bg-surface-4 p-6 shadow-2xl sm:p-8"
            >
                <button type="button" onClick={onCancel} aria-label={t("common.close")} className="absolute top-4 right-4 text-faint hover:text-strong transition-colors">
                    <X className="w-5 h-5" aria-hidden="true" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                    {destructive && (
                        <div className="p-2 rounded-xl bg-red-500/10 text-danger">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                    )}
                    <h2 id={titleId} className="text-lg font-semibold text-strong">{title}</h2>
                </div>

                <p className="text-faint text-sm mb-8 leading-relaxed">{description}</p>

                <div className="flex gap-3 justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium text-faint hover:text-strong hover:bg-edge transition-colors"
                    >
                        {t("dashboard.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                            destructive
                                ? "bg-red-500 hover:bg-red-600 text-white"
                                : "bg-accent hover:bg-accent-soft text-surface-2"
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------
// Resume Card
// ---------------------------------------------

function normalizeDashboardResume(rawResume: unknown): Resume {
    const parsed = resumeSchema.safeParse(rawResume);
    if (parsed.success) {
        const original = rawResume as Partial<Resume>;
        return {
            ...parsed.data,
            createdAt: typeof original.createdAt === "number"
                ? original.createdAt
                : (typeof original.updatedAt === "number" ? original.updatedAt : parsed.data.createdAt),
        };
    }

    const defaults = createEmptyResume();
    const original = (rawResume && typeof rawResume === "object" ? rawResume : {}) as Partial<Resume>;
    const fallbackUpdatedAt = typeof original.updatedAt === "number" ? original.updatedAt : Date.now();

    return {
        ...defaults,
        ...original,
        basics: {
            ...defaults.basics,
            ...(original.basics || {}),
        },
        meta: {
            ...defaults.meta,
            ...(original.meta || {}),
        },
        settings: {
            ...defaults.settings,
            ...(original.settings || {}),
        },
        createdAt: typeof original.createdAt === "number"
            ? original.createdAt
            : fallbackUpdatedAt,
        updatedAt: fallbackUpdatedAt,
    };
}

function getResumeExportFilename(resume: Resume) {
    const baseName = resume.meta.title || resume.basics.name || "resume";
    const safe = baseName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `resume-${safe || "resume"}.json`;
}

function ResumeCard({
    resume,
    onSaveMeta,
    onOpen,
    onDelete,
    onDuplicate,
    onDownload,
    letterCount = 0,
    onShowLetters,
    onWriteLetter,
}: {
    resume: Resume;
    /** Resolves to a message when the save was refused. */
    onSaveMeta: (meta: Resume["meta"]) => Promise<string | void> | string | void;
    onOpen: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onDownload: () => void;
    /** Cover letters that follow this CV. */
    letterCount?: number;
    onShowLetters: () => void;
    onWriteLetter: () => void;
}) {
    const { t } = useTranslation();
    const [isEditingMeta, setIsEditingMeta] = useState(false);
    const [draftTitle, setDraftTitle] = useState(resume.meta.title || "");
    const [draftDescription, setDraftDescription] = useState(resume.meta.description || "");
    const [draftTags, setDraftTags] = useState<string[]>(resume.meta.tags ?? []);
    const [draftTagInput, setDraftTagInput] = useState("");
    const [saveError, setSaveError] = useState<string | null>(null);
    const existingTags = resume.meta.tags ?? [];
    const fallbackCvLabel = resume.basics.name || t("dashboard.untitled");
    const bg = resume.settings?.colors?.background || "#ffffff";

    const startEditingMeta = (event?: { stopPropagation: () => void }) => {
        event?.stopPropagation();
        setDraftTitle(resume.meta.title || "");
        setDraftDescription(resume.meta.description || "");
        setDraftTags(resume.meta.tags ?? []);
        setDraftTagInput("");
        setIsEditingMeta(true);
    };

    const cancelEditingMeta = (event?: { stopPropagation: () => void }) => {
        event?.stopPropagation();
        setDraftTitle(resume.meta.title || "");
        setDraftDescription(resume.meta.description || "");
        setDraftTags(resume.meta.tags ?? []);
        setDraftTagInput("");
        setIsEditingMeta(false);
    };

    const commitTagInput = () => {
        const trimmed = draftTagInput.trim();
        if (!trimmed) return;
        if (draftTags.some((tag) => tag.toLowerCase() === trimmed.toLowerCase())) {
            setDraftTagInput("");
            return;
        }
        setDraftTags([...draftTags, trimmed]);
        setDraftTagInput("");
    };

    const removeTag = (tag: string) => {
        setDraftTags(draftTags.filter((existing) => existing !== tag));
    };

    const saveMeta = async (event?: { stopPropagation: () => void }) => {
        event?.stopPropagation();
        const pendingInput = draftTagInput.trim();
        const finalTags = pendingInput && !draftTags.some((tag) => tag.toLowerCase() === pendingInput.toLowerCase())
            ? [...draftTags, pendingInput]
            : draftTags;

        const nextMeta = {
            title: draftTitle.trim(),
            description: draftDescription.trim(),
            tags: finalTags,
        };

        const currentTags = resume.meta.tags ?? [];
        const tagsUnchanged =
            finalTags.length === currentTags.length &&
            finalTags.every((tag, index) => tag === currentTags[index]);

        if (
            nextMeta.title === (resume.meta.title || "") &&
            nextMeta.description === (resume.meta.description || "") &&
            tagsUnchanged
        ) {
            setIsEditingMeta(false);
            setDraftTagInput("");
            return;
        }

        const refused = await onSaveMeta(nextMeta);
        if (typeof refused === "string") {
            setSaveError(refused);
            return;
        }
        setSaveError(null);
        setDraftTagInput("");
        setIsEditingMeta(false);
    };

    const membership = useWorkspaceMembership(resume.id);
    const title = resume.meta.title || fallbackCvLabel;
    const description = resume.meta.description || resume.basics.headline || undefined;
    const openLabel = `Open ${title}`;
    const updatedAtLabel = t("dashboard.updatedAtLabel");
    const preview = (
        <div
            className="mx-auto aspect-[794/1123] w-full max-w-[280px] transform-gpu overflow-hidden shadow-2xl shadow-black/20 transition-transform duration-300 group-hover:-translate-y-1"
            style={{ background: bg }}
        >
            <LiveResumeThumbnail resume={resume} />
        </div>
    );

    return (
        <DashboardCard
            testId="dashboard-resume-card"
            preview={<>{preview}{membership.dialog}</>}
            title={title}
            description={description}
            tags={existingTags}
            infoLabel={updatedAtLabel}
            infoContent={<LastUpdatedTooltipContent label={updatedAtLabel} timestamp={resume.updatedAt} />}
            openLabel={openLabel}
            onOpen={onOpen}
            docId={resume.id}
            meta={letterCount > 0 ? (
                <button
                    type="button"
                    onClick={onShowLetters}
                    data-testid="dashboard-resume-letters"
                    title={t("dashboard.letterChipLabel", { count: letterCount })}
                    aria-label={t("dashboard.letterChipLabel", { count: letterCount })}
                    className="inline-flex items-center gap-1 rounded-lg border border-edge bg-surface-1/50 px-2 py-0.5 text-[11px] font-medium text-mid transition-colors hover:border-accent/40 hover:text-accent"
                >
                    <Mail className="h-3 w-3" aria-hidden="true" />
                    {letterCount}
                </button>
            ) : undefined}
            errorMessage={saveError}
            actions={[
                { label: t("dashboard.editMeta"), icon: Edit2, onClick: startEditingMeta },
                { label: t("dashboard.writeLetter"), icon: Mail, onClick: onWriteLetter },
                { label: t("dashboard.duplicateResume"), icon: Copy, onClick: onDuplicate },
                { label: t("templates.actions.download"), icon: Download, onClick: onDownload },
                ...(membership.item ? [{ label: membership.item.label, icon: FolderSync, onClick: membership.item.onClick }] : []),
                { label: t("dashboard.deleteResume"), icon: Trash2, onClick: onDelete, variant: "danger" as const },
            ]}
        >
            {isEditingMeta ? (
                <div className="rounded-[0.875rem] border border-edge bg-surface-1/85 p-3.5">
                    <label className="block text-[10px] font-medium uppercase tracking-wider text-faint">
                        {t("dashboard.metaTitle")}
                    </label>
                    <input
                        type="text"
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                void saveMeta();
                            }
                            if (event.key === "Escape") {
                                event.preventDefault();
                                cancelEditingMeta();
                            }
                        }}
                        className="mt-2 w-full rounded-xl border border-edge-strong bg-surface-3 px-3 py-2 text-sm font-semibold text-strong outline-none transition-colors placeholder:text-faint/50 focus:border-faint"
                        placeholder={t("dashboard.metaTitlePlaceholder")}
                    />

                    <label className="mt-3 block text-[10px] font-medium uppercase tracking-wider text-faint">
                        {t("dashboard.metaDescription")}
                    </label>
                    <textarea
                        value={draftDescription}
                        onChange={(event) => setDraftDescription(event.target.value)}
                        onKeyDown={(event) => {
                            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                                event.preventDefault();
                                void saveMeta();
                            }
                            if (event.key === "Escape") {
                                event.preventDefault();
                                cancelEditingMeta();
                            }
                        }}
                        rows={3}
                        className="mt-2 w-full resize-none rounded-xl border border-edge-strong bg-surface-3 px-3 py-2 text-xs leading-relaxed text-strong outline-none transition-colors placeholder:text-faint/50 focus:border-faint"
                        placeholder={t("dashboard.metaDescriptionPlaceholder")}
                    />

                    <label className="mt-3 block text-[10px] font-medium uppercase tracking-wider text-faint">
                        {t("dashboard.tags")}
                    </label>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-edge-strong bg-surface-3 px-2 py-1.5 focus-within:border-faint">
                        {draftTags.map((tag) => (
                            <span
                                key={tag}
                                className="inline-flex items-center gap-1 rounded-full border border-edge bg-surface-1 px-2 py-0.5 text-[11px] text-bright"
                            >
                                {tag}
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        removeTag(tag);
                                    }}
                                    className="text-faint transition-colors hover:text-strong"
                                    aria-label={t("saveTemplate.removeTag", { tag })}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                        <input
                            type="text"
                            value={draftTagInput}
                            onChange={(event) => setDraftTagInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
                                    if (draftTagInput.trim()) {
                                        event.preventDefault();
                                        commitTagInput();
                                    }
                                } else if (event.key === "Backspace" && !draftTagInput && draftTags.length > 0) {
                                    event.preventDefault();
                                    removeTag(draftTags[draftTags.length - 1]);
                                } else if (event.key === "Escape") {
                                    event.preventDefault();
                                    cancelEditingMeta();
                                }
                            }}
                            onBlur={() => commitTagInput()}
                            placeholder={draftTags.length === 0 ? t("dashboard.addTagPlaceholder") : ""}
                            className="min-w-[80px] flex-1 bg-transparent px-1 py-0.5 text-xs text-strong outline-none placeholder:text-faint/50"
                        />
                    </div>

                    <div className="mt-3 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={cancelEditingMeta}
                            className="rounded-lg border border-edge bg-surface-3 px-3 py-1.5 text-xs text-faint transition-colors hover:border-faint hover:text-strong"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={(event) => {
                                void saveMeta(event);
                            }}
                            className="rounded-lg border border-success-tint2 bg-success-tint px-3 py-1.5 text-xs text-success-soft transition-colors hover:border-success-line hover:text-strong"
                        >
                            <Check className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            ) : undefined}
        </DashboardCard>
    );
}

function DashboardSidebar({
    items,
    activeTab,
    onSelectTab,
    onCreateResume,
    onOpenWorkspace,
}: {
    items: DashboardNavItem[];
    activeTab: DashboardTab;
    onSelectTab: (tab: DashboardTab) => void;
    onCreateResume: () => void;
    onOpenWorkspace: () => void;
}) {
    const { t, locale } = useTranslation();
    const workspacePhase = useWorkspaceStore((state) => state.phase);
    const workspaceOtherTab = useWorkspaceStore((state) => state.phase === "connected" && !state.isLeader);
    const { isMobile, open, setOpenMobile } = useSidebar();
    const sidebarExpanded = open || isMobile;

    const selectTab = (tab: DashboardTab) => {
        onSelectTab(tab);
        setOpenMobile(false);
    };

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader className="h-[68px]">
                {sidebarExpanded ? (
                    <div className="flex items-center justify-between gap-2">
                        <Link
                            href={localizedPath("/", locale)}
                            className="flex min-w-0 items-center rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-4"
                            onClick={() => setOpenMobile(false)}
                            aria-label="EngineCV"
                        >
                            <Image
                                src="/logo.svg"
                                alt="EngineCV"
                                width={800}
                                height={600}
                                priority
                                style={{ width: "auto" }}
                                className="h-8 logo-adaptive"
                            />
                        </Link>
                        <SidebarTrigger className="inline-flex shrink-0" />
                    </div>
                ) : (
                    <div className="hidden h-full items-center justify-center md:flex">
                        <SidebarTrigger />
                    </div>
                )}
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className={sidebarExpanded ? undefined : "sr-only"}>{t("dashboard.navGroup")}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu data-testid="dashboard-sidebar-nav">
                            {items.map((item) => {
                                const ItemIcon = item.icon;
                                const isActive = activeTab === item.id;

                                return (
                                    <SidebarMenuItem key={item.id}>
                                        <SidebarMenuButton
                                            isActive={isActive}
                                            title={!sidebarExpanded ? item.label : undefined}
                                            aria-current={isActive ? "page" : undefined}
                                            aria-pressed={isActive}
                                            aria-label={!sidebarExpanded ? item.label : undefined}
                                            data-testid={`dashboard-sidebar-${item.id}`}
                                            className={sidebarExpanded ? undefined : "justify-center px-2"}
                                            onClick={() => selectTab(item.id)}
                                        >
                                            <ItemIcon
                                                className={`h-4 w-4 shrink-0 ${isActive ? "text-accent" : "text-current"}`}
                                                aria-hidden="true"
                                            />
                                            {sidebarExpanded && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                                            {sidebarExpanded && typeof item.count === "number" && item.count > 0 && (
                                                <SidebarMenuBadge
                                                    className={isActive ? "bg-surface-1 text-bright" : undefined}
                                                >
                                                    {item.count}
                                                </SidebarMenuBadge>
                                            )}
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="space-y-2">
                {/* The delete runs on the Your data page, which holds no live database queries. */}
                <div className={`flex gap-1 ${sidebarExpanded ? "flex-col" : "flex-col items-center"}`}>
                    <button
                        type="button"
                        onClick={onOpenWorkspace}
                        data-testid="dashboard-sidebar-workspace"
                        title={workspaceOtherTab ? t("workspace.otherTabShort") : !sidebarExpanded ? t("workspace.title") : undefined}
                        aria-label={!sidebarExpanded ? t("workspace.title") : undefined}
                        className={`relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-faint transition-colors hover:text-strong ${sidebarExpanded ? "justify-start" : "justify-center px-2"}`}
                    >
                        <FolderSync className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {sidebarExpanded && t("workspace.title")}
                        {workspacePhase === "connected" && !workspaceOtherTab && <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" data-testid="workspace-dot" />}
                        {(workspacePhase === "needs-permission" || workspaceOtherTab) && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" data-testid="workspace-dot" />}
                    </button>
                    {workspaceOtherTab && sidebarExpanded && <p role="status" className="px-3 text-[11px] leading-snug text-accent" data-testid="workspace-other-tab-note">{t("workspace.otherTabShort")}</p>}
                    <Link
                        href="/your-data"
                        data-testid="dashboard-sidebar-your-data"
                        title={!sidebarExpanded ? t("dashboard.navYourData") : undefined}
                        aria-label={!sidebarExpanded ? t("dashboard.navYourData") : undefined}
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-faint transition-colors hover:text-strong ${sidebarExpanded ? "justify-start" : "justify-center"}`}
                    >
                        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {sidebarExpanded && t("dashboard.navYourData")}
                    </Link>
                    <Link
                        href="/your-data?action=delete"
                        data-testid="dashboard-sidebar-delete-all-data"
                        title={!sidebarExpanded ? t("dashboard.deleteAllData") : undefined}
                        aria-label={!sidebarExpanded ? t("dashboard.deleteAllData") : undefined}
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-danger-soft transition-colors hover:text-danger ${sidebarExpanded ? "justify-start" : "justify-center"}`}
                    >
                        <Radiation className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {sidebarExpanded && t("dashboard.deleteAllData")}
                    </Link>
                </div>
                <button
                    type="button"
                    data-testid="dashboard-sidebar-new-resume"
                    title={!sidebarExpanded ? t("dashboard.newResume") : undefined}
                    aria-label={!sidebarExpanded ? t("dashboard.newResume") : undefined}
                    className={`flex w-full items-center gap-2 rounded-lg border border-edge bg-surface-3 px-3 py-2 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong ${sidebarExpanded ? "justify-start" : "justify-center"}`}
                    onClick={() => {
                        onCreateResume();
                        setOpenMobile(false);
                    }}
                >
                    <Plus className="h-4 w-4" />
                    {sidebarExpanded && t("dashboard.newResume")}
                </button>
            </SidebarFooter>
        </Sidebar>
    );
}

// ---------------------------------------------
// Dashboard Page
// ---------------------------------------------

export default function DashboardPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-surface-2" />}>
            <Dashboard />
        </Suspense>
    );
}

function Dashboard() {
    const { t, tn, locale } = useTranslation();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabQueryParam = searchParams?.get("tab") ?? null;
    const createNewResume = useResumeStore((state) => state.createNew);
    const resumes = useLiveQuery(async () => {
        const rows = await db.resumes.orderBy("updatedAt").reverse().toArray();
        return rows.map((row) => normalizeDashboardResume(row));
    });

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [activityDocId, setActivityDocId] = useState<string | null>(null);
    useEffect(() => {
        const open = (event: Event) => {
            setActivityDocId((event as CustomEvent<{ docId?: string }>).detail?.docId ?? null);
            setShowWorkspace(true);
        };
        window.addEventListener(OPEN_WORKSPACE_ACTIVITY_EVENT, open);
        return () => window.removeEventListener(OPEN_WORKSPACE_ACTIVITY_EVENT, open);
    }, []);

    // Restores a connected workspace folder (or says why there is none) once the dashboard is up.
    useEffect(() => {
        void ensureWorkspace();
    }, []);
    const [showExamplePicker, setShowExamplePicker] = useState(false);
    // The Import data window, with a file or source it should start from.
    const [hub, setHub] = useState<{ files?: File[]; source?: SourceId } | null>(null);
    const [fileDragActive, setFileDragActive] = useState(false);
    // The start path whose action is running (blank creation), and where focus goes for `?start=json`.
    const [pendingStart, setPendingStart] = useState<StartPathId | null>(null);
    const [startError, setStartError] = useState<string | null>(null);
    const [startFocusId, setStartFocusId] = useState<StartPathId | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
    const deleteUsage = useTrackerUsageNote(deleteTarget?.id);
    const cvUndo = useUndoSlot<{ snapshot: DeletedCvSnapshot; fileKept: boolean }>();
    const templateUndo = useUndoSlot<NonNullable<Awaited<ReturnType<typeof snapshotTemplateForUndo>>>>();
    // The letters linked to the CV being deleted; when there are any, a dialog decides what happens to them.
    const [deleteLetters, setDeleteLetters] = useState<LetterDocument[]>([]);
    const deleteHasFile = useHasWorkspaceFile(deleteTarget?.id);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteFailed, setDeleteFailed] = useState(false);
    // A CV that was just duplicated and has letters: the person may copy them onto the new one.
    const [copyOffer, setCopyOffer] = useState<{ fromId: string; toId: string; count: number } | null>(null);
    const [copyBusy, setCopyBusy] = useState(false);
    const [copyFailed, setCopyFailed] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importErrorDetails, setImportErrorDetails] = useState<string | null>(null);
    const [importWarning, setImportWarning] = useState<string | null>(null);
    // A data-export import reports a count, not adjusted values, so it gets no "adjusted" title.
    const [importWarningIsClamp, setImportWarningIsClamp] = useState(true);
    const [search, setSearch] = useState("");
    const dashboardPreferences = useClientPreferencesStore(
        (state) => state.preferences.dashboard,
    );
    const updateClientPreferenceSection = useClientPreferencesStore(
        (state) => state.updateSection,
    );
    const gridDensity = dashboardPreferences.density;
    const setGridDensity = useCallback((density: GridDensity) => {
        updateClientPreferenceSection("dashboard", { density });
    }, [updateClientPreferenceSection]);

    const pageSize = dashboardPreferences.pageSize;
    const setPageSize = useCallback((next: DashboardPageSize) => {
        updateClientPreferenceSection("dashboard", { pageSize: next });
    }, [updateClientPreferenceSection]);
    const setResumeSort = useCallback((next: DashboardSort) => {
        updateClientPreferenceSection("dashboard", { resumeSort: next });
    }, [updateClientPreferenceSection]);
    const [resumePage, setResumePage] = useState(1);

    const filteredResumes = useMemo(() => {
        if (!resumes) return [];
        const q = search.trim().toLowerCase();
        const matches = q
            ? resumes.filter(
                (r) =>
                    (r.meta.title || "").toLowerCase().includes(q) ||
                    (r.meta.description || "").toLowerCase().includes(q) ||
                    (r.basics.name || "").toLowerCase().includes(q) ||
                    (r.basics.headline || "").toLowerCase().includes(q) ||
                    (r.meta.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
            )
            : resumes;
        return sortDashboardItems(matches, dashboardPreferences.resumeSort, (r) => ({
            name: r.meta.title || r.basics.name || "",
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
        }));
    }, [resumes, search, dashboardPreferences.resumeSort]);
    const resumePageData = paginate(filteredResumes, resumePage, pageSize);

    const handleCreateBlank = useCallback(async (options?: { replace?: boolean }) => {
        setShowCreateModal(false);
        setStartError(null);
        setPendingStart("blank");
        try {
            const id = await createNewResume({ language: locale });
            // A `?start=blank` link replaces its history entry, so Back cannot create a second resume.
            if (options?.replace) router.replace(`/editor/${id}`);
            else router.push(`/editor/${id}`);
        } catch (error) {
            console.error("[EngineCV] Creating a resume failed.", error);
            setStartError(t("onboarding.panel.error"));
            setPendingStart(null);
        }
    }, [createNewResume, locale, router, setShowCreateModal, t]);

    const handleOpenGithubImport = useCallback(() => {
        setShowCreateModal(false);
        setHub({ source: "github" });
    }, [setHub, setShowCreateModal]);

    // LinkedIn, Europass and paste-from-AI start in the same window, each on its own tab.
    const openImportHub = useCallback((source?: SourceId) => {
        setShowCreateModal(false);
        setHub(source ? { source } : {});
    }, [setHub, setShowCreateModal]);
    const handleOpenImportHub = useCallback(() => openImportHub(), [openImportHub]);
    const handleOpenLinkedinImport = useCallback(() => openImportHub("linkedin"), [openImportHub]);
    const handleOpenEuropassImport = useCallback(() => openImportHub("europass"), [openImportHub]);
    const handleOpenPasteFromAi = useCallback(() => openImportHub("paste-ai"), [openImportHub]);

    const handleOpenExamplePicker = useCallback(() => {
        setShowCreateModal(false);
        setShowExamplePicker(true);
    }, [setShowCreateModal, setShowExamplePicker]);

    const handleStartSelect = useCallback((id: Exclude<StartPathId, "json">) => {
        switch (id) {
            case "blank": void handleCreateBlank(); break;
            case "example": handleOpenExamplePicker(); break;
            case "ai": handleOpenPasteFromAi(); break;
            case "linkedin": handleOpenLinkedinImport(); break;
            case "europass": handleOpenEuropassImport(); break;
            case "github": handleOpenGithubImport(); break;
        }
    }, [handleCreateBlank, handleOpenExamplePicker, handleOpenEuropassImport, handleOpenGithubImport, handleOpenLinkedinImport, handleOpenPasteFromAi]);

    // Any file (dropped, chosen, or from the toolbar) goes to the Import data window.
    const handleImportJson = useCallback(async (file: File) => {
        setShowCreateModal(false);
        setImportError(null);
        setImportErrorDetails(null);
        setImportWarning(null);
        setHub({ files: [file] });
    }, [setHub, setImportError, setImportErrorDetails, setImportWarning, setShowCreateModal]);

    // The window always creates new CVs on the dashboard; nothing existing is touched.
    const saveHubResume = useCallback(async (resume: Resume) => {
        const id = createId();
        const now = Date.now();
        await db.resumes.add({ ...resume, id, createdAt: now, updatedAt: now });
        return id;
    }, []);

    // A "Download my data" file: every CV in it becomes a new CV. Saved versions and templates stay in the file.
    const saveDataExportResumes = useCallback(async (resumes: Resume[], extras?: DataExportExtras) => {
        // CVs, letters and saved paragraphs go in together, so a failure leaves nothing half imported.
        const result = await importDataExport(resumes, extras);
        setImportWarningIsClamp(false);
        const cvText = tn("dashboard.importedDataExport", resumes.length);
        const letterText = result.lettersAdded > 0 ? " " + tn("dashboard.importedLetters", result.lettersAdded) : "";
        const orphanText = result.orphanedDrafts > 0 ? " " + tn("dashboard.importedLettersNoCv", result.orphanedDrafts) : "";
        setImportWarning(cvText + letterText + orphanText);
    }, [setImportWarning, tn]);

    const handleSaveMeta = useCallback(async (resumeId: string, meta: Resume["meta"]): Promise<string | void> => {
        const currentResume = resumes?.find((entry) => entry.id === resumeId);
        if (!currentResume) {
            return;
        }

        const now = Date.now();
        await db.resumes.put({
            ...currentResume,
            meta,
            createdAt: currentResume.createdAt || now,
            updatedAt: now,
        });
    }, [resumes]);

    const handleDuplicate = useCallback(async (sourceResume: Resume) => {
        const duplicateId = await duplicateResume(sourceResume, t("dashboard.copy"));
        // The letters stay with the original. Offer to copy them when there are any.
        const letters = sourceResume.id ? await listLettersForCv(sourceResume.id) : [];
        if (letters.length > 0 && sourceResume.id) {
            setCopyFailed(false);
            setCopyOffer({ fromId: sourceResume.id, toId: duplicateId, count: letters.length });
            return;
        }
        router.push(`/editor/${duplicateId}`);
    }, [router, t]);

    const finishCopyOffer = useCallback(async (copy: boolean) => {
        if (!copyOffer) return;
        if (copy) {
            setCopyBusy(true);
            setCopyFailed(false);
            try {
                await copyLettersToCv(copyOffer.fromId, copyOffer.toId);
            } catch {
                setCopyFailed(true);
                setCopyBusy(false);
                return;
            }
            setCopyBusy(false);
        }
        const target = copyOffer.toId;
        setCopyOffer(null);
        router.push(`/editor/${target}`);
    }, [copyOffer, router]);

    /** Asks about the CV's letters first (if it has any), then opens the right confirmation. */
    const requestDeleteResume = useCallback(async (target: { id: string; name: string }) => {
        setDeleteFailed(false);
        setDeleteLetters(await listLettersForCv(target.id));
        setDeleteTarget(target);
    }, []);

    const cancelDelete = useCallback(() => {
        setDeleteTarget(null);
        setDeleteLetters([]);
        setDeleteFailed(false);
    }, []);

    const confirmDeleteWithLetters = useCallback(async (decisions: DeletionDecision[]) => {
        if (!deleteTarget) return;
        setDeleteBusy(true);
        setDeleteFailed(false);
        try {
            const snapshot = await snapshotCvForUndo(deleteTarget.id);
            await retireBeforeDelete(deleteTarget.id, "keep-file").catch(() => undefined);
            await deleteCvWithLetters(deleteTarget.id, decisions);
            if (snapshot) cvUndo.offer({ snapshot, fileKept: true });
            cancelDelete();
        } catch {
            // Nothing was changed: the CV and every letter are as they were.
            setDeleteFailed(true);
        } finally {
            setDeleteBusy(false);
        }
    }, [deleteTarget, cancelDelete, cvUndo]);

    const handleDownloadResume = useCallback((resume: Resume) => {
        exportToJson(resume, getResumeExportFilename(resume));
    }, []);

    const handleDelete = useCallback(async (fileChoice: RetireChoice = "keep-file") => {
        if (!deleteTarget) return;
        try {
            const snapshot = await snapshotCvForUndo(deleteTarget.id);
            await retireBeforeDelete(deleteTarget.id, fileChoice).catch(() => undefined);
            await deleteCvWithLetters(deleteTarget.id, []);
            if (snapshot) cvUndo.offer({ snapshot, fileKept: fileChoice === "keep-file" });
            cancelDelete();
        } catch {
            // A draft appeared since the question was asked: show the letters dialog instead.
            setDeleteLetters(await listLettersForCv(deleteTarget.id));
        }
    }, [deleteTarget, cancelDelete, cvUndo]);

    const handleUndoCvDelete = useCallback(async () => {
        const pending = cvUndo.item;
        if (!pending) return;
        cvUndo.clear();
        await restoreDeletedCv(pending.snapshot, pending.fileKept).catch(() => undefined);
    }, [cvUndo]);

    const resumeCount = resumes?.length ?? 0;
    const hasResumes = resumeCount > 0;

    // A start link is about creating a CV, so it shows the resumes view for this visit.
    const [startLinkActive, setStartLinkActive] = useState(false);
    const runStartLink = useCallback((start: StartPathId, hasSavedResumes: boolean) => {
        setStartLinkActive(true);
        switch (start) {
            case "blank": void handleCreateBlank({ replace: true }); break;
            case "example": handleOpenExamplePicker(); break;
            case "ai": handleOpenPasteFromAi(); break;
            case "linkedin": handleOpenLinkedinImport(); break;
            case "europass": handleOpenEuropassImport(); break;
            case "github": handleOpenGithubImport(); break;
            case "json":
                // A file picker cannot open without a click: focus the JSON option instead.
                setStartFocusId("json");
                if (hasSavedResumes) setShowCreateModal(true);
                break;
        }
    }, [handleCreateBlank, handleOpenExamplePicker, handleOpenEuropassImport, handleOpenGithubImport, handleOpenLinkedinImport, handleOpenPasteFromAi, setShowCreateModal, setStartFocusId, setStartLinkActive]);

    // `?start=<path>` deep links (contracts/start-links.md). Read from the address
    // bar once, not through useSearchParams: production builds don't re-render it
    // after replaceState.
    const startLinkHandledRef = useRef(false);
    useEffect(() => {
        if (startLinkHandledRef.current) return;
        startLinkHandledRef.current = true;
        const start = parseStartParam(window.location.search);
        if (!start) return;
        // Gone from the URL before acting, so reload and Back never repeat it.
        window.history.replaceState(window.history.state, "", urlWithoutStartParam(window.location));
        void db.resumes.count().then((count) => runStartLink(start, count > 0));
    }, [runStartLink]);

    const letterCount = useLiveQuery(() => db.coverLetters.count(), []);
    const activeJobCount = useLiveQuery(() => db.jobApplications.filter((job) => job.trashedAt === null && job.archivedAt === null && !isTerminalStage(job.stage)).count(), []);
    const letterCountsByCv = useLiveQuery(async () => {
        const counts: Record<string, number> = {};
        await db.coverLetters.each((letter) => {
            if (letter.cvId) counts[letter.cvId] = (counts[letter.cvId] ?? 0) + 1;
        });
        return counts;
    }, []);
    /** The CV whose letters the Letters tab is limited to, set from a CV card. */
    const [letterCvFilter, setLetterCvFilter] = useState<string | null>(null);
    const userTemplates = useLiveQuery(async () => {
        const all = await db.templates.toArray();
        return all.sort((a, b) => b.updatedAt - a.updatedAt);
    }, []) ?? EMPTY_TEMPLATES;
    const builtinTemplates = useMemo(() => getBuiltinTemplates(), []);
    const [templateDeleteTarget, setTemplateDeleteTarget] = useState<{ id: string; name: string } | null>(null);
    const [templateImportError, setTemplateImportError] = useState<string | null>(null);
    const [templateSearch, setTemplateSearch] = useState("");
    const [activeTemplateDashboardTab, setActiveTemplateDashboardTab] = useState<TemplateDashboardTab>("all");

    const templateSort = dashboardPreferences.templateSort;
    const setTemplateSort = useCallback((next: DashboardSort) => {
        updateClientPreferenceSection("dashboard", { templateSort: next });
    }, [updateClientPreferenceSection]);
    const [builtinTemplatePage, setBuiltinTemplatePage] = useState(1);
    const [userTemplatePage, setUserTemplatePage] = useState(1);

    const filteredBuiltinTemplates = useMemo(() => {
        const q = templateSearch.trim().toLowerCase();
        const matches = q
            ? builtinTemplates.filter((template) => {
                const display = templateDisplayMeta(template, t);
                return [display.name, display.description, ...display.tags, template.meta.name, template.meta.description, ...template.meta.tags]
                    .some((value) => value.toLowerCase().includes(q));
            })
            : builtinTemplates;
        // Built-in templates have no real dates; the date orders keep the curated order.
        if (templateSort !== "name-asc" && templateSort !== "name-desc") return matches;
        return sortDashboardItems(matches, templateSort, (template) => ({ name: templateDisplayMeta(template, t).name }));
    }, [builtinTemplates, templateSearch, templateSort, t]);

    const filteredUserTemplates = useMemo(() => {
        const q = templateSearch.trim().toLowerCase();
        const matches = q
            ? userTemplates.filter((template) =>
                template.meta.name.toLowerCase().includes(q) ||
                template.meta.description.toLowerCase().includes(q) ||
                template.meta.tags.some((tag) => tag.toLowerCase().includes(q))
            )
            : userTemplates;
        return sortDashboardItems(matches, templateSort, (template) => ({
            name: template.meta.name,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
        }));
    }, [templateSearch, templateSort, userTemplates]);
    const builtinTemplatePageData = paginate(filteredBuiltinTemplates, builtinTemplatePage, pageSize);
    const userTemplatePageData = paginate(filteredUserTemplates, userTemplatePage, pageSize);

    const isValidTab = (value: string | null): value is DashboardTab =>
        value === "resumes" || value === "letters" || value === "jobs" || value === "templates";
    // A `?tab=` pin the user has since navigated away from. Production builds do
    // not re-render useSearchParams after the pin is removed from the URL (neither
    // router.replace nor history.replaceState), so the dismissal is tracked here
    // instead of trusting the query parameter to update.
    const [dismissedTabPin, setDismissedTabPin] = useState<string | null>(null);
    const activeDashboardTab = startLinkActive
        ? "resumes"
        : isValidTab(tabQueryParam) && tabQueryParam !== dismissedTabPin
            ? tabQueryParam
            : dashboardPreferences.activeTab;

    // Dropping a file anywhere on the Resumes tab imports it like Import JSON.
    // Keyboard users keep the Import button; this is an extra path, not the only one.
    useEffect(() => {
        if (activeDashboardTab !== "resumes") return;
        let depth = 0;
        const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
        const onEnter = (event: DragEvent) => {
            if (!hasFiles(event)) return;
            depth += 1;
            setFileDragActive(true);
        };
        const onOver = (event: DragEvent) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        };
        const onLeave = (event: DragEvent) => {
            if (!hasFiles(event)) return;
            depth = Math.max(0, depth - 1);
            if (depth === 0) setFileDragActive(false);
        };
        const onDrop = (event: DragEvent) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            depth = 0;
            setFileDragActive(false);
            const file = event.dataTransfer?.files[0];
            if (!file) return;
            if (!/\.(json|zip|csv|pdf|xml)$/i.test(file.name) && file.type !== "application/json") {
                setImportWarning(null);
                setImportErrorDetails(null);
                setImportError(t("authoring.drop.unsupported"));
                return;
            }
            void handleImportJson(file);
        };
        window.addEventListener("dragenter", onEnter);
        window.addEventListener("dragover", onOver);
        window.addEventListener("dragleave", onLeave);
        window.addEventListener("drop", onDrop);
        return () => {
            window.removeEventListener("dragenter", onEnter);
            window.removeEventListener("dragover", onOver);
            window.removeEventListener("dragleave", onLeave);
            window.removeEventListener("drop", onDrop);
            setFileDragActive(false);
        };
    }, [activeDashboardTab, handleImportJson, setImportError, setImportErrorDetails, setImportWarning, t]);

    const setActiveDashboardTab = (tab: DashboardTab) => {
        setStartLinkActive(false);
        if (tab !== "letters") setLetterCvFilter(null);
        updateClientPreferenceSection("dashboard", { activeTab: tab });
        const next = urlAfterDashboardTabSelect(window.location, tab);
        if (!next) return;
        setDismissedTabPin(new URLSearchParams(window.location.search).get("tab"));
        window.history.replaceState(window.history.state, "", next);
    };

    const showLettersFor = (cvId: string) => {
        setLetterCvFilter(cvId);
        setActiveDashboardTab("letters");
    };

    const handleWriteLetter = async (cvId: string) => {
        try {
            const letter = await createLetterRecord(cvId);
            router.push(`/letters/${letter.id}`);
        } catch (cause) {
            console.error("[EngineCV] Could not create a cover letter.", cause);
            setImportError(t("dashboard.letters.createError"));
        }
    };

    const dashboardTabs: DashboardNavItem[] = [
        { id: "resumes", label: t("dashboard.tabResumes"), icon: FileText, count: resumeCount },
        { id: "letters", label: t("dashboard.tabCoverLetters"), icon: Mail, count: letterCount ?? 0 },
        { id: "jobs", label: t("dashboard.tabJobs"), icon: Briefcase, count: activeJobCount ?? 0 },
        { id: "templates", label: t("dashboard.tabTemplates"), icon: LayoutTemplate, count: userTemplates.length },
    ];

    const handleCreateBlankTemplate = async () => {
        const id = await useResumeStore.getState().createNewTemplate({ name: t("dashboard.untitledTemplate") });
        router.push(`/templates/${id}`);
    };

    const handleDeleteTemplate = useCallback(async () => {
        if (!templateDeleteTarget) return;
        const row = await snapshotTemplateForUndo(templateDeleteTarget.id);
        await db.templates.delete(templateDeleteTarget.id);
        if (row) templateUndo.offer(row);
        setTemplateDeleteTarget(null);
    }, [setTemplateDeleteTarget, templateDeleteTarget, templateUndo]);

    const handleUndoTemplateDelete = useCallback(async () => {
        const row = templateUndo.item;
        if (!row) return;
        templateUndo.clear();
        await restoreDeletedTemplate(row).catch(() => undefined);
    }, [templateUndo]);

    const handleDuplicateTemplate = useCallback(async (template: TemplateDocument) => {
        const id = createId();
        const now = Date.now();
        const copy: TemplateDocument = {
            ...template,
            id,
            meta: {
                ...template.meta,
                name: `${template.meta.name} (${t("dashboard.copy")})`,
                source: "user",
                basedOnTemplateId: template.id,
            },
            createdAt: now,
            updatedAt: now,
        };
        await db.templates.put(copy);
    }, [t]);

    const handleDownloadTemplate = (template: TemplateDocument) => {
        const blob = new Blob([exportTemplateToJson(template)], { type: "application/json" });
        const safe = template.meta.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        downloadBlob(blob, `${safe || "template"}-template.json`);
    };

    const handleImportTemplate = async (file: File) => {
        try {
            const text = await file.text();
            const imported = importTemplateFromJsonText(text);
            const id = createId();
            const now = Date.now();
            const validated = templateDocumentSchema.parse({
                ...imported,
                id,
                meta: { ...imported.meta, source: "user" },
                createdAt: now,
                updatedAt: now,
            });
            await db.templates.put(validated);
            setTemplateImportError(null);
        } catch (e) {
            console.error(e);
            setTemplateImportError(e instanceof Error ? e.message : "Template import failed.");
        }
    };

    return (
        <SidebarProvider className="min-h-screen bg-surface-2 text-strong font-[family-name:var(--font-geist-sans)]">
            <DashboardSidebar
                items={dashboardTabs}
                activeTab={activeDashboardTab}
                onSelectTab={setActiveDashboardTab}
                onCreateResume={() => setShowCreateModal(true)}
                onOpenWorkspace={() => { setActivityDocId(null); setShowWorkspace(true); }}
            />
            {showWorkspace && <WorkspacePanel initialActivityDocId={activityDocId} onClose={() => { setShowWorkspace(false); setActivityDocId(null); }} />}

            <SidebarInset className="relative bg-surface-2">
                <div className="w-full pb-8">

                    <main className="min-w-0">
                        {/* Resumes tab */}
                        {activeDashboardTab === "resumes" && (
                            <>
                                <nav className={DASHBOARD_NAV_CLASS}>
                                    <div className="relative mx-auto flex h-full w-full max-w-7xl items-center gap-2 px-4 py-3 sm:px-6 md:py-0 lg:px-8">
                                        <SidebarTrigger className="h-10 w-10 shrink-0 rounded-xl md:hidden" />

                                        {hasResumes ? (
                                            <div className="flex items-center gap-2">
                                                <NavSearch
                                                    value={search}
                                                    onChange={(value) => {
                                                        setSearch(value);
                                                        setResumePage(1);
                                                    }}
                                                    placeholder={t("dashboard.search")}
                                                />
                                                <SortSelect
                                                    value={dashboardPreferences.resumeSort}
                                                    options={DASHBOARD_SORTS}
                                                    onChange={(value) => {
                                                        setResumeSort(value);
                                                        setResumePage(1);
                                                    }}
                                                    testId="dashboard-resume-sort"
                                                />
                                                <PageSizeSelect
                                                    value={pageSize}
                                                    onChange={(value) => {
                                                        setPageSize(value);
                                                        setResumePage(1);
                                                    }}
                                                    testId="dashboard-resume-page-size"
                                                />
                                                <div className="hidden items-center gap-1 rounded-xl border border-edge bg-surface-4 p-1 sm:flex">
                                                    {(["large", "normal", "compact"] as const).map((density) => {
                                                        const DensityIcon = {
                                                            large: LayoutGrid,
                                                            normal: Grid2X2,
                                                            compact: Grid3X3,
                                                        }[density];
                                                        const isActive = gridDensity === density;
                                                        return (
                                                            <button
                                                                key={density}
                                                                type="button"
                                                                onClick={() => setGridDensity(density)}
                                                                title={t("dashboard.densityTitle", { density: t(density === "large" ? "palette.optionLarge" : density === "compact" ? "palette.optionCompact" : "palette.optionNormal") })}
                                                                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                                                                    isActive
                                                                        ? "bg-edge text-accent shadow-sm"
                                                                        : "text-faint hover:text-strong"
                                                                }`}
                                                            >
                                                                <DensityIcon className="h-4 w-4" />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            <h1 className="text-sm font-semibold text-strong">{t("dashboard.title")}</h1>
                                        )}

                                        <div className="ml-auto flex items-center gap-2">
                                            <label
                                                title={t("dashboard.importResume")}
                                                aria-label={t("dashboard.importResume")}
                                                className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-edge px-3 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                                            >
                                                <Upload className="h-4 w-4" />
                                                <span className="hidden lg:inline">{t("dashboard.import")}</span>
                                                <input
                                                    type="file"
                                                    accept=".json,.zip,.csv,.pdf,.xml,application/json"
                                                    className="hidden"
                                                    data-testid="dashboard-import-resume-input"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleImportJson(file);
                                                        e.target.value = "";
                                                    }}
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setShowCreateModal(true)}
                                                data-testid="dashboard-new-resume"
                                                title={t("dashboard.newResume")}
                                                aria-label={t("dashboard.newResume")}
                                                className="flex h-10 items-center gap-2 rounded-xl bg-accent px-3 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-soft"
                                            >
                                                <Plus className="h-4 w-4" />
                                                <span className="hidden sm:inline">{t("dashboard.newShort")}</span>
                                            </button>
                                            <ThemeToggle />
                                            <LanguageSwitcher compact />
                                        </div>
                                    </div>
                                </nav>

                                <div className={`${DASHBOARD_CONTENT_CLASS} pt-8`}>
                                {/* Error banner */}
                                {importError && (
                                    <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-danger-soft text-sm flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p>{importError}</p>
                                            {importErrorDetails && (
                                                <details className="mt-3 rounded-lg border border-red-500/20 bg-black/20">
                                                    <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-danger-soft hover:text-strong">
                                                        {t("export.importErrorDetails")}
                                                    </summary>
                                                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-red-500/20 px-3 py-2 text-[11px] leading-5 text-danger-soft">
                                                        {importErrorDetails}
                                                    </pre>
                                                </details>
                                            )}
                                        </div>
                                        <button onClick={() => {
                                            setImportError(null);
                                            setImportErrorDetails(null);
                                        }} className="text-danger hover:text-strong transition-colors shrink-0">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                {/* Clamped values warning */}
                                {importWarning && (
                                    <div className="mb-6 p-4 rounded-xl border border-accent/30 bg-accent/10 text-accent-soft text-sm flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-accent" />
                                        <div className="flex-1">
                                            {importWarningIsClamp && <p className="font-medium text-accent mb-1">{t("dashboard.importClampedTitle")}</p>}
                                            <p className="whitespace-pre-wrap text-xs text-accent-soft/80">{importWarning}</p>
                                        </div>
                                        <button onClick={() => setImportWarning(null)} className="text-accent hover:text-strong transition-colors shrink-0">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                {resumes === undefined ? (
                                    <div className={`grid ${GRID_DENSITY_CLASS[gridDensity]} gap-5`}>
                                        {Array.from({ length: 6 }).map((_, i) => (
                                            <div key={i} className="flex flex-col rounded-2xl border border-edge bg-surface-4/80 p-4">
                                                <Skeleton className="aspect-[794/1123] w-full max-w-[280px] mx-auto rounded-xl" />
                                                <div className="mt-6 px-1 space-y-3">
                                                    <div className="flex justify-between items-start gap-4">
                                                        <Skeleton className="h-5 w-2/3 rounded-lg" />
                                                        <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                                                    </div>
                                                    <Skeleton className="h-4 w-full rounded-lg" />
                                                    <Skeleton className="h-4 w-5/6 rounded-lg" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : !hasResumes ? (
                                    <StartPanel
                                        onSelect={handleStartSelect}
                                        onImportJson={handleImportJson}
                                        focusId={startFocusId}
                                        pendingId={pendingStart}
                                        error={startError}
                                    />
                                ) : (
                                    <>
                                        <div className={`grid ${GRID_DENSITY_CLASS[gridDensity]} gap-5`}>
                                            <button
                                                type="button"
                                                onClick={() => setShowCreateModal(true)}
                                                className="group flex min-h-[250px] w-full flex-col items-center justify-center rounded-[1.25rem] border-2 border-dashed border-edge transition-all cursor-pointer hover:border-accent/40 hover:bg-accent/[0.03]"
                                            >
                                                <div className="h-12 w-12 rounded-full bg-surface-4 border border-edge group-hover:bg-accent/10 group-hover:border-accent/30 flex items-center justify-center mb-3 transition-colors">
                                                    <Plus className="w-5 h-5 text-faint group-hover:text-accent transition-colors" />
                                                </div>
                                                <span className="text-sm font-medium text-faint group-hover:text-strong transition-colors">
                                                    {t("dashboard.newResume")}
                                                </span>
                                            </button>

                                            {resumePageData.items.map((resume) => (
                                                <ResumeCard
                                                    key={resume.id}
                                                    resume={resume}
                                                    onSaveMeta={(meta) => handleSaveMeta(resume.id!, meta)}
                                                    onOpen={() => router.push(`/editor/${resume.id}`)}
                                                    onDuplicate={() => handleDuplicate(resume)}
                                                    onDownload={() => handleDownloadResume(resume)}
                                                    letterCount={letterCountsByCv?.[resume.id!] ?? 0}
                                                    onShowLetters={() => showLettersFor(resume.id!)}
                                                    onWriteLetter={() => void handleWriteLetter(resume.id!)}
                                                    onDelete={() =>
                                                        void requestDeleteResume({
                                                            id: resume.id!,
                                                            name: resume.meta.title || resume.basics.name || t("dashboard.untitled"),
                                                        })
                                                    }
                                                />
                                            ))}
                                        </div>

                                        <Pager
                                            page={resumePageData.page}
                                            pageCount={resumePageData.pageCount}
                                            onChange={setResumePage}
                                            testId="dashboard-resume-pager"
                                        />

                                        {search && filteredResumes.length === 0 && (
                                            <div className="text-center py-16">
                                                <p className="text-faint text-sm">
                                                    {t("dashboard.noMatch", { query: search })}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                                </div>
                            </>
                        )}

                        {/* Cover Letters tab */}
                        {activeDashboardTab === "letters" && (
                            <LettersTab
                                onCreateCv={() => setShowCreateModal(true)}
                                gridClass={GRID_DENSITY_CLASS[gridDensity]}
                                density={gridDensity}
                                onDensityChange={setGridDensity}
                                cvFilter={letterCvFilter}
                                onClearCvFilter={() => setLetterCvFilter(null)}
                                navLead={<SidebarTrigger className="h-10 w-10 shrink-0 rounded-xl md:hidden" />}
                                navTrail={<><ThemeToggle /><LanguageSwitcher compact /></>}
                            />
                        )}

                        {/* Job Tracker tab */}
                        {activeDashboardTab === "jobs" && (
                            <JobsTab
                                navLead={<SidebarTrigger className="h-10 w-10 shrink-0 rounded-xl md:hidden" />}
                                navTrail={<><ThemeToggle /><LanguageSwitcher compact /></>}
                            />
                        )}

                        {/* Templates tab */}
                        {activeDashboardTab === "templates" && (
                            <>
                                <Tabs
                                    value={activeTemplateDashboardTab}
                                    onValueChange={(value) => setActiveTemplateDashboardTab(value as TemplateDashboardTab)}
                                    data-tabs-root
                                >
                                    <nav className={DASHBOARD_NAV_CLASS}>
                                        <div className="relative mx-auto flex h-full w-full max-w-7xl items-center gap-2 px-4 py-3 sm:px-6 md:py-0 lg:px-8">
                                            <SidebarTrigger className="h-10 w-10 shrink-0 rounded-xl md:hidden" />

                                            <NavSearch
                                                value={templateSearch}
                                                onChange={(value) => {
                                                    setTemplateSearch(value);
                                                    setBuiltinTemplatePage(1);
                                                    setUserTemplatePage(1);
                                                }}
                                                placeholder={t("dashboard.searchTemplates")}
                                                testId="dashboard-template-search"
                                                overlayContent={
                                                    <div className="flex items-center gap-2">
                                                        <TemplateFilterMenu
                                                            value={activeTemplateDashboardTab}
                                                            onChange={setActiveTemplateDashboardTab}
                                                            builtinCount={filteredBuiltinTemplates.length}
                                                            userCount={filteredUserTemplates.length}
                                                        />
                                                        <div className="flex items-center gap-1 rounded-xl border border-edge bg-surface-4 p-1">
                                                            {(["large", "normal", "compact"] as const).map((density) => {
                                                                const DensityIcon = {
                                                                    large: LayoutGrid,
                                                                    normal: Grid2X2,
                                                                    compact: Grid3X3,
                                                                }[density];
                                                                const isActive = gridDensity === density;
                                                                return (
                                                                    <button
                                                                        key={density}
                                                                        type="button"
                                                                        onClick={() => setGridDensity(density)}
                                                                        title={t("dashboard.densityTitle", { density: t(density === "large" ? "palette.optionLarge" : density === "compact" ? "palette.optionCompact" : "palette.optionNormal") })}
                                                                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                                                                            isActive
                                                                                ? "bg-edge text-accent shadow-sm"
                                                                                : "text-faint hover:text-strong"
                                                                        }`}
                                                                    >
                                                                        <DensityIcon className="h-4 w-4" />
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                }
                                            />

                                            <TemplateFilterMenu
                                                value={activeTemplateDashboardTab}
                                                onChange={setActiveTemplateDashboardTab}
                                                builtinCount={filteredBuiltinTemplates.length}
                                                userCount={filteredUserTemplates.length}
                                                className="hidden sm:flex"
                                            />

                                            <SortSelect
                                                value={templateSort}
                                                options={activeTemplateDashboardTab === "builtin" ? ["updated", "name-asc", "name-desc"] : DASHBOARD_SORTS}
                                                updatedLabel={activeTemplateDashboardTab === "builtin" ? t("dashboard.sort.recommended") : undefined}
                                                onChange={(value) => {
                                                    setTemplateSort(value);
                                                    setBuiltinTemplatePage(1);
                                                    setUserTemplatePage(1);
                                                }}
                                                testId="dashboard-template-sort"
                                            />
                                            <PageSizeSelect
                                                value={pageSize}
                                                onChange={(value) => {
                                                    setPageSize(value);
                                                    setBuiltinTemplatePage(1);
                                                    setUserTemplatePage(1);
                                                }}
                                                testId="dashboard-template-page-size"
                                            />

                                            <div className="hidden items-center gap-1 rounded-xl border border-edge bg-surface-4 p-1 sm:flex">
                                                {(["large", "normal", "compact"] as const).map((density) => {
                                                    const DensityIcon = {
                                                        large: LayoutGrid,
                                                        normal: Grid2X2,
                                                        compact: Grid3X3,
                                                    }[density];
                                                    const isActive = gridDensity === density;
                                                    return (
                                                        <button
                                                            key={density}
                                                            type="button"
                                                            onClick={() => setGridDensity(density)}
                                                            title={t("dashboard.densityTitle", { density: t(density === "large" ? "palette.optionLarge" : density === "compact" ? "palette.optionCompact" : "palette.optionNormal") })}
                                                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                                                                isActive
                                                                    ? "bg-edge text-accent shadow-sm"
                                                                    : "text-faint hover:text-strong"
                                                            }`}
                                                        >
                                                            <DensityIcon className="h-4 w-4" />
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="ml-auto flex items-center gap-2">
                                                <label
                                                    title={t("dashboard.importTemplate")}
                                                    aria-label={t("dashboard.importTemplate")}
                                                    className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-edge px-3 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                                                >
                                                    <Upload className="h-4 w-4" />
                                                    <span className="hidden lg:inline">{t("dashboard.import")}</span>
                                                    <input
                                                        type="file"
                                                        accept="application/json,.json"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleImportTemplate(file);
                                                            e.target.value = "";
                                                        }}
                                                    />
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={handleCreateBlankTemplate}
                                                    title={t("dashboard.newTemplate")}
                                                    aria-label={t("dashboard.newTemplate")}
                                                    className="flex h-10 items-center gap-2 rounded-xl bg-accent px-3 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-soft"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    <span className="hidden lg:inline">{t("dashboard.newTemplate")}</span>
                                                </button>
                                                <ThemeToggle />
                                                <LanguageSwitcher compact />
                                            </div>
                                        </div>
                                    </nav>

                                    <div className={`${DASHBOARD_CONTENT_CLASS} pt-8`}>
                                    {templateImportError && (
                                        <div className="mb-4 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger-soft">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                            <div className="flex-1">{templateImportError}</div>
                                            <button onClick={() => setTemplateImportError(null)} className="text-danger-soft hover:text-strong">
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}

                                    <TabsContent value="all">
                                        <div className="space-y-12" data-testid="dashboard-template-overview">
                                            <TemplateOverviewSection
                                                testId="dashboard-overview-user"
                                                title={t("dashboard.yourTemplates")}
                                                total={filteredUserTemplates.length}
                                                onSeeAll={() => setActiveTemplateDashboardTab("user")}
                                            >
                                                {filteredUserTemplates.length === 0 ? (
                                                    <div className="flex flex-col items-center gap-2 rounded-[1.25rem] border border-dashed border-edge p-8 text-center text-faint">
                                                        <LayoutTemplate className="h-7 w-7" />
                                                        {templateSearch.trim() ? (
                                                            <p className="text-sm">{t("dashboard.noSavedTemplatesMatch", { query: templateSearch })}</p>
                                                        ) : (
                                                            <>
                                                                <p className="text-sm">{t("dashboard.noSavedTemplates")}</p>
                                                                <p className="text-xs">{t("dashboard.noSavedTemplatesHint")}</p>
                                                            </>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className={`grid ${GRID_DENSITY_CLASS[gridDensity]} gap-5`}>
                                                        {filteredUserTemplates.slice(0, TEMPLATE_OVERVIEW_COUNT[gridDensity]).map((template) => (
                                                            <DashboardTemplateCard
                                                                key={template.id}
                                                                template={template}
                                                                onDuplicate={() => handleDuplicateTemplate(template)}
                                                                onDownload={() => handleDownloadTemplate(template)}
                                                                onEdit={() => router.push(`/templates/${template.id}`)}
                                                                onDelete={() =>
                                                                    setTemplateDeleteTarget({
                                                                        id: template.id,
                                                                        name: template.meta.name || t("dashboard.untitledTemplate"),
                                                                    })
                                                                }
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </TemplateOverviewSection>

                                            <TemplateOverviewSection
                                                testId="dashboard-overview-builtin"
                                                title={t("dashboard.builtinTemplates")}
                                                total={filteredBuiltinTemplates.length}
                                                onSeeAll={() => setActiveTemplateDashboardTab("builtin")}
                                            >
                                                {filteredBuiltinTemplates.length === 0 ? (
                                                    <div className="rounded-[1.25rem] border border-dashed border-edge p-8 text-center text-sm text-faint">
                                                        {t("dashboard.noBuiltinTemplatesMatch", { query: templateSearch })}
                                                    </div>
                                                ) : (
                                                    <div className={`grid ${GRID_DENSITY_CLASS[gridDensity]} gap-5`}>
                                                        {filteredBuiltinTemplates.slice(0, TEMPLATE_OVERVIEW_COUNT[gridDensity]).map((template) => (
                                                            <DashboardTemplateCard
                                                                key={template.id}
                                                                template={template}
                                                                onDuplicate={() => handleDuplicateTemplate(template)}
                                                                onDownload={() => handleDownloadTemplate(template)}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </TemplateOverviewSection>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="builtin">
                                        <BackToAllTemplates onClick={() => setActiveTemplateDashboardTab("all")} />
                                        {filteredBuiltinTemplates.length === 0 ? (
                                            <div className="rounded-[1.25rem] border border-dashed border-edge p-10 text-center text-sm text-faint">
                                                {t("dashboard.noBuiltinTemplatesMatch", { query: templateSearch })}
                                            </div>
                                        ) : (
                                            <div
                                                data-testid="dashboard-builtin-template-grid"
                                                className={`grid ${GRID_DENSITY_CLASS[gridDensity]} gap-5`}
                                            >
                                                {builtinTemplatePageData.items.map((template) => (
                                                    <DashboardTemplateCard
                                                        key={template.id}
                                                        template={template}
                                                        onDuplicate={() => handleDuplicateTemplate(template)}
                                                        onDownload={() => handleDownloadTemplate(template)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        <Pager
                                            page={builtinTemplatePageData.page}
                                            pageCount={builtinTemplatePageData.pageCount}
                                            onChange={setBuiltinTemplatePage}
                                            testId="dashboard-builtin-template-pager"
                                        />
                                    </TabsContent>

                                    <TabsContent value="user">
                                        <BackToAllTemplates onClick={() => setActiveTemplateDashboardTab("all")} />
                                        {filteredUserTemplates.length === 0 ? (
                                            <div className="flex flex-col items-center gap-2 rounded-[1.25rem] border border-dashed border-edge p-10 text-center text-faint">
                                                <LayoutTemplate className="h-8 w-8" />
                                                {templateSearch.trim() ? (
                                                    <p className="text-sm">{t("dashboard.noSavedTemplatesMatch", { query: templateSearch })}</p>
                                                ) : (
                                                    <>
                                                        <p className="text-sm">{t("dashboard.noSavedTemplates")}</p>
                                                        <p className="text-xs">{t("dashboard.noSavedTemplatesHint")}</p>
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <div
                                                data-testid="dashboard-user-template-grid"
                                                className={`grid ${GRID_DENSITY_CLASS[gridDensity]} gap-5`}
                                            >
                                                {userTemplatePageData.items.map((template) => (
                                                    <DashboardTemplateCard
                                                        key={template.id}
                                                        template={template}
                                                        onDuplicate={() => handleDuplicateTemplate(template)}
                                                        onDownload={() => handleDownloadTemplate(template)}
                                                        onEdit={() => router.push(`/templates/${template.id}`)}
                                                        onDelete={() =>
                                                            setTemplateDeleteTarget({
                                                                id: template.id,
                                                                name: template.meta.name || t("dashboard.untitledTemplate"),
                                                            })
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        <Pager
                                            page={userTemplatePageData.page}
                                            pageCount={userTemplatePageData.pageCount}
                                            onChange={setUserTemplatePage}
                                            testId="dashboard-user-template-pager"
                                        />
                                    </TabsContent>
                                    </div>
                                </Tabs>
                            </>
                        )}
                    </main>
            </div>

            {/* Create modal */}
            <CreateModal
                open={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false);
                    setStartFocusId(null);
                }}
                onSelect={handleStartSelect}
                onImportJson={handleImportJson}
                focusId={startFocusId}
            />

            {showExamplePicker && (
                <ExamplePickerDialog open onClose={() => setShowExamplePicker(false)} />
            )}

            {fileDragActive && (
                <div
                    aria-hidden="true"
                    data-testid="dashboard-drop-overlay"
                    className="pointer-events-none fixed inset-0 z-[230] flex items-center justify-center bg-surface-2/80 p-6 backdrop-blur-sm"
                >
                    <div className="rounded-2xl border-2 border-dashed border-accent/60 bg-surface-4 px-8 py-10 text-center shadow-2xl">
                        <Upload className="mx-auto h-8 w-8 text-accent" />
                        <p className="mt-3 text-base font-semibold text-strong">{t("authoring.drop.overlay")}</p>
                        <p className="mt-1 text-sm text-dim">{t("authoring.drop.overlayHint")}</p>
                    </div>
                </div>
            )}

            {hub && (
                <ImportDataDialog
                    current={createEmptyResume()}
                    target="new"
                    initialFiles={hub.files}
                    initialSource={hub.source}
                    onCreateNew={saveHubResume}
                    onImportDataExport={saveDataExportResumes}
                    onOpenCreated={(id) => router.push(`/editor/${id}`)}
                    onClose={() => setHub(null)}
                />
            )}

            {/* Delete confirmation */}
            <ConfirmModal
                open={!!deleteTarget && deleteLetters.length === 0 && !deleteHasFile}
                title={t("dashboard.deleteTitle")}
                description={[t("dashboard.deleteConfirm", { name: deleteTarget?.name ?? "" }), deleteUsage].filter(Boolean).join(" ")}
                confirmLabel={t("dashboard.deletePermanently")}
                destructive
                onConfirm={() => void handleDelete()}
                onCancel={cancelDelete}
            />
            {!!deleteTarget && deleteLetters.length === 0 && deleteHasFile && (
                <DeleteDocumentDialog
                    name={deleteTarget.name}
                    description={[t("dashboard.deleteConfirm", { name: deleteTarget.name }), deleteUsage].filter(Boolean).join(" ")}
                    confirmLabel={t("dashboard.deletePermanently")}
                    onConfirm={(choice) => void handleDelete(choice)}
                    onCancel={cancelDelete}
                />
            )}

            {/* The CV has letters: nothing is deleted with it; each draft is moved or frozen first. */}
            {deleteTarget && deleteLetters.length > 0 && (
                <DeleteCvDialog
                    cvName={deleteTarget.name}
                    letters={deleteLetters}
                    otherCvs={(resumes ?? []).filter((resume) => resume.id !== deleteTarget.id).map((resume) => ({ id: resume.id!, label: resume.meta.title || resume.basics.name || t("dashboard.untitled") }))}
                    busy={deleteBusy}
                    error={deleteFailed}
                    onConfirm={(decisions) => void confirmDeleteWithLetters(decisions)}
                    onCancel={cancelDelete}
                />
            )}

            {copyOffer && (
                <CopyLettersDialog count={copyOffer.count} busy={copyBusy} error={copyFailed} onCopy={() => void finishCopyOffer(true)} onSkip={() => void finishCopyOffer(false)} />
            )}

            {/* Template delete confirmation */}
            <ConfirmModal
                open={!!templateDeleteTarget}
                title={t("dashboard.deleteTemplateTitle")}
                description={t("dashboard.deleteTemplateConfirm", { name: templateDeleteTarget?.name ?? "" })}
                confirmLabel={t("dashboard.deleteTemplatePermanently")}
                destructive
                onConfirm={handleDeleteTemplate}
                onCancel={() => setTemplateDeleteTarget(null)}
            />

            {cvUndo.item && <UndoToast message={t("dashboard.resumeDeleted")} undoLabel={t("dashboard.undo")} onUndo={() => void handleUndoCvDelete()} testId="cv-undo" />}
            {templateUndo.item && <UndoToast message={t("dashboard.templateDeleted")} undoLabel={t("dashboard.undo")} onUndo={() => void handleUndoTemplateDelete()} testId="template-undo" />}

            </SidebarInset>
        </SidebarProvider>
    );
}
