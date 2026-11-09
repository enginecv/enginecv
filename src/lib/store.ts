import { create } from "zustand";
import { requestJsonEditorLeave } from "./editor-json-session";
import { type Resume, type AIMessage, type AICheckpoint, type DesignElement, type SectionStyleKey, type SectionStyleOverride, createEmptyResume, normalizeSkillGroups, resumeSchema } from "./schema";
import { type ResumeHistoryTrigger } from "./db";
import { db } from "./db";
import { recordResumeHistory } from "./history";
import { createId } from "./id";
import {
    createDesignElement,
    duplicateDesignElement,
    getNextDesignZIndex,
    moveDesignElementLayer,
    normalizeDesignElementOrder,
} from "./design";
import {
    templateDocumentSchema,
    type TemplateDocument,
    type TemplateMeta,
    TEMPLATE_DOCUMENT_VERSION,
} from "./templates/template-schema";
import { getBuiltinTemplateById, getTemplatePreviewOptions, isBuiltinTemplateId } from "./templates/enginecv-templates";
import { applyTemplateToResume } from "./templates/template-apply";
import { getSampleResumeForTemplatePreview } from "./templates/template-preview";
import { mergeCustomizationValue, withoutSectionStyleOverride } from "./customization";

interface AIProposal {
    id: string;
    path: string;
    next: unknown;
}
type AIChatMode = "auto" | "plan" | "content" | "customization";
export type SidebarTab = "content" | "customize" | "json";
export type EditorDocumentMode = "resume" | "template";
export interface CustomizeNavigationRequest {
    scope: "resume" | "section";
    panel: string | null;
    section?: string;
}
export interface ContentNavigationRequest {
    section: string;
    mode: "open" | "add";
    entryIndex?: number | null;
}
export interface ContentSelection {
    section: string;
    entryIndex: number | null;
}
export type PreviewCommand =
    | { type: "zoomIn" }
    | { type: "zoomOut" }
    | { type: "resetView" }
    | { type: "toggleFullscreen" }
    | { type: "setZoom"; value: number };

interface ResumeStore {
    activeResumeId: string | null;
    resume: Resume;
    isSaving: boolean;
    isDirty: boolean;
    lastSavedAt: number | null;
    paperSize: 'a4' | 'letter';
    aiProposals: AIProposal[];
    aiChatMode: AIChatMode;
    sidebarTab: SidebarTab;
    customizeScope: "resume" | "section";
    // Preview -> sidebar navigation request.
    pendingEditorNav: { section: string; entryIndex: number | null } | null;
    // Command palette -> content sidebar navigation request.
    pendingContentNav: ContentNavigationRequest | null;
    selectedContentTarget: ContentSelection | null;
    pendingCustomizeNav: CustomizeNavigationRequest | null;
    selectedCustomizeSection: string | null;
    selectedDesignElementId: string | null;
    pendingPreviewCommand: { requestId: number; command: PreviewCommand } | null;
    previewCommandSequence: number;
    activeDesignPage: number;
    previewPageCount: number;
    autoSaveEnabled: boolean;
    /** Set while "delete all my data" runs (in any tab); nothing may be saved until reload. */
    persistenceSuspended: boolean;

    // Template document mode
    documentMode: EditorDocumentMode;
    activeTemplateId: string | null;
    templateMeta: TemplateMeta | null;
    /** True when the current template is a built-in (read-only). */
    isTemplateReadOnly: boolean;
    /** Snapshot of the resume context the user came from before entering template mode (so we can restore it). */
    resumeSnapshotBeforeTemplate: { resume: Resume; activeResumeId: string | null; paperSize: 'a4' | 'letter' } | null;

    // Actions
    setActiveResumeId: (id: string | null) => void;
    setResume: (resume: Resume) => void;
    updatePaperSize: (size: 'a4' | 'letter') => void;
    setAIChatMode: (mode: AIChatMode) => void;
    setSidebarTab: (tab: SidebarTab) => void;
    setCustomizeScope: (scope: "resume" | "section") => void;
    requestEditorNav: (section: string, entryIndex: number | null) => void;
    requestContentSection: (
        section: string,
        mode: ContentNavigationRequest["mode"],
        entryIndex?: number | null,
    ) => void;
    consumeContentNav: () => void;
    setSelectedContentTarget: (target: ContentSelection | null) => void;
    applyContentTransform: (transform: (resume: Resume) => Resume) => void;
    requestCustomizeSection: (section: string) => void;
    requestCustomizePanel: (panel: string) => void;
    consumeCustomizeNav: () => void;
    setSelectedCustomizeSection: (section: string | null) => void;
    consumeEditorNav: () => void;
    selectDesignElement: (id: string | null) => void;
    clearDesignSelection: () => void;
    setActiveDesignPage: (pageIndex: number) => void;
    setPreviewPageCount: (count: number) => void;
    requestPreviewCommand: (command: PreviewCommand) => void;
    consumePreviewCommand: () => void;
    addDesignElement: (type: DesignElement["type"], pageIndex?: number) => string;
    updateDesignElement: (id: string, updates: Partial<Omit<DesignElement, "id" | "style">>) => void;
    updateDesignElementStyle: (id: string, updates: Partial<DesignElement["style"]>) => void;
    removeDesignElement: (id: string) => void;
    duplicateDesignElement: (id: string) => void;
    moveDesignElementLayer: (id: string, direction: "forward" | "backward" | "front" | "back") => void;
    updateBasics: (basics: Partial<Resume["basics"]>) => void;
    updateMeta: (meta: Partial<Resume["meta"]>) => void;
    updateExperience: (experience: Resume["experience"]) => void;
    updateEducation: (education: Resume["education"]) => void;
    updateCertificates: (certificates: Resume["certificates"]) => void;
    updateSkillGroups: (skillGroups: Resume["skillGroups"]) => void;
    updateLanguages: (languages: Resume["languages"]) => void;
    updateProjects: (projects: Resume["projects"]) => void;
    updateOrganisations: (organisations: Resume["organisations"]) => void;
    updateCourses: (courses: Resume["courses"]) => void;
    updateAwards: (awards: Resume["awards"]) => void;
    updatePublications: (publications: Resume["publications"]) => void;
    updateReferences: (references: Resume["references"]) => void;
    updateDeclaration: (declaration: Resume["declaration"]) => void;
    updateInterests: (interests: Resume["interests"]) => void;
    updateCustomSections: (customSections: Resume["customSections"]) => void;
    updateSettings: (settings: Partial<Resume["settings"]>) => void;
    updateSectionStyle: <K extends SectionStyleKey>(
        section: string,
        styleKey: K,
        patch: SectionStyleOverride[K],
    ) => void;
    clearSectionStyle: (section: string, styleKey?: SectionStyleKey) => void;
    updateResumePatch: (patch: Partial<Resume>) => void;
    queueAIPatchProposals: (patch: Partial<Resume>) => number;
    acceptAIProposal: (id: string) => void;
    declineAIProposal: (id: string) => void;
    acceptAllAIProposals: () => void;
    clearAIProposals: () => void;
    appendAIMessage: (message: AIMessage) => void;
    appendAICheckpoint: (checkpoint: AICheckpoint) => void;
    revertToAICheckpoint: (checkpointId: string) => boolean;

    setAutoSaveEnabled: (enabled: boolean) => void;
    suspendPersistence: () => void;

    // DB Sync
    loadFromDb: (id: string) => Promise<void>;
    saveToDb: (trigger?: ResumeHistoryTrigger) => Promise<void>;
    createNew: () => Promise<string>;

    // Template mode actions
    loadTemplateFromDb: (id: string) => Promise<TemplateDocument | null>;
    saveTemplateToDb: () => Promise<void>;
    setTemplateMeta: (meta: Partial<TemplateMeta>) => void;
    createNewTemplate: (initial?: Partial<TemplateMeta>) => Promise<string>;
    saveResumeAsTemplate: (meta: Partial<TemplateMeta>) => Promise<string>;
    applyTemplateById: (templateId: string, options?: { applyPaperSize?: boolean }) => Promise<boolean>;
    clearTemplateMode: () => void;
}

/** Template a brand-new blank resume is based on. */
const DEFAULT_NEW_RESUME_TEMPLATE_ID = "enginecv-modern";

const DEFAULT_RESUME_SIDEBAR_TAB: SidebarTab = "content";

function createEditorSurfaceState(sidebarTab: SidebarTab = DEFAULT_RESUME_SIDEBAR_TAB) {
    return {
        sidebarTab,
        customizeScope: "resume" as const,
        pendingContentNav: null,
        selectedContentTarget: null,
        pendingCustomizeNav: null,
        selectedCustomizeSection: null,
        selectedDesignElementId: null,
        pendingPreviewCommand: null,
        activeDesignPage: 0,
        previewPageCount: 1,
    };
}

function createResumeEditorSessionState(resume: Resume, activeResumeId: string) {
    return {
        resume,
        activeResumeId,
        documentMode: "resume" as const,
        activeTemplateId: null,
        templateMeta: null,
        isTemplateReadOnly: false,
        resumeSnapshotBeforeTemplate: null,
        isDirty: false,
        lastSavedAt: resume.updatedAt,
        aiProposals: [],
        ...createEditorSurfaceState(),
    };
}

export const useResumeStore = create<ResumeStore>((set, get) => ({
    activeResumeId: null,
    resume: createEmptyResume(),
    isSaving: false,
    isDirty: false,
    lastSavedAt: null,
    paperSize: 'a4',
    aiProposals: [],
    aiChatMode: "auto",
    autoSaveEnabled: true,
    persistenceSuspended: false,
    pendingEditorNav: null,
    previewCommandSequence: 0,
    ...createEditorSurfaceState(),

    documentMode: "resume",
    activeTemplateId: null,
    templateMeta: null,
    isTemplateReadOnly: false,
    resumeSnapshotBeforeTemplate: null,

    setActiveResumeId: (id) => set({ activeResumeId: id }),

    setResume: (resume) => set({
        resume,
        ...createEditorSurfaceState(get().sidebarTab),
    }),

    updatePaperSize: (size) => set({ paperSize: size }),
    setAIChatMode: (mode) => set({ aiChatMode: mode }),
    setSidebarTab: (tab) => tab === "json" ? set({ sidebarTab: tab }) : requestJsonEditorLeave(() => set({ sidebarTab: tab })),
    setCustomizeScope: (scope) => set({ customizeScope: scope }),
    requestEditorNav: (section, entryIndex) => requestJsonEditorLeave(() => set({
        pendingEditorNav: { section, entryIndex },
        sidebarTab: "content",
    })),
    requestContentSection: (section, mode, entryIndex) => requestJsonEditorLeave(() => set({
        pendingContentNav: { section, mode, entryIndex },
        sidebarTab: "content",
    })),
    consumeContentNav: () => set({ pendingContentNav: null }),
    setSelectedContentTarget: (target) => set({ selectedContentTarget: target }),
    applyContentTransform: (transform) => set((state) => ({
        resume: transform(state.resume),
        isDirty: true,
    })),
    requestCustomizeSection: (section) => requestJsonEditorLeave(() => set({
        pendingCustomizeNav: { scope: "section", panel: null, section },
        customizeScope: "section",
        selectedCustomizeSection: section,
        sidebarTab: "customize",
    })),
    requestCustomizePanel: (panel) => requestJsonEditorLeave(() => set({
        pendingCustomizeNav: { scope: "resume", panel },
        customizeScope: "resume",
        selectedCustomizeSection: null,
        sidebarTab: "customize",
    })),
    consumeCustomizeNav: () => set({ pendingCustomizeNav: null }),
    setSelectedCustomizeSection: (section) => set({ selectedCustomizeSection: section }),
    consumeEditorNav: () => set({ pendingEditorNav: null }),
    selectDesignElement: (id) => requestJsonEditorLeave(() => set((state) => {
        const element = state.resume.settings.design?.elements?.find((entry) => entry.id === id) || null;
        return {
            selectedDesignElementId: id,
            activeDesignPage: element?.pageIndex ?? state.activeDesignPage,
            sidebarTab: id ? "customize" : state.sidebarTab,
        };
    })),
    clearDesignSelection: () => set({ selectedDesignElementId: null }),
    setActiveDesignPage: (pageIndex) => requestJsonEditorLeave(() => set({
        activeDesignPage: Math.max(0, Math.floor(pageIndex)),
        sidebarTab: "customize",
    })),
    setPreviewPageCount: (count) => set((state) => {
        const nextCount = Math.max(1, Math.floor(count));
        return {
            previewPageCount: nextCount,
            activeDesignPage: Math.min(state.activeDesignPage, nextCount - 1),
        };
    }),
    requestPreviewCommand: (command) => set((state) => {
        const requestId = state.previewCommandSequence + 1;
        return {
            previewCommandSequence: requestId,
            pendingPreviewCommand: { requestId, command },
        };
    }),
    consumePreviewCommand: () => set({ pendingPreviewCommand: null }),
    setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
    suspendPersistence: () => set({ persistenceSuspended: true, autoSaveEnabled: false, isDirty: false }),

    addDesignElement: (type, pageIndex) => {
        const state = get();
        const resolvedPageIndex = Math.max(0, pageIndex ?? state.activeDesignPage ?? 0);
        const existingElements = state.resume.settings.design?.elements || [];
        const nextElement = createDesignElement(type, {
            pageIndex: resolvedPageIndex,
            zIndex: getNextDesignZIndex(existingElements, resolvedPageIndex),
            accentColor: state.resume.settings.colors.accent,
            textColor: state.resume.settings.colors.text,
        });
        const nextElements = normalizeDesignElementOrder([...existingElements, nextElement]);

        set({
            isDirty: true,
            sidebarTab: "customize",
            selectedDesignElementId: nextElement.id,
            activeDesignPage: resolvedPageIndex,
            resume: {
                ...state.resume,
                settings: {
                    ...state.resume.settings,
                    design: {
                        ...(state.resume.settings.design || { elements: [] }),
                        elements: nextElements,
                    },
                },
            },
        });

        return nextElement.id;
    },
    updateDesignElement: (id, updates) => set((state) => {
        const currentElements = state.resume.settings.design?.elements || [];
        const nextElements = currentElements.map((element) => {
            if (element.id !== id) {
                return element;
            }

            return {
                ...element,
                ...updates,
            };
        });

        return {
            isDirty: true,
            resume: {
                ...state.resume,
                settings: {
                    ...state.resume.settings,
                    design: {
                        ...(state.resume.settings.design || { elements: [] }),
                        elements: normalizeDesignElementOrder(nextElements),
                    },
                },
            },
        };
    }),
    updateDesignElementStyle: (id, updates) => set((state) => {
        const currentElements = state.resume.settings.design?.elements || [];
        const nextElements = currentElements.map((element) => {
            if (element.id !== id) {
                return element;
            }

            return {
                ...element,
                style: {
                    ...element.style,
                    ...updates,
                    border: updates.border
                        ? {
                            ...element.style.border,
                            ...updates.border,
                        }
                        : element.style.border,
                },
            };
        });

        return {
            isDirty: true,
            resume: {
                ...state.resume,
                settings: {
                    ...state.resume.settings,
                    design: {
                        ...(state.resume.settings.design || { elements: [] }),
                        elements: nextElements,
                    },
                },
            },
        };
    }),
    removeDesignElement: (id) => set((state) => {
        const nextElements = (state.resume.settings.design?.elements || []).filter((element) => element.id !== id);
        return {
            isDirty: true,
            selectedDesignElementId: state.selectedDesignElementId === id ? null : state.selectedDesignElementId,
            resume: {
                ...state.resume,
                settings: {
                    ...state.resume.settings,
                    design: {
                        ...(state.resume.settings.design || { elements: [] }),
                        elements: normalizeDesignElementOrder(nextElements),
                    },
                },
            },
        };
    }),
    duplicateDesignElement: (id) => set((state) => {
        const currentElements = state.resume.settings.design?.elements || [];
        const currentElement = currentElements.find((element) => element.id === id);
        if (!currentElement) {
            return {};
        }

        const duplicated = duplicateDesignElement(
            currentElement,
            getNextDesignZIndex(currentElements, currentElement.pageIndex),
        );
        const nextElements = normalizeDesignElementOrder([...currentElements, duplicated]);

        return {
            isDirty: true,
            sidebarTab: "customize",
            selectedDesignElementId: duplicated.id,
            activeDesignPage: duplicated.pageIndex,
            resume: {
                ...state.resume,
                settings: {
                    ...state.resume.settings,
                    design: {
                        ...(state.resume.settings.design || { elements: [] }),
                        elements: nextElements,
                    },
                },
            },
        };
    }),
    moveDesignElementLayer: (id, direction) => set((state) => {
        const currentElements = state.resume.settings.design?.elements || [];
        const nextElements = moveDesignElementLayer(currentElements, id, direction);

        return {
            isDirty: true,
            resume: {
                ...state.resume,
                settings: {
                    ...state.resume.settings,
                    design: {
                        ...(state.resume.settings.design || { elements: [] }),
                        elements: nextElements,
                    },
                },
            },
        };
    }),

    updateBasics: (basics) => set((state) => {
        const nextBasics = { ...state.resume.basics, ...basics };

        if (basics.emails) {
            nextBasics.email = basics.emails.find((entry) => entry.email.trim())?.email ?? "";
        } else if (typeof basics.email === "string") {
            const currentEmails = state.resume.basics.emails ?? [];
            nextBasics.emails = currentEmails.length > 0
                ? currentEmails.map((entry, index) =>
                    index === 0 ? { ...entry, email: basics.email ?? "" } : entry
                )
                : basics.email
                    ? [{ id: createId(), email: basics.email, label: "" }]
                    : [];
        }

        return {
            isDirty: true,
            resume: {
                ...state.resume,
                basics: nextBasics,
            },
        };
    }),

    updateMeta: (meta) => set((state) => ({
        isDirty: true,
        resume: {
            ...state.resume,
            meta: { ...state.resume.meta, ...meta }
        }
    })),

    updateExperience: (experience) => set((state) => ({
        isDirty: true,
        resume: { ...state.resume, experience }
    })),

    updateEducation: (education) => set((state) => ({
        isDirty: true,
        resume: { ...state.resume, education }
    })),

    updateCertificates: (certificates) => set((state) => ({
        isDirty: true,
        resume: { ...state.resume, certificates }
    })),

    updateSkillGroups: (skillGroups) => set((state) => ({
        isDirty: true,
        resume: { ...state.resume, skillGroups: normalizeSkillGroups(skillGroups) }
    })),

    updateLanguages: (languages) => set((state) => ({
        isDirty: true,
        resume: { ...state.resume, languages }
    })),

    updateProjects: (projects) => set((state) => ({
        isDirty: true,
        resume: { ...state.resume, projects }
    })),

    updateOrganisations: (organisations) => set((state) => ({
        isDirty: true,
        resume: { ...state.resume, organisations }
    })),

    updateCourses: (courses) => set((state) => ({
        isDirty: true,
        resume: { ...state.resume, courses }
    })),

    updateAwards: (awards) => set((state) => ({
        isDirty: true,
        resume: { ...state.resume, awards }
    })),

    updatePublications: (publications) => set((state) => ({
        isDirty: true,
        resume: { ...state.resume, publications }
    })),

    updateReferences: (references) => set((state) => ({
        isDirty: true,
        resume: { ...state.resume, references }
    })),

    updateDeclaration: (declaration) => set((state) => ({
        isDirty: true,
        resume: { ...state.resume, declaration }
    })),

    updateInterests: (interests) => set((state) => ({
        isDirty: true,
        resume: { ...state.resume, interests }
    })),

    updateCustomSections: (customSections) => set((state) => ({
        isDirty: true,
        resume: { ...state.resume, customSections }
    })),

    updateSettings: (settings) => set((state) => {
        const newSettings = { ...state.resume.settings };

        // Deep merge top level objects safely
        for (const key of Object.keys(settings) as Array<keyof typeof settings>) {
            const val = settings[key];
            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                (newSettings as any)[key] = {
                    ...(newSettings[key as keyof typeof newSettings] as any),
                    ...(val as any)
                };
            } else {
                (newSettings as any)[key] = val;
            }
        }

        return {
            isDirty: true,
            resume: {
                ...state.resume,
                settings: newSettings
            }
        };
    }),

    updateSectionStyle: (section, styleKey, patch) => set((state) => {
        const currentOverrides = state.resume.customization.sectionOverrides;
        const currentSection = currentOverrides[section] || {};
        const currentStyle = currentSection[styleKey] || {};
        const nextStyle = mergeCustomizationValue(currentStyle, patch || {});

        return {
            isDirty: true,
            resume: {
                ...state.resume,
                customization: {
                    ...state.resume.customization,
                    sectionOverrides: {
                        ...currentOverrides,
                        [section]: {
                            ...currentSection,
                            [styleKey]: nextStyle,
                        },
                    },
                },
            },
        };
    }),

    clearSectionStyle: (section, styleKey) => set((state) => ({
        isDirty: true,
        resume: {
            ...state.resume,
            customization: {
                ...state.resume.customization,
                sectionOverrides: withoutSectionStyleOverride(
                    state.resume.customization.sectionOverrides,
                    section,
                    styleKey,
                ),
            },
        },
    })),

    updateResumePatch: (patch) => set((state) => {
        const deepMerge = (target: unknown, source: unknown): unknown => {
            if (source === undefined) return target;
            if (source === null || typeof source !== "object") return source;
            if (Array.isArray(source)) return source;
            if (target === null || typeof target !== "object" || Array.isArray(target)) {
                return source;
            }

            const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
            for (const [k, v] of Object.entries(source as Record<string, unknown>)) {
                out[k] = deepMerge(out[k], v);
            }
            return out;
        };

        const merged = deepMerge(state.resume, patch) as Resume;
        const parsed = resumeSchema.safeParse(merged);
        if (!parsed.success) {
            console.warn("AI patch rejected by resume schema:", parsed.error);
            return {};
        }

        return {
            isDirty: true,
            resume: parsed.data
        };
    }),

    queueAIPatchProposals: (patch) => {
        const state = get();
        const getByPath = (obj: unknown, path: string): unknown => {
            const parts = path.split(".");
            let cursor: unknown = obj;
            for (const part of parts) {
                if (cursor === null || cursor === undefined || typeof cursor !== "object") return undefined;
                cursor = (cursor as Record<string, unknown>)[part];
            }
            return cursor;
        };
        const collectLeafChanges = (basePath: string, value: unknown, acc: Array<{ path: string; value: unknown }>) => {
            if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) {
                acc.push({ path: basePath, value });
                return;
            }
            for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
                const nextPath = basePath ? `${basePath}.${k}` : k;
                collectLeafChanges(nextPath, v, acc);
            }
        };

        const leaves: Array<{ path: string; value: unknown }> = [];
        collectLeafChanges("", patch, leaves);
        const incoming = leaves
            .filter((l) => l.path.trim().length > 0)
            .filter((l) => JSON.stringify(getByPath(state.resume, l.path)) !== JSON.stringify(l.value))
            .map((l) => ({ id: createId(), path: l.path, next: l.value }));

        if (incoming.length === 0) return 0;

        const withoutSamePath = state.aiProposals.filter((p) => !incoming.some((i) => i.path === p.path));
        set({ aiProposals: [...withoutSamePath, ...incoming] });
        return incoming.length;
    },

    acceptAIProposal: (id) => set((state) => {
        const proposal = state.aiProposals.find((p) => p.id === id);
        if (!proposal) return {};

        const buildPatchFromPath = (path: string, value: unknown): Partial<Resume> => {
            const parts = path.split(".");
            const root: Record<string, unknown> = {};
            let cursor: Record<string, unknown> = root;
            for (let i = 0; i < parts.length; i++) {
                const key = parts[i];
                if (i === parts.length - 1) {
                    cursor[key] = value;
                } else {
                    cursor[key] = {};
                    cursor = cursor[key] as Record<string, unknown>;
                }
            }
            return root as Partial<Resume>;
        };
        const deepMerge = (target: unknown, source: unknown): unknown => {
            if (source === undefined) return target;
            if (source === null || typeof source !== "object") return source;
            if (Array.isArray(source)) return source;
            if (target === null || typeof target !== "object" || Array.isArray(target)) return source;
            const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
            for (const [k, v] of Object.entries(source as Record<string, unknown>)) out[k] = deepMerge(out[k], v);
            return out;
        };

        const merged = deepMerge(state.resume, buildPatchFromPath(proposal.path, proposal.next)) as Resume;
        const parsed = resumeSchema.safeParse(merged);
        if (!parsed.success) return { aiProposals: state.aiProposals.filter((p) => p.id !== id) };

        return {
            isDirty: true,
            resume: parsed.data,
            aiProposals: state.aiProposals.filter((p) => p.id !== id),
        };
    }),

    declineAIProposal: (id) => set((state) => ({
        aiProposals: state.aiProposals.filter((p) => p.id !== id),
    })),

    acceptAllAIProposals: () => set((state) => {
        if (state.aiProposals.length === 0) return {};

        const buildPatchFromPath = (path: string, value: unknown): Partial<Resume> => {
            const parts = path.split(".");
            const root: Record<string, unknown> = {};
            let cursor: Record<string, unknown> = root;
            for (let i = 0; i < parts.length; i++) {
                const key = parts[i];
                if (i === parts.length - 1) {
                    cursor[key] = value;
                } else {
                    cursor[key] = {};
                    cursor = cursor[key] as Record<string, unknown>;
                }
            }
            return root as Partial<Resume>;
        };
        const deepMerge = (target: unknown, source: unknown): unknown => {
            if (source === undefined) return target;
            if (source === null || typeof source !== "object") return source;
            if (Array.isArray(source)) return source;
            if (target === null || typeof target !== "object" || Array.isArray(target)) return source;
            const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
            for (const [k, v] of Object.entries(source as Record<string, unknown>)) out[k] = deepMerge(out[k], v);
            return out;
        };

        let aggregatePatch: Partial<Resume> = {};
        for (const p of state.aiProposals) {
            aggregatePatch = deepMerge(aggregatePatch, buildPatchFromPath(p.path, p.next)) as Partial<Resume>;
        }

        const merged = deepMerge(state.resume, aggregatePatch) as Resume;
        const parsed = resumeSchema.safeParse(merged);
        if (!parsed.success) return { aiProposals: [] };

        return {
            isDirty: true,
            resume: parsed.data,
            aiProposals: [],
        };
    }),

    clearAIProposals: () => set({ aiProposals: [] }),

    appendAIMessage: (message) => set((state) => ({
        isDirty: true,
        resume: {
            ...state.resume,
            aiHistory: {
                ...(state.resume.aiHistory || { messages: [], checkpoints: [] }),
                messages: [...(state.resume.aiHistory?.messages || []), message],
            }
        }
    })),

    appendAICheckpoint: (checkpoint) => set((state) => ({
        isDirty: true,
        resume: {
            ...state.resume,
            aiHistory: {
                ...(state.resume.aiHistory || { messages: [], checkpoints: [] }),
                checkpoints: [...(state.resume.aiHistory?.checkpoints || []), checkpoint],
            }
        }
    })),

    revertToAICheckpoint: (checkpointId) => {
        const state = get();
        const checkpoint = state.resume.aiHistory?.checkpoints?.find((c) => c.id === checkpointId);
        if (!checkpoint) return false;

        try {
            const parsedSnapshot = resumeSchema.safeParse(JSON.parse(checkpoint.resumeJson));
            if (!parsedSnapshot.success) return false;

            const resumed = {
                ...parsedSnapshot.data,
                id: state.resume.id,
                createdAt: state.resume.createdAt,
                aiHistory: state.resume.aiHistory,
                updatedAt: Date.now(),
            } as Resume;

            set({
                isDirty: true,
                resume: resumed,
                selectedDesignElementId: null,
                activeDesignPage: 0,
                previewPageCount: 1,
            });
            return true;
        } catch {
            return false;
        }
    },

    loadFromDb: async (id: string) => {
        const rawResume = await db.resumes.get(id);
        if (rawResume) {
            const parsed = resumeSchema.safeParse(rawResume);
            if (parsed.success) {
                const normalizedResume = {
                    ...parsed.data,
                    createdAt: typeof (rawResume as { createdAt?: unknown }).createdAt === "number"
                        ? (rawResume as { createdAt: number }).createdAt
                        : (typeof (rawResume as { updatedAt?: unknown }).updatedAt === "number"
                            ? (rawResume as { updatedAt: number }).updatedAt
                            : parsed.data.createdAt),
                };
                set({
                    ...createResumeEditorSessionState(normalizedResume, id),
                });
                await recordResumeHistory(normalizedResume, "manual");
            } else {
                console.warn("DB resume schema validation failed, merging defaults.", parsed.error);
                // Fallback: merge default settings manually to prevent UI crashes and missing export data.
                const defaultEmpty = createEmptyResume();
                const fallbackCreatedAt = typeof (rawResume as { createdAt?: unknown }).createdAt === "number"
                    ? (rawResume as { createdAt: number }).createdAt
                    : (typeof (rawResume as { updatedAt?: unknown }).updatedAt === "number"
                        ? (rawResume as { updatedAt: number }).updatedAt
                        : defaultEmpty.createdAt);
                const resumeToSet = {
                    ...defaultEmpty,
                    ...rawResume,
                    meta: {
                        ...defaultEmpty.meta,
                        ...((rawResume as { meta?: Resume["meta"] }).meta || {}),
                    },
                    settings: {
                        ...defaultEmpty.settings,
                        ...(rawResume.settings || {})
                    },
                    createdAt: fallbackCreatedAt,
                };
                set({
                    ...createResumeEditorSessionState(resumeToSet as Resume, id),
                });
                await recordResumeHistory(resumeToSet as Resume, "manual");
            }
        }
    },

    saveToDb: async (trigger = "autosave") => {
        const { resume, activeResumeId, persistenceSuspended } = get();
        if (!activeResumeId || persistenceSuspended) return;

        set({ isSaving: true });
        try {
            const now = Date.now();
            const updatedResume = { ...resume, updatedAt: now, id: activeResumeId };
            await db.resumes.put(updatedResume);
            await recordResumeHistory(updatedResume, trigger);
            // Only update metadata flags — do NOT write the captured resume back
            // into state, as the user may have made further changes while the
            // async save was in-flight, and overwriting would rubberband to stale data.
            set((state) => ({
                resume: { ...state.resume, updatedAt: now },
                isDirty: false,
                lastSavedAt: now,
            }));
        } finally {
            set({ isSaving: false });
        }
    },

    createNew: async () => {
        // A blank resume starts from the Modern template, not the bare schema
        // defaults, so the first thing a user sees is a finished design.
        const modern = getBuiltinTemplateById(DEFAULT_NEW_RESUME_TEMPLATE_ID);
        const blank = createEmptyResume();
        const newResume = modern ? applyTemplateToResume(blank, modern).resume : blank;
        const id = createId();
        const now = Date.now();
        newResume.id = id;
        newResume.createdAt = now;
        newResume.updatedAt = now;

        await db.resumes.add(newResume);
        await recordResumeHistory(newResume, "manual");
        set({
            ...createResumeEditorSessionState(newResume, id),
        });
        return id;
    },

    loadTemplateFromDb: async (id: string) => {
        const builtin = getBuiltinTemplateById(id);
        let template: TemplateDocument | null = null;
        let readOnly = false;

        if (builtin) {
            template = builtin;
            readOnly = true;
        } else {
            const raw = await db.templates.get(id);
            if (raw) {
                const parsed = templateDocumentSchema.safeParse(raw);
                if (parsed.success) template = parsed.data;
            }
        }

        if (!template) return null;

        const sample = getSampleResumeForTemplatePreview(builtin ? getTemplatePreviewOptions(builtin.id) : {});
        const { resume: previewResume } = applyTemplateToResume(sample, template);

        set((state) => ({
            documentMode: "template",
            activeTemplateId: template!.id,
            templateMeta: template!.meta,
            isTemplateReadOnly: readOnly,
            resume: previewResume,
            paperSize: template!.paperSize,
            isDirty: false,
            lastSavedAt: template!.updatedAt,
            ...createEditorSurfaceState("customize"),
            // Preserve any existing snapshot if user navigates between templates
            // without leaving template mode.
            resumeSnapshotBeforeTemplate: state.resumeSnapshotBeforeTemplate,
        }));

        return template;
    },

    saveTemplateToDb: async () => {
        const { resume, activeTemplateId, templateMeta, paperSize, isTemplateReadOnly } = get();
        if (!activeTemplateId || !templateMeta) return;
        if (isTemplateReadOnly) return; // built-ins never persist
        set({ isSaving: true });
        try {
            const now = Date.now();
            const existing = await db.templates.get(activeTemplateId);
            const createdAt = existing?.createdAt ?? now;
            const doc: TemplateDocument = {
                kind: "template",
                id: activeTemplateId,
                version: TEMPLATE_DOCUMENT_VERSION,
                meta: templateMeta,
                settings: resume.settings,
                paperSize,
                createdAt,
                updatedAt: now,
            };
            await db.templates.put(doc);
            set({ isDirty: false, lastSavedAt: now });
        } finally {
            set({ isSaving: false });
        }
    },

    setTemplateMeta: (meta) => set((state) => ({
        templateMeta: state.templateMeta
            ? { ...state.templateMeta, ...meta }
            : { name: "Untitled template", description: "", tags: [], source: "user", ...meta },
        isDirty: state.documentMode === "template" ? true : state.isDirty,
    })),

    createNewTemplate: async (initial = {}) => {
        const id = createId();
        const now = Date.now();
        const sample = getSampleResumeForTemplatePreview();
        const doc: TemplateDocument = {
            kind: "template",
            id,
            version: TEMPLATE_DOCUMENT_VERSION,
            meta: {
                name: initial.name ?? "Untitled template",
                description: initial.description ?? "",
                tags: initial.tags ?? [],
                source: "user",
                basedOnTemplateId: initial.basedOnTemplateId,
            },
            settings: sample.settings,
            paperSize: "a4",
            createdAt: now,
            updatedAt: now,
        };
        await db.templates.put(doc);
        return id;
    },

    saveResumeAsTemplate: async (meta) => {
        const { resume, paperSize } = get();
        const id = createId();
        const now = Date.now();
        const doc: TemplateDocument = {
            kind: "template",
            id,
            version: TEMPLATE_DOCUMENT_VERSION,
            meta: {
                name: meta.name ?? "Untitled template",
                description: meta.description ?? "",
                tags: meta.tags ?? [],
                source: "user",
                basedOnTemplateId: meta.basedOnTemplateId,
            },
            settings: resume.settings,
            paperSize,
            createdAt: now,
            updatedAt: now,
        };
        await db.templates.put(doc);
        return id;
    },

    applyTemplateById: async (templateId, options = {}) => {
        const builtin = getBuiltinTemplateById(templateId);
        let template: TemplateDocument | null = builtin ?? null;
        if (!template) {
            const raw = await db.templates.get(templateId);
            if (raw) {
                const parsed = templateDocumentSchema.safeParse(raw);
                if (parsed.success) template = parsed.data;
            }
        }
        if (!template) return false;

        const state = get();
        const result = applyTemplateToResume(state.resume, template, options);

        set({
            resume: {
                ...result.resume,
                settings: {
                    ...result.resume.settings,
                    // Preserve template provenance hint as a regular setting field on the resume.
                    // (Plan suggests `appliedTemplateId` / `appliedTemplateName`; left as future enhancement.)
                },
            },
            paperSize: result.paperSize ?? state.paperSize,
            isDirty: state.documentMode === "resume",
            selectedDesignElementId: null,
            activeDesignPage: 0,
            previewPageCount: 1,
        });
        return true;
    },

    clearTemplateMode: () => set((state) => {
        const snap = state.resumeSnapshotBeforeTemplate;
        if (snap) {
            return {
                documentMode: "resume",
                activeTemplateId: null,
                templateMeta: null,
                isTemplateReadOnly: false,
                resumeSnapshotBeforeTemplate: null,
                resume: snap.resume,
                activeResumeId: snap.activeResumeId,
                paperSize: snap.paperSize,
                isDirty: false,
                selectedDesignElementId: null,
                activeDesignPage: 0,
                previewPageCount: 1,
            };
        }
        return {
            documentMode: "resume",
            activeTemplateId: null,
            templateMeta: null,
            isTemplateReadOnly: false,
            resumeSnapshotBeforeTemplate: null,
        };
    }),
}));
