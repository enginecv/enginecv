"use client";

import { useResumeStore } from "@/lib/store";
import { setJsonEditorSlot } from "./json-editor-slot";
import { requestJsonEditorLeave } from "@/lib/editor-json-session";
import { allSkills, createUngroupedSkillGroup, isNativeLanguageFluency, SKILL_LEVELS, UNGROUPED_SKILL_GROUP_ID, type SkillGroup, type SkillLevel, type CustomSection, type CustomEntry } from "@/lib/schema";
import { assessedCefrSkills, deriveOverallCefrLevel, emptyCefrSkillLevels, isCefrLevel, type CefrSkillLevels } from "@/lib/cefr";
import { CefrSkillGrid } from "./CefrSkillGrid";
import { useAI } from "@/hooks/useAI";
import { createId } from "@/lib/id";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EntryForm } from "./EntryForm";
import { GetTipsLink } from "./GetTipsLink";
import { MarkdownField } from "./MarkdownField";
import { RepoLinksEditor } from "./RepoLinksEditor";
import { isGithubProject } from "@/lib/import/github-projects";
import {
    arrayMove,
    closestCenter,
    DndContext,
    DropZone,
    pointerWithin,
    SortableContext,
    SortableList,
    SortableRow,
    useSortableSetup,
    verticalListSortingStrategy,
    verticalOnly,
    type CollisionDetection,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
    type SortableItemState,
} from "@/components/ui/sortable";

// Loaded on demand: only used when adding projects from GitHub.
const ImportDataDialog = dynamic(
    () => import("@/components/import/hub/ImportDataDialog").then((m) => m.ImportDataDialog),
    { ssr: false },
);
const GithubProjectsImportDialog = dynamic(
    () => import("@/components/import/GithubProjectsImportDialog").then((m) => m.GithubProjectsImportDialog),
    { ssr: false },
);
import { PhotoCropModal } from "./PhotoCropModal";
import { SignatureModal } from "./SignatureModal";
import { persistImportedResume } from "@/lib/import/persist-imported-resume";
import {
    Sparkles,
    Loader2,
    Plus,
    AlertTriangle,
    Link as LinkIcon,
    Camera,
    Search,
    Trash2,
    GripVertical,
    CalendarDays,
    Flag,
    Car,
    CreditCard,
    Heart,
    ShieldCheck,
    UserRound,
    Accessibility,
    Plane,
    Ruler,
    Globe,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Check,
    X,
    ArrowUpDown,
    Briefcase as BriefcaseIcon,
    Code2 as CodeIcon,
    PenLine as PenIcon,
    Star as StarIcon,
    BookOpen as BookIcon,
    Eye,
    EyeOff,
    FileText,
    LucideIcon,
    RotateCcw,
    SlidersHorizontal,
    Palette,
    Github,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo, useId } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "@/lib/i18n";
import { AI_ENABLED } from "@/lib/features";
import {
    CONTENT_SECTIONS,
    contentSectionBaseId,
    hasContentSection,
    isContentSectionAvailable,
    type ContentSectionDefinition,
} from "./content-section-registry";

import {
    OPTIONAL_PERSONAL_DETAILS,
    SOCIAL_NETWORKS,

    CUSTOM_ICON_LUCIDE_MAP,
    PERSONAL_DETAIL_ICON_MAP,
    SOCIAL_BRAND_SLUG_MAP,
    SocialBrandIcon,
    CustomIconSelect,
    AutocompleteInput,
    Input,
    TagsInput,
    LinkInput,
    formatDateForDisplay
} from "./FormUtils";
import { DateOfBirthPicker, DatePicker } from "@/components/ui/date-picker";
import { MultiPhoneInput } from "@/components/ui/phone-input";
import { MultiEmailInput } from "@/components/ui/email-input";
import { getResumeEmails } from "@/lib/emails";
import { CountryDropdown, CountryDisplayToggle, type CountryDisplayMode } from "@/components/ui/country-dropdown";
import { DrivingLicenseInput } from "@/components/ui/driving-license-input";
import { MultiDocumentInput } from "@/components/ui/passport-id-input";
import { MaritalStatusInput } from "@/components/ui/marital-status-input";
import { DisabilityInput } from "@/components/ui/disability-input";
import {
    Select as UiSelect,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CV_LANGUAGE_OPTIONS, getDefaultCvDateFormat } from "@/lib/cv-language";


function BasicsForm({ onBack }: { onBack: () => void }) {
    const { t } = useTranslation();
    const summaryLabelId = useId();
    const resume = useResumeStore((state) => state.resume);
    const dateFormat = resume.settings?.dateFormat || "DD/MM/YYYY";
    const language = resume.settings?.language || "en";
    const updateBasics = useResumeStore((state) => state.updateBasics);
    const updateSettings = useResumeStore((state) => state.updateSettings);
    const updateMeta = useResumeStore((state) => state.updateMeta);
    const { generateAIContent } = useAI();
    const [isGenerating, setIsGenerating] = useState(false);

    const [showOptional, setShowOptional] = useState<Record<string, boolean>>({});

    // One-time migration: copy legacy passportOrId into passport if passport is empty.
    useEffect(() => {
        const legacy = (resume.basics as any).passportOrId as string | undefined;
        const passport = (resume.basics as any).passport as string | undefined;
        if (legacy && !passport) {
            updateBasics({ passport: legacy, passportOrId: "" } as any);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [socialSearch, setSocialSearch] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photoCropSource, setPhotoCropSource] = useState<string | null>(null);
    const [photoCropInitial, setPhotoCropInitial] = useState<typeof resume.basics.photoEdit>(null);
    const [isEditingMeta, setIsEditingMeta] = useState(false);
    const [draftMetaTitle, setDraftMetaTitle] = useState(resume.meta.title || "");
    const [draftMetaDescription, setDraftMetaDescription] = useState(resume.meta.description || "");

    const coreDetailFields = [
        { id: "email", label: t("editor.emailLabel") },
        { id: "phone", label: t("editor.phoneLabel") },
        { id: "location", label: t("editor.locationLabel") },
    ];

    const maybeVisibleDetails = [
        ...coreDetailFields,
        { id: "github", label: t("editor.githubLabel") },
        ...OPTIONAL_PERSONAL_DETAILS.map((detail) => ({ ...detail, label: t(detail.labelKey) })),
    ];

    const getFieldOrderKey = (id: string) => `field:${id}`;
    const getCustomOrderKey = (id: string) => `custom:${id}`;

    const startEditingMeta = () => {
        setDraftMetaTitle(resume.meta.title || "");
        setDraftMetaDescription(resume.meta.description || "");
        setIsEditingMeta(true);
    };

    const cancelEditingMeta = () => {
        setDraftMetaTitle(resume.meta.title || "");
        setDraftMetaDescription(resume.meta.description || "");
        setIsEditingMeta(false);
    };

    const saveMetaEdits = () => {
        const nextTitle = draftMetaTitle.trim();
        const nextDescription = draftMetaDescription.trim();

        if (
            nextTitle === (resume.meta.title || "") &&
            nextDescription === (resume.meta.description || "")
        ) {
            setIsEditingMeta(false);
            return;
        }

        updateMeta({
            title: nextTitle,
            description: nextDescription,
        });
        setIsEditingMeta(false);
    };

    const ensureOrderHas = (key: string) => {
        const current = (resume.basics as any).detailsOrder || [];
        if (current.includes(key)) return;
        updateBasics({ detailsOrder: [...current, key] } as any);
    };

    const removeFromOrder = (key: string) => {
        const current = (resume.basics as any).detailsOrder || [];
        if (!current.includes(key)) return;
        updateBasics({ detailsOrder: current.filter((k: string) => k !== key) } as any);
    };

    const handleGenerateSummary = async () => {
        setIsGenerating(true);
        try {
            const prompt = `Write a professional 2-sentence resume summary for a ${resume.basics.name} located in ${resume.basics.location}.`;
            const newSummary = await generateAIContent([{ role: "user", content: prompt }], "local");
            if (newSummary) {
                updateBasics({ summary: newSummary });
            }
        } catch (e) {
            alert(t("editor.configureApiKeys"));
        } finally {
            setIsGenerating(false);
        }
    };

    const openPhotoCropper = (source: string, initialEdit: typeof resume.basics.photoEdit = null) => {
        setPhotoCropSource(source);
        setPhotoCropInitial(initialEdit);
    };

    const closePhotoCropper = () => {
        setPhotoCropSource(null);
        setPhotoCropInitial(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const source = reader.result as string;
                openPhotoCropper(source, {
                    original: source,
                    crop: { x: 0, y: 0 },
                    zoom: 1,
                    rotation: 0,
                    croppedAreaPixels: { x: 0, y: 0, width: 0, height: 0 },
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePhotoCropApply = (payload: { photo: string; photoEdit: NonNullable<typeof resume.basics.photoEdit> }) => {
        updateBasics({
            photo: payload.photo,
            photoEdit: payload.photoEdit,
        });
        closePhotoCropper();
    };

    const handleEditPhoto = () => {
        const originalPhoto = resume.basics.photoEdit?.original || resume.basics.photo;
        if (!originalPhoto) {
            return;
        }

        openPhotoCropper(originalPhoto, resume.basics.photoEdit || {
            original: originalPhoto,
            crop: { x: 0, y: 0 },
            zoom: 1,
            rotation: 0,
            croppedAreaPixels: { x: 0, y: 0, width: 0, height: 0 },
        });
    };

    const handleRemovePhoto = () => {
        updateBasics({
            photo: "",
            photoEdit: null,
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const addCustomLink = (network: string) => {
        const id = createId();
        const newLinks = [...(resume.basics.customLinks || []), { id, name: network, url: "", label: "", icon: "auto" }];
        updateBasics({ customLinks: newLinks });
        ensureOrderHas(getCustomOrderKey(id));
        setSocialSearch("");
    };

    const updateCustomLinkField = (id: string, field: string, value: string) => {
        const newLinks = (resume.basics.customLinks || []).map(link =>
            link.id === id ? { ...link, [field]: value } : link
        );
        updateBasics({ customLinks: newLinks });
    };

    const removeCustomLink = (id: string) => {
        const newLinks = (resume.basics.customLinks || []).filter(link => link.id !== id);
        updateBasics({ customLinks: newLinks });
        removeFromOrder(getCustomOrderKey(id));
    };

    const toggleOptional = (id: string) => {
        const next = !(showOptional[id] || !!(resume.basics as any)[id]);
        setShowOptional(prev => ({ ...prev, [id]: next }));
        if (next) ensureOrderHas(getFieldOrderKey(id));
    };

    // Filter available social networks (exclude ones already added)
    const availableNetworks = SOCIAL_NETWORKS.filter(
        network => network === "Website" || !(resume.basics.customLinks || []).some(link => link.name === network)
    ).filter(
        network => network.toLowerCase().includes(socialSearch.toLowerCase())
    );

    const detailEditorEntries = (() => {
        const staticEntries = maybeVisibleDetails
            .filter(d => d.id === "email" || d.id === "phone" || d.id === "location" || showOptional[d.id] || !!(resume.basics as any)[d.id])
            .map(d => ({ key: getFieldOrderKey(d.id), label: d.label, type: "field" as const, id: d.id }));

        const customEntries = (resume.basics.customLinks || []).map(link => ({
            key: getCustomOrderKey(link.id),
            label: link.label || link.name,
            type: "custom" as const,
            id: link.id,
        }));

        const all = [...staticEntries, ...customEntries];
        const map = new Map(all.map(entry => [entry.key, entry]));
        const existing = (((resume.basics as any).detailsOrder || []) as string[]).filter(key => map.has(key)).map(key => map.get(key)!);
        const missing = all.filter(entry => !existing.some(e => e.key === entry.key));
        return [...existing, ...missing];
    })();

    const moveDetailOrder = (key: string, dir: "up" | "down") => {
        const orderedKeys = detailEditorEntries.map(e => e.key);
        const idx = orderedKeys.indexOf(key);
        if (idx < 0) return;
        const nextIdx = dir === "up" ? idx - 1 : idx + 1;
        if (nextIdx < 0 || nextIdx >= orderedKeys.length) return;
        const next = [...orderedKeys];
        [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
        updateBasics({ detailsOrder: next } as any);
    };

    const reorderDetails = (from: number, to: number) => {
        const orderedKeys = detailEditorEntries.map(entry => entry.key);
        updateBasics({ detailsOrder: arrayMove(orderedKeys, from, to) } as any);
    };

    return (
        <div className="sidebar-scroll h-full min-h-0 bg-surface-4 rounded-[1.25rem] border border-edge p-6 pb-24 md:p-8 md:pb-24 lg:pb-8 space-y-8 text-strong overflow-y-auto [overscroll-behavior-y:contain] [will-change:scroll-position]">
            <div className="flex items-center justify-between mb-8">
                <div
                    data-testid="basics-form-back"
                    className="flex items-center gap-3 text-faint hover:text-strong transition-colors cursor-pointer"
                    onClick={onBack}
                >
                    <div className="h-8 w-8 rounded-lg bg-surface-1 border border-edge flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                    </div>
                </div>
                <h2 className="text-xl font-medium tracking-tight text-strong/90">{t("editor.editPersonal")}</h2>
            </div>

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                        <Input
                            label={t("editor.fullName")}
                            value={resume.basics.name}
                            onChange={(e: any) => updateBasics({ name: e.target.value })}
                            placeholder={t("editor.fullNamePlaceholder")}
                            data-testid="basics-name-input"
                        />
                        <Input
                            label={t("editor.professionalTitle")}
                            value={resume.basics.headline}
                            onChange={(e: any) => updateBasics({ headline: e.target.value })}
                            placeholder={t("editor.titlePlaceholder")}
                            data-testid="basics-headline-input"
                        />
                    </div>
                    <div className="flex flex-col items-center justify-start space-y-2">
                        <label className="text-[11px] font-medium text-faint uppercase tracking-wider w-full text-center">{t("editor.photo")}</label>
                        <div
                            className="h-28 w-28 shrink-0 rounded-[0.875rem] bg-surface-1 border-2 border-dashed border-edge flex flex-col items-center justify-center text-faint cursor-pointer hover:border-dim transition-colors overflow-hidden group relative"
                            onClick={() => {
                                if (resume.basics.photo) {
                                    handleEditPhoto();
                                    return;
                                }

                                fileInputRef.current?.click();
                            }}
                        >
                            {resume.basics.photo ? (
                                <>
                                    <img src={resume.basics.photo} alt={t("editor.photo")} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Camera className="w-6 h-6 text-strong" />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Camera className="w-7 h-7 mb-1 opacity-50 group-hover:opacity-100 transition-opacity" />
                                </>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="h-9 px-3 rounded-xl border border-edge text-[11px] font-medium text-faint hover:text-strong hover:border-faint transition-colors"
                            >
                                {t("editor.upload")}
                            </button>
                            <button
                                type="button"
                                onClick={handleEditPhoto}
                                disabled={!resume.basics.photo}
                                className="h-9 px-3 rounded-xl border border-edge text-[11px] font-medium text-faint hover:text-strong hover:border-faint disabled:opacity-40 disabled:hover:text-faint disabled:hover:border-edge transition-colors"
                            >
                                {t("editor.edit")}
                            </button>
                            <button
                                type="button"
                                onClick={handleRemovePhoto}
                                disabled={!resume.basics.photo}
                                className="h-9 px-3 rounded-xl border border-edge text-[11px] font-medium text-danger hover:border-danger/60 disabled:opacity-40 disabled:hover:border-edge transition-colors"
                            >
                                {t("editor.remove")}
                            </button>
                        </div>
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handlePhotoUpload} />
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-strong/90">{t("editor.detailsDrag")}</h3>
                    <div className="space-y-3">
                        <SortableList
                            items={detailEditorEntries}
                            getId={(entry) => entry.key}
                            onReorder={reorderDetails}
                            describe={(entry) => entry.label}
                        >
                        {(entry, index, { itemProps, handleProps, isDragging }) => {
                            const optionalDetail = OPTIONAL_PERSONAL_DETAILS.find(d => d.id === entry.id);
                            const measurementSystem = resume.settings?.measurementSystem === "imperial" ? "imperial" : "metric";

                            return (
                                <div
                                    {...itemProps}
                                    data-testid={`detail-card-${entry.key}`}
                                    className={`bg-surface-1 border rounded-xl p-3 hover:border-faint transition-colors ${isDragging ? "border-accent shadow-lg" : "border-edge"} [&_input]:select-text [&_textarea]:select-text [&_input]:caret-accent [&_textarea]:caret-accent`}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center min-w-0 gap-2">
                                            <button
                                                type="button"
                                                {...handleProps}
                                                data-testid={`detail-drag-${entry.key}`}
                                                aria-label={t("editor.dragFromHere")}
                                                className="w-6 h-6 rounded-md border border-edge text-faint hover:text-strong hover:border-faint cursor-grab active:cursor-grabbing flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                                title={t("editor.dragFromHere")}
                                            >
                                                <span className="grid grid-cols-2 gap-[2px]">
                                                    <span className="w-[2px] h-[2px] rounded-full bg-current" />
                                                    <span className="w-[2px] h-[2px] rounded-full bg-current" />
                                                    <span className="w-[2px] h-[2px] rounded-full bg-current" />
                                                    <span className="w-[2px] h-[2px] rounded-full bg-current" />
                                                    <span className="w-[2px] h-[2px] rounded-full bg-current" />
                                                    <span className="w-[2px] h-[2px] rounded-full bg-current" />
                                                </span>
                                            </button>
                                            <span className="text-sm text-strong/90 truncate">{entry.label}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => moveDetailOrder(entry.key, "up")}
                                                disabled={index === 0}
                                                className="w-7 h-7 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint disabled:opacity-35 disabled:hover:text-faint disabled:hover:border-edge transition-colors flex items-center justify-center"
                                            >
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveDetailOrder(entry.key, "down")}
                                                disabled={index === detailEditorEntries.length - 1}
                                                className="w-7 h-7 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint disabled:opacity-35 disabled:hover:text-faint disabled:hover:border-edge transition-colors flex items-center justify-center"
                                            >
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            </button>
                                            {(() => {
                                                const isRequired = entry.type === "field" && (entry.id === "email" || entry.id === "phone" || entry.id === "location");
                                                if (isRequired) return null;
                                                return (
                                                    <button
                                                        type="button"
                                                        aria-label={t("editor.removeField", { name: entry.label })}
                                                        onClick={() => {
                                                            if (entry.type === "custom") {
                                                                removeCustomLink(entry.id);
                                                                return;
                                                            }
                                                            updateBasics({ [entry.id]: "" });
                                                            setShowOptional(prev => ({ ...prev, [entry.id]: false }));
                                                            removeFromOrder(getFieldOrderKey(entry.id));
                                                        }}
                                                        className="w-7 h-7 rounded-lg border border-edge text-faint hover:text-danger hover:border-danger/60 transition-colors flex items-center justify-center"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {entry.type === "field" && entry.id === "email" && (
                                        <MultiEmailInput
                                            label={t("editor.emailLabel")}
                                            value={resume.basics.emails.length > 0
                                                ? resume.basics.emails
                                                : getResumeEmails(resume.basics)}
                                            onChange={(emails) => updateBasics({ emails })}
                                            addressLabel={t("editor.emailAddressLabel")}
                                            addressPlaceholder={t("editor.emailPlaceholder")}
                                            customLabel={t("editor.emailCustomLabel")}
                                            customLabelPlaceholder={t("editor.emailCustomLabelPlaceholder")}
                                            addLabel={t("editor.addEmail")}
                                            removeLabel={t("editor.removeEmail")}
                                            moveUpLabel={t("editor.moveUp")}
                                            moveDownLabel={t("editor.moveDown")}
                                        />
                                    )}
                                    {entry.type === "field" && entry.id === "phone" && (
                                        <div className="space-y-2">
                                            <CountryDisplayToggle
                                                value={(resume.settings?.phoneDisplay ?? "both") as CountryDisplayMode}
                                                onChange={(mode) => updateSettings({ phoneDisplay: mode })}
                                            />
                                            <MultiPhoneInput
                                                label={t("editor.phoneLabel")}
                                                value={resume.basics.phone}
                                                onChange={(next) => updateBasics({ phone: next })}
                                                addLabel={t("editor.addPhone")}
                                            />
                                        </div>
                                    )}
                                    {entry.type === "field" && entry.id === "location" && (
                                        <Input
                                            label={t("editor.locationLabel")}
                                            value={resume.basics.location}
                                            onChange={(e: any) => updateBasics({ location: e.target.value })}
                                            placeholder={t("editor.locationPlaceholder")}
                                        />
                                    )}
                                    {entry.type === "field" && entry.id === "github" && (
                                        <LinkInput
                                            label={t("editor.githubLabel")}
                                            url={resume.basics.github || ""}
                                            onUrlChange={(v) => updateBasics({ github: v })}
                                            placeholder={t("editor.githubPlaceholder")}
                                        />
                                    )}
                                    {entry.type === "field" && optionalDetail && (
                                        <div className="relative group">
                                            {optionalDetail.id === "dateOfBirth" ? (
                                                <DateOfBirthPicker
                                                    label={t(optionalDetail.labelKey)}
                                                    value={(resume.basics as any)[optionalDetail.id] || ""}
                                                    onChange={(next) => updateBasics({ [optionalDetail.id]: next })}
                                                    icon={PERSONAL_DETAIL_ICON_MAP[optionalDetail.id]}
                                                    language={language}
                                                />
                                            ) : optionalDetail.id === "nationality" ? (
                                                <div className="space-y-2">
                                                    <CountryDisplayToggle
                                                        value={(resume.settings?.nationalityDisplay ?? "both") as CountryDisplayMode}
                                                        onChange={(mode) => updateSettings({ nationalityDisplay: mode })}
                                                        nameStyle={resume.settings?.nationalityNameStyle ?? "country"}
                                                        onNameStyleChange={(nationalityNameStyle) => updateSettings({ nationalityNameStyle })}
                                                    />
                                                    <CountryDropdown
                                                        label={t(optionalDetail.labelKey)}
                                                        value={(resume.basics as any)[optionalDetail.id] || ""}
                                                        onChange={(val) => updateBasics({ [optionalDetail.id]: val })}
                                                        display={(resume.settings?.nationalityDisplay ?? "both") as CountryDisplayMode}
                                                        nameStyle={resume.settings?.nationalityNameStyle ?? "country"}
                                                        language={language}
                                                    />
                                                </div>
                                            ) : optionalDetail.id === "drivingLicense" ? (
                                                <div className="space-y-2">
                                                    <CountryDisplayToggle
                                                        value={(resume.settings?.licenseDisplay ?? "both") as CountryDisplayMode}
                                                        onChange={(mode) => updateSettings({ licenseDisplay: mode })}
                                                    />
                                                    <DrivingLicenseInput
                                                        label={t(optionalDetail.labelKey)}
                                                        value={(resume.basics as any)[optionalDetail.id] || ""}
                                                        onChange={(val) => updateBasics({ [optionalDetail.id]: val })}
                                                    />
                                                </div>
                                            ) : optionalDetail.id === "passport" ? (
                                                <div className="space-y-2">
                                                    <CountryDisplayToggle
                                                        value={(resume.settings?.passportDisplay ?? "both") as CountryDisplayMode}
                                                        onChange={(mode) => updateSettings({ passportDisplay: mode })}
                                                    />
                                                    <MultiDocumentInput
                                                        label={t(optionalDetail.labelKey)}
                                                        value={(resume.basics as any)[optionalDetail.id] || ""}
                                                        onChange={(val) => updateBasics({ [optionalDetail.id]: val })}
                                                        placeholder={t("editor.passportNumberPlaceholder")}
                                                        addLabel={t("editor.addPassport")}
                                                    />
                                                </div>
                                            ) : optionalDetail.id === "maritalStatus" ? (
                                                <MaritalStatusInput
                                                    label={t(optionalDetail.labelKey)}
                                                    value={(resume.basics as any)[optionalDetail.id] || ""}
                                                    onChange={(val) => updateBasics({ [optionalDetail.id]: val })}
                                                    language={language}
                                                />
                                            ) : optionalDetail.id === "disability" ? (
                                                <DisabilityInput
                                                    label={t(optionalDetail.labelKey)}
                                                    value={(resume.basics as any)[optionalDetail.id] || ""}
                                                    onChange={(val) => updateBasics({ [optionalDetail.id]: val })}
                                                    language={language}
                                                />
                                            ) : optionalDetail.id === "militaryService" ? (
                                                <div className="space-y-2">
                                                    <CountryDisplayToggle
                                                        value={(resume.settings?.militaryServiceDisplay ?? "both") as CountryDisplayMode}
                                                        onChange={(mode) => updateSettings({ militaryServiceDisplay: mode })}
                                                    />
                                                    <MultiDocumentInput
                                                        label={t(optionalDetail.labelKey)}
                                                        value={(resume.basics as any)[optionalDetail.id] || ""}
                                                        onChange={(val) => updateBasics({ [optionalDetail.id]: val })}
                                                        placeholder={t("editor.militaryServicePlaceholder")}
                                                        addLabel={t("editor.addMilitaryService")}
                                                    />
                                                </div>
                                            ) : optionalDetail.id === "visa" ? (
                                                <div className="space-y-2">
                                                    <CountryDisplayToggle
                                                        value={(resume.settings?.visaDisplay ?? "both") as CountryDisplayMode}
                                                        onChange={(mode) => updateSettings({ visaDisplay: mode })}
                                                    />
                                                    <MultiDocumentInput
                                                        label={t(optionalDetail.labelKey)}
                                                        value={(resume.basics as any)[optionalDetail.id] || ""}
                                                        onChange={(val) => updateBasics({ [optionalDetail.id]: val })}
                                                        placeholder={t("editor.visaPlaceholder")}
                                                        addLabel={t("editor.addVisa")}
                                                    />
                                                </div>
                                            ) : optionalDetail.id === "nationalId" ? (
                                                <div className="space-y-2">
                                                    <CountryDisplayToggle
                                                        value={(resume.settings?.nationalIdDisplay ?? "both") as CountryDisplayMode}
                                                        onChange={(mode) => updateSettings({ nationalIdDisplay: mode })}
                                                    />
                                                    <MultiDocumentInput
                                                        label={t(optionalDetail.labelKey)}
                                                        value={(resume.basics as any)[optionalDetail.id] || ""}
                                                        onChange={(val) => updateBasics({ [optionalDetail.id]: val })}
                                                        placeholder={t("editor.nationalIdPlaceholder")}
                                                        addLabel={t("editor.addNationalId")}
                                                    />
                                                </div>
                                            ) : (
                                                <Input
                                                    label={t(optionalDetail.labelKey)}
                                                    value={(resume.basics as any)[optionalDetail.id] || ""}
                                                    onChange={(e: any) => updateBasics({ [optionalDetail.id]: e.target.value })}
                                                    placeholder={optionalDetail.id === "height" ? t("common.example", { example: measurementSystem === "metric" ? "180 cm" : `5'11"` }) : t(optionalDetail.labelKey)}
                                                    type="text"
                                                    icon={PERSONAL_DETAIL_ICON_MAP[optionalDetail.id]}
                                                />
                                            )}
                                        </div>
                                    )}
                                    {entry.type === "custom" && (
                                        (() => {
                                            const link = (resume.basics.customLinks || []).find(l => l.id === entry.id);
                                            if (!link) return null;
                                            return (
                                                <LinkInput
                                                    label={link.name}
                                                    url={link.url}
                                                    displayLabel={link.label || ""}
                                                    onUrlChange={(v) => updateCustomLinkField(link.id, "url", v)}
                                                    onLabelChange={(v) => updateCustomLinkField(link.id, "label", v)}
                                                    iconValue={link.icon || "auto"}
                                                    onIconChange={(v) => updateCustomLinkField(link.id, "icon", v)}
                                                    placeholder={link.name === "Website" || link.name === "Portfolio Site" ? "example.com" : `${link.name.toLowerCase()}.com/username`}
                                                />
                                            );
                                        })()
                                    )}
                                </div>
                            );
                        }}
                        </SortableList>
                    </div>
                </div>

                <div className="pt-6 space-y-6 border-t border-edge">
                    <h3 className="text-sm font-medium text-strong/90">{t("editor.addDetails")}</h3>

                    <div className="space-y-3">
                        <span className="text-xs font-medium text-faint">{t("editor.personalDetails")}</span>
                        <div className="flex flex-wrap gap-2">
                            {OPTIONAL_PERSONAL_DETAILS.map(detail => {
                                const isVisible = showOptional[detail.id] || !!(resume.basics as any)[detail.id];
                                if (isVisible) return null;
                                const Icon = PERSONAL_DETAIL_ICON_MAP[detail.id];
                                return (
                                    <button
                                        key={detail.id}
                                        onClick={() => toggleOptional(detail.id)}
                                        className="flex items-center gap-2 px-3.5 py-2 bg-surface-1 border border-edge rounded-xl text-sm hover:bg-edge transition-colors text-faint hover:text-strong"
                                    >
                                        <Plus className="w-3 h-3" />
                                        {Icon && <Icon className="w-3 h-3" />}
                                        {t(detail.labelKey)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <span className="text-xs font-medium text-faint">{t("editor.linksSocial")}</span>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
                            <input
                                type="text"
                                value={socialSearch}
                                onChange={(e) => setSocialSearch(e.target.value)}
                                placeholder={t("editor.search")}
                                className="w-full bg-surface-1 border border-edge rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-faint transition-colors placeholder:text-faint/50 text-strong"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                            {availableNetworks.map(network => {
                                return (
                                    <button
                                        key={network}
                                        onClick={() => addCustomLink(network)}
                                        className="flex items-center gap-2 px-3.5 py-2 bg-surface-1 border border-edge rounded-xl text-sm hover:bg-edge transition-colors text-faint hover:text-strong"
                                    >
                                        <Plus className="w-3 h-3" />
                                        <SocialBrandIcon name={network} className="w-3 h-3" />
                                        {network === "Website" ? t("social.website") : network === "Portfolio Site" ? t("social.portfolio") : network}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="space-y-2 pt-6 border-t border-edge">
                    <div className="flex items-center justify-between">
                        <label id={summaryLabelId} className="text-[11px] font-medium text-faint uppercase tracking-wider">{t("editor.summary")}</label>
                        {AI_ENABLED && (
                            <button
                                onClick={handleGenerateSummary}
                                disabled={isGenerating}
                                className="text-xs font-medium flex items-center text-accent hover:text-accent-soft transition-colors disabled:opacity-50 cursor-pointer bg-accent/10 px-2.5 py-1 rounded-lg"
                            >
                                {isGenerating ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1.5" />}
                                {t("editor.autoWrite")}
                            </button>
                        )}
                    </div>
                    <MarkdownField
                        value={resume.basics.summary}
                        onChange={(summary) => updateBasics({ summary })}
                        labelledBy={summaryLabelId}
                        height={160}
                        textareaProps={{ "data-testid": "basics-summary-input", placeholder: t("editor.summaryPlaceholder") }}
                    />
                </div>

                <div className="space-y-4 pt-6 border-t border-edge">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-medium text-strong/90">{t("editor.metaSection")}</h3>
                            <p className="mt-1 text-xs text-faint">{t("editor.metaSectionDesc")}</p>
                        </div>

                        <div className="flex items-center gap-1">
                            {isEditingMeta ? (
                                <>
                                    <button
                                        onClick={saveMetaEdits}
                                        className="rounded-lg border border-success-tint2 bg-success-tint p-2 text-success-soft transition-colors hover:border-success-line hover:text-strong"
                                        title={t("editor.saveMeta")}
                                    >
                                        <Check className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={cancelEditingMeta}
                                        className="rounded-lg border border-edge bg-surface-3 p-2 text-faint transition-colors hover:border-faint hover:text-strong"
                                        title={t("dashboard.cancel")}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={startEditingMeta}
                                    className="rounded-lg border border-edge bg-surface-3 p-2 text-faint transition-colors hover:border-faint hover:text-strong"
                                    title={t("editor.editMeta")}
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {isEditingMeta ? (
                        <>
                            <Input
                                label={t("editor.metaTitle")}
                                value={draftMetaTitle}
                                onChange={(e: any) => setDraftMetaTitle(e.target.value)}
                                onKeyDown={(event: any) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        saveMetaEdits();
                                    }
                                    if (event.key === "Escape") {
                                        event.preventDefault();
                                        cancelEditingMeta();
                                    }
                                }}
                                placeholder={t("editor.metaTitlePlaceholder")}
                                data-testid="meta-title-input"
                            />

                            <div className="space-y-2">
                                <label className="text-[11px] font-medium text-faint uppercase tracking-wider">{t("editor.metaDescription")}</label>
                                <textarea
                                    value={draftMetaDescription}
                                    onChange={(e) => setDraftMetaDescription(e.target.value)}
                                    onKeyDown={(event) => {
                                        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                                            event.preventDefault();
                                            saveMetaEdits();
                                        }
                                        if (event.key === "Escape") {
                                            event.preventDefault();
                                            cancelEditingMeta();
                                        }
                                    }}
                                    rows={4}
                                    className="w-full resize-none rounded-xl border border-edge-strong bg-surface-3 px-4 py-3 text-sm leading-relaxed text-strong focus:outline-none focus:border-faint transition-colors placeholder:text-faint/50"
                                    placeholder={t("editor.metaDescriptionPlaceholder")}
                                    data-testid="meta-description-input"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-[11px] font-medium text-faint uppercase tracking-wider">{t("editor.metaTitle")}</label>
                                <p className="text-base font-medium text-strong">
                                    {resume.meta.title || (
                                        <span className="text-faint">{t("editor.metaTitlePlaceholder")}</span>
                                    )}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-medium text-faint uppercase tracking-wider">{t("editor.metaDescription")}</label>
                                <p className="min-h-[112px] whitespace-pre-wrap text-sm leading-relaxed text-strong">
                                    {resume.meta.description || (
                                        <span className="text-faint">{t("editor.metaDescriptionPlaceholder")}</span>
                                    )}
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="border-t border-edge pt-8 mt-8">
                <h2 className="text-lg font-medium tracking-tight mb-2 text-faint">{t("editor.moreSections")}</h2>
            </div>

            <PhotoCropModal
                isOpen={!!photoCropSource}
                imageSrc={photoCropSource}
                initialEdit={photoCropInitial}
                onClose={closePhotoCropper}
                onApply={handlePhotoCropApply}
            />
        </div>
    );
}

function DeclarationForm() {
    const { t } = useTranslation();
    const items = useResumeStore((state) => state.resume.declaration) || [];
    const cvLanguage = useResumeStore((state) => state.resume.settings?.language || "en");
    const updateDeclaration = useResumeStore((state) => state.updateDeclaration);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [signatureIndex, setSignatureIndex] = useState<number | null>(null);

    const keyOf = (item: any, index: number) => String(item.id || index);
    const updateItem = (index: number, patch: any) => {
        const next = [...items];
        next[index] = { ...next[index], ...patch };
        updateDeclaration(next);
    };
    const move = (index: number, dir: "up" | "down") => {
        const target = dir === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= items.length) return;
        const next = [...items];
        [next[index], next[target]] = [next[target], next[index]];
        updateDeclaration(next);
    };
    const remove = (index: number) => updateDeclaration(items.filter((_, i) => i !== index));
    const add = () => updateDeclaration([
        ...items,
        { id: createId(), hidden: false, text: "", signature: "", fullName: "", place: "", date: "" },
    ]);

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                {items.map((item: any, index: number) => {
                    const entryKey = keyOf(item, index);
                    return (
                        <div key={entryKey} data-entry-index={index}>
                            <div
                                className="flex items-center justify-between gap-2 mb-2 cursor-pointer"
                                onDoubleClick={() => setCollapsed((prev) => ({ ...prev, [entryKey]: !prev[entryKey] }))}
                                title={t("editor.doubleClickCollapse")}
                            >
                                <span className="text-xs text-faint font-medium uppercase tracking-wider">
                                    {t("editor.entryNumber", { number: index + 1 })}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => move(index, "up")}
                                        disabled={index === 0}
                                        className="w-7 h-7 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint disabled:opacity-35 disabled:hover:text-faint disabled:hover:border-edge transition-colors flex items-center justify-center"
                                    >
                                        <ChevronUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => move(index, "down")}
                                        disabled={index === items.length - 1}
                                        className="w-7 h-7 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint disabled:opacity-35 disabled:hover:text-faint disabled:hover:border-edge transition-colors flex items-center justify-center"
                                    >
                                        <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {!collapsed[entryKey] && (
                                <div className="bg-surface-1 border border-edge rounded-2xl p-6 space-y-5 text-strong shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold tracking-tight text-strong/90">{t("editor.editEntry")}</h3>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => updateItem(index, { hidden: !item.hidden })}
                                                aria-label={item.hidden ? t("editor.showEntry") : t("editor.hideEntry")}
                                                title={item.hidden ? t("editor.showEntry") : t("editor.hideEntry")}
                                                className={`w-8 h-8 rounded-lg bg-surface-4 border transition-colors flex items-center justify-center shadow-sm ${
                                                    item.hidden ? "border-faint text-mid hover:text-strong" : "border-edge text-faint hover:text-strong"
                                                }`}
                                            >
                                                {item.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => remove(index)}
                                                className="w-8 h-8 rounded-lg bg-surface-4 border border-edge text-faint hover:text-danger transition-colors flex items-center justify-center shadow-sm"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-medium text-faint uppercase tracking-wider">{t("editor.declarationText")}</label>
                                        <textarea
                                            value={item.text || ""}
                                            onChange={(e) => updateItem(index, { text: e.target.value })}
                                            rows={3}
                                            className="w-full bg-surface-4 border border-edge rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-faint transition-colors placeholder:text-faint/50 text-strong resize-none leading-relaxed"
                                            placeholder={t("editor.declarationTextPlaceholder")}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-medium text-faint uppercase tracking-wider">{t("editor.declarationSignature")}</label>
                                        <div className="rounded-xl border border-edge bg-surface-4 p-4 flex items-center justify-center min-h-[96px]">
                                            {item.signature ? (
                                                <img src={item.signature} alt={t("editor.declarationSignature")} className="max-h-24 max-w-full object-contain" style={{ background: "#ffffff" }} />
                                            ) : (
                                                <span className="text-sm text-faint">{t("editor.declarationNoSignature")}</span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSignatureIndex(index)}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-edge text-sm font-medium text-faint hover:text-strong hover:border-faint transition-colors"
                                        >
                                            <PenIcon className="w-4 h-4" />
                                            {item.signature ? t("editor.edit") : t("editor.declarationAddSignature")}
                                        </button>
                                    </div>

                                    <Input
                                        label={t("editor.declarationFullName")}
                                        value={item.fullName || ""}
                                        onChange={(e: any) => updateItem(index, { fullName: e.target.value })}
                                        placeholder={t("editor.declarationFullNamePlaceholder")}
                                    />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label={t("editor.declarationPlace")}
                                            value={item.place || ""}
                                            onChange={(e: any) => updateItem(index, { place: e.target.value })}
                                            placeholder={t("editor.declarationPlacePlaceholder")}
                                        />
                                        <DatePicker
                                            label={t("editor.declarationDate")}
                                            value={item.date || ""}
                                            onChange={(v) => updateItem(index, { date: v })}
                                            precision="day"
                                            language={cvLanguage}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={add}
                data-testid="declaration-add-entry"
                className="w-full flex items-center justify-center gap-2 py-3 bg-surface-1 border border-dashed border-faint rounded-xl text-sm font-medium text-faint hover:text-strong hover:border-faint transition-colors"
            >
                <Plus className="w-4 h-4" />
                {t("editor.addDeclaration")}
            </button>

            <SignatureModal
                key={signatureIndex ?? "closed"}
                isOpen={signatureIndex !== null}
                onClose={() => setSignatureIndex(null)}
                onSave={(dataUrl) => {
                    if (signatureIndex !== null) updateItem(signatureIndex, { signature: dataUrl });
                    setSignatureIndex(null);
                }}
            />
        </div>
    );
}

// ----------------------------------------------------
// SIDEBAR OVERVIEW & MAIN EXPORT
// ----------------------------------------------------

import { Mail, Phone, MapPin, Edit2 } from "lucide-react";
import { CustomizeSidebar } from "./CustomizeSidebar";

type ContentSectionDef = ContentSectionDefinition & {
    title: string;
    description: string;
};

function getContentSectionDefs(t: (key: string) => string): ContentSectionDef[] {
    return CONTENT_SECTIONS
        .filter((section) => section.addable)
        .map((section) => ({
            ...section,
            title: t(section.labelKey),
            description: t(section.descriptionKey),
        }));
}

const SKILL_GROUP_DROP_PREFIX = "skill-group:";

/**
 * Skills prefer the row under the pointer, then the group card under it (so an
 * empty or collapsed group still accepts a drop); keyboard drags, which have
 * no pointer, move between rows only.
 */
const skillCollision: CollisionDetection = (args) => {
    const hits = pointerWithin(args);
    const rows = hits.filter((hit) => !String(hit.id).startsWith(SKILL_GROUP_DROP_PREFIX));
    if (rows.length > 0) return rows;
    if (hits.length > 0) return hits;
    return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) => !String(container.id).startsWith(SKILL_GROUP_DROP_PREFIX)),
    });
};

function sectionBaseId(sectionKey: string): string {
    return contentSectionBaseId(sectionKey);
}

export { hasContentSection };

function sectionDefById(id: string, defs: ContentSectionDef[]): ContentSectionDef | undefined {
    return defs.find(s => s.id === id);
}

const SKILL_LEVEL_LABEL_KEYS: Record<SkillLevel, string> = {
    beginner: "editor.skillLevelBeginner",
    amateur: "editor.skillLevelAmateur",
    competent: "editor.skillLevelCompetent",
    proficient: "editor.skillLevelProficient",
    expert: "editor.skillLevelExpert",
};

function SectionEditForm({
    sectionKey,
    onBack,
    onRemove,
    scrollToEntry,
    onAddEntry,
}: {
    sectionKey: string;
    onBack: () => void;
    onRemove: () => void;
    scrollToEntry?: number | null;
    onScrolledToEntry?: () => void;
    /** Appends an entry and opens its editor; absent for sections without entries. */
    onAddEntry?: () => void;
}) {
    const { t, tn } = useTranslation();
    const resume = useResumeStore((state) => state.resume);
    const updateSettings = useResumeStore((state) => state.updateSettings);
    const updateEducation = useResumeStore((state) => state.updateEducation);
    const updateExperience = useResumeStore((state) => state.updateExperience);
    const updateCertificates = useResumeStore((state) => state.updateCertificates);
    const updateLanguages = useResumeStore((state) => state.updateLanguages);
    const updateProjects = useResumeStore((state) => state.updateProjects);
    const updateOrganisations = useResumeStore((state) => state.updateOrganisations);
    const updateCourses = useResumeStore((state) => state.updateCourses);
    const updateAwards = useResumeStore((state) => state.updateAwards);
    const updatePublications = useResumeStore((state) => state.updatePublications);
    const updateReferences = useResumeStore((state) => state.updateReferences);
    const updateInterests = useResumeStore((state) => state.updateInterests);
    const updateSkillGroups = useResumeStore((state) => state.updateSkillGroups);
    const updateCustomSections = useResumeStore((state) => state.updateCustomSections);
    const [collapsedEntries, setCollapsedEntries] = useState<Record<string, boolean>>({});
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [skillDrag, setSkillDrag] = useState<{ groupId: string; skillId: string } | null>(null);
    const [skillDropGroupId, setSkillDropGroupId] = useState<string | null>(null);
    const skillSortable = useSortableSetup((id) =>
        (resume.skillGroups || []).flatMap((group) => group.skills).find((skill) => skill.id === String(id))?.name ?? "",
    );
    const [skillImportMessage, setSkillImportMessage] = useState<string | null>(null);
    const [singleEntryDeleteOpen, setSingleEntryDeleteOpen] = useState(false);
    const formContainerRef = useRef<HTMLDivElement>(null);
    const CONTENT_SECTION_DEFS = getContentSectionDefs(t);

    const baseId = sectionBaseId(sectionKey);
    const resolvedDef = sectionDefById(baseId, CONTENT_SECTION_DEFS);
    const def = resolvedDef ?? CONTENT_SECTION_DEFS[0];
    const sectionDisplayMap = ((resume.settings as any)?.sectionDisplay || {}) as Record<string, { title?: string; icon?: string; showIcon?: boolean; languageLayout?: "list" | "table" | "cefr" }>;
    const sectionDisplay = sectionDisplayMap[baseId] || {};
    // Custom sections store their own title/content on the model (keyed by the
    // full `custom:<id>`), since sectionDisplay is keyed by base and would
    // collide across custom instances.
    const customSection = baseId === "custom"
        ? (resume.customSections || []).find((cs) => `custom:${cs.id}` === sectionKey) || null
        : null;
    const patchCustom = (patch: Partial<CustomSection>) => {
        if (!customSection) return;
        updateCustomSections((resume.customSections || []).map((cs) => (cs.id === customSection.id ? { ...cs, ...patch } : cs)));
    };
    const sectionTitle = customSection
        ? (customSection.title?.trim() || def.title)
        : (sectionDisplay.title?.trim() ? sectionDisplay.title.trim() : def.title);
    // When an entry index is targeted, the form edits that single entry only
    // (Skills keeps its group editor regardless). Otherwise it shows the section
    // "meta" editor (title/icon, or custom layout/content) with no entry list.
    const singleEntryMode = scrollToEntry != null && baseId !== "skills";

    // In single-entry mode, resolve the targeted entry + its update fn so the
    // section header can host its Get Tips / hide / delete controls (moved out
    // of EntryForm). Declaration uses its own form and is excluded.
    const singleSectionData: { items: any[]; updateFn: (items: any[]) => void } | null = (() => {
        if (!singleEntryMode) return null;
        switch (baseId) {
            case "education": return { items: resume.education || [], updateFn: updateEducation };
            case "experience": return { items: resume.experience || [], updateFn: updateExperience };
            case "certificates": return { items: resume.certificates || [], updateFn: updateCertificates };
            case "languages": return { items: resume.languages || [], updateFn: updateLanguages };
            case "projects": return { items: resume.projects || [], updateFn: updateProjects };
            case "organisations": return { items: resume.organisations || [], updateFn: updateOrganisations };
            case "courses": return { items: resume.courses || [], updateFn: updateCourses };
            case "awards": return { items: resume.awards || [], updateFn: updateAwards };
            case "publications": return { items: resume.publications || [], updateFn: updatePublications };
            case "references": return { items: resume.references || [], updateFn: updateReferences };
            case "interests": return { items: resume.interests || [], updateFn: updateInterests };
            case "custom": return customSection ? { items: customSection.entries || [], updateFn: (entries: any[]) => patchCustom({ entries }) } : null;
            default: return null;
        }
    })();
    const singleEntryItem = singleSectionData && scrollToEntry != null ? singleSectionData.items[scrollToEntry] : null;
    const patchSingleEntry = (patch: any) => {
        if (!singleSectionData || scrollToEntry == null) return;
        singleSectionData.updateFn(singleSectionData.items.map((it, i) => (i === scrollToEntry ? { ...it, ...patch } : it)));
    };
    const removeSingleEntry = () => {
        if (!singleSectionData || scrollToEntry == null) return;
        singleSectionData.updateFn(singleSectionData.items.filter((_, i) => i !== scrollToEntry));
        onBack();
    };
    const sectionIconKey = sectionDisplay.icon || "auto";
    const SectionIcon = sectionIconKey !== "auto" ? (CUSTOM_ICON_LUCIDE_MAP[sectionIconKey] || def.icon) : def.icon;
    const showSectionIcon = sectionDisplay.showIcon !== false;
    const updateSectionDisplay = (patch: Partial<{ title: string; icon: string; showIcon: boolean; languageLayout: "list" | "table" | "cefr" }>) => {
        updateSettings({
            sectionDisplay: {
                ...sectionDisplayMap,
                [baseId]: {
                    ...sectionDisplay,
                    ...patch,
                },
            },
        } as any);
    };

    const moveEntry = (index: number, dir: "up" | "down", items: any[], updateFn: (items: any[]) => void) => {
        const nextIndex = dir === "up" ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= items.length) return;
        const next = [...items];
        [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
        updateFn(next);
    };
    const toggleEntryCollapsed = (entryKey: string) => {
        setCollapsedEntries((prev) => ({ ...prev, [entryKey]: !prev[entryKey] }));
    };
    // Collect all locations from profile + all entries for autocomplete
    const allLocations = useMemo(() => {
        const locs = new Set<string>();
        if (resume.basics.location) locs.add(resume.basics.location);
        for (const exp of resume.experience || []) {
            if (exp.location) locs.add(exp.location);
        }
        for (const edu of resume.education || []) {
            if (edu.location) locs.add(edu.location);
        }
        for (const organisation of resume.organisations || []) {
            if (organisation.location) locs.add(organisation.location);
        }
        for (const course of resume.courses || []) {
            if (course.location) locs.add(course.location);
        }
        return Array.from(locs);
    }, [resume.basics.location, resume.experience, resume.education, resume.organisations, resume.courses]);

    // Collect all companies for experience autocomplete
    const allCompanies = useMemo(() => {
        const set = new Set<string>();
        for (const exp of resume.experience || []) {
            if (exp.company) set.add(exp.company);
        }
        return Array.from(set);
    }, [resume.experience]);

    // Collect all institutions for education/courses autocomplete
    const allInstitutions = useMemo(() => {
        const set = new Set<string>();
        for (const edu of resume.education || []) {
            if (edu.institution) set.add(edu.institution);
        }
        for (const course of resume.courses || []) {
            if (course.institution) set.add(course.institution);
        }
        return Array.from(set);
    }, [resume.education, resume.courses]);

    if (!resolvedDef) return null;

    const languageLevelOptions = ["A1", "A2", "B1", "B2", "C1", "C2", "Native"];
    const renderLanguageExtraFields = (item: any, onChange: (updated: any) => void) => {
        const isNative = isNativeLanguageFluency(item.fluency || "");
        const clearAssessment = {
            assessmentType: "none",
            issuer: "",
            assessmentId: "",
            assessmentUrl: "",
        };

        const cefrLevels: CefrSkillLevels = { ...emptyCefrSkillLevels(), ...(item.cefr || {}) };
        const detailed = Boolean(item.cefrDetailed) && !isNative;
        const setDetailed = (nextDetailed: boolean) => {
            if (!nextDetailed) {
                onChange({ ...item, cefrDetailed: false });
                return;
            }
            // Seed an untouched grid from the single level so nothing looks lost.
            const seeded = assessedCefrSkills(cefrLevels).length === 0 && isCefrLevel(item.fluency || "")
                ? { listening: item.fluency, reading: item.fluency, spokenInteraction: item.fluency, spokenProduction: item.fluency, writing: item.fluency }
                : cefrLevels;
            onChange({ ...item, cefrDetailed: true, cefr: seeded, fluency: deriveOverallCefrLevel(seeded) || item.fluency || "" });
        };

        return (
            <div className="space-y-4">
            <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[11px] font-medium text-faint uppercase tracking-wider">
                        {t("editor.languageProficiencyLevel")}
                    </label>
                    {!isNative && (
                        <div
                            role="group"
                            aria-label={t("editor.languageProficiencyLevel")}
                            className="grid grid-cols-2 gap-0.5 rounded-lg border border-edge bg-surface-1 p-0.5"
                        >
                            {[
                                { value: false, label: t("editor.languageLevelSimple") },
                                { value: true, label: t("editor.languageLevelDetailed") },
                            ].map((option) => (
                                <button
                                    key={String(option.value)}
                                    type="button"
                                    aria-pressed={detailed === option.value}
                                    data-testid={option.value ? "language-level-mode-detailed" : "language-level-mode-simple"}
                                    onClick={() => setDetailed(option.value)}
                                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                        detailed === option.value
                                            ? "bg-accent text-surface-2"
                                            : "text-faint hover:bg-surface-4 hover:text-strong"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {detailed ? (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                            <p className="min-w-0 flex-1 text-xs leading-5 text-mid">{t("editor.languageLevelDetailedHint")}</p>
                            {sectionDisplay.languageLayout !== "cefr" && (
                                <button
                                    type="button"
                                    data-testid="language-use-cefr-layout"
                                    onClick={() => updateSectionDisplay({ languageLayout: "cefr" })}
                                    className="rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-[11px] font-medium text-accent transition-colors hover:border-accent/50 hover:bg-accent/15"
                                >
                                    {t("editor.languageUseCefrLayout")}
                                </button>
                            )}
                        </div>
                        <CefrSkillGrid
                            value={cefrLevels}
                            onChange={(next) => onChange({ ...item, cefr: next, fluency: deriveOverallCefrLevel(next) })}
                        />
                    </div>
                ) : (
                <div className="flex flex-wrap gap-2">
                    {languageLevelOptions.map((level) => {
                        const active = (item.fluency || "") === level;
                        return (
                            <button
                                key={level}
                                type="button"
                                onClick={() => onChange({
                                    ...item,
                                    fluency: level,
                                    ...(level === "Native" ? clearAssessment : {}),
                                })}
                                className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                                    active
                                        ? "border-accent bg-accent text-surface-2"
                                        : "border-edge bg-surface-1 text-bright hover:border-faint hover:text-strong"
                                }`}
                            >
                                {level}
                            </button>
                        );
                    })}
                </div>
                )}
            </div>

            {isNative ? (
                <p className="rounded-xl border border-edge bg-surface-1 px-4 py-3 text-xs text-mid">
                    {t("editor.languageNativeAssessmentHint")}
                </p>
            ) : (
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[11px] font-medium text-faint uppercase tracking-wider">
                        {t("editor.languageAssessment")}
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-edge bg-surface-1 p-1">
                        {[
                            { value: "none", label: t("editor.languageNoAssessment") },
                            { value: "self", label: t("editor.languageSelfAssessed") },
                            { value: "issuer", label: t("editor.languageIssuerAssessed") },
                        ].map((option) => {
                            const active = (item.assessmentType || "none") === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => onChange({
                                        ...item,
                                        ...(option.value === "issuer" ? {} : clearAssessment),
                                        assessmentType: option.value,
                                    })}
                                    className={`rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                                        active
                                            ? "bg-accent text-surface-2"
                                            : "text-faint hover:bg-surface-4 hover:text-strong"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {(item.assessmentType || "none") === "issuer" && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Input
                            label={t("editor.languageIssuer")}
                            value={item.issuer || ""}
                            onChange={(event: any) => onChange({ ...item, issuer: event.target.value })}
                            placeholder={t("editor.languageIssuerPlaceholder")}
                        />
                        <Input
                            label={t("editor.languageAssessmentId")}
                            value={item.assessmentId || ""}
                            onChange={(event: any) => onChange({ ...item, assessmentId: event.target.value })}
                            placeholder={t("editor.languageAssessmentIdPlaceholder")}
                        />
                        <div className="md:col-span-2">
                            <Input
                                type="url"
                                label={t("editor.languageAssessmentUrl")}
                                value={item.assessmentUrl || ""}
                                onChange={(event: any) => onChange({ ...item, assessmentUrl: event.target.value })}
                                placeholder={t("editor.languageAssessmentUrlPlaceholder")}
                            />
                        </div>
                    </div>
                )}
            </div>
            )}
            </div>
        );
    };

    const renderSkillExtraFields = (item: any, onChange: (updated: any) => void) => {
        const displayOptions: { value: "name" | "icon" | "both"; label: string }[] = [
            { value: "name", label: t("editor.skillDisplayName") },
            { value: "icon", label: t("editor.skillDisplayIcon") },
            { value: "both", label: t("editor.skillDisplayBoth") },
        ];
        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[11px] font-medium text-faint uppercase tracking-wider">
                        {t("editor.skillLevel")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => onChange({ ...item, level: "" })}
                            className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                                !item.level
                                    ? "border-accent bg-accent text-surface-2"
                                    : "border-edge bg-surface-1 text-bright hover:border-faint hover:text-strong"
                            }`}
                        >
                            {t("editor.skillLevelNone")}
                        </button>
                        {SKILL_LEVELS.map((level) => {
                            const active = (item.level || "") === level;
                            return (
                                <button
                                    key={level}
                                    type="button"
                                    onClick={() => onChange({ ...item, level })}
                                    className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                                        active
                                            ? "border-accent bg-accent text-surface-2"
                                            : "border-edge bg-surface-1 text-bright hover:border-faint hover:text-strong"
                                    }`}
                                >
                                    {t(SKILL_LEVEL_LABEL_KEYS[level])}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <label className="text-[11px] font-medium text-faint uppercase tracking-wider">
                            {t("editor.skillIcon")}
                        </label>
                        <CustomIconSelect
                            linkName={item.name || ""}
                            value={item.icon || "auto"}
                            onChange={(icon) => onChange({ ...item, icon })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[11px] font-medium text-faint uppercase tracking-wider">
                            {t("editor.skillDisplay")}
                        </label>
                        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-edge bg-surface-1 p-1">
                            {displayOptions.map((option) => {
                                const active = (item.display || "both") === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => onChange({ ...item, display: option.value })}
                                        className={`h-8 rounded-lg text-xs font-semibold transition-colors ${
                                            active
                                                ? "bg-accent text-surface-2"
                                                : "text-bright hover:bg-surface-4 hover:text-strong"
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderSkillsUsedField = (item: any, onChange: (updated: any) => void) => (
        <TagsInput
            label={t("editor.skillsUsed")}
            value={(item.skills || []).join(", ")}
            onChange={(val) => onChange({ ...item, skills: val.split(",").map((s) => s.trim()).filter(Boolean) })}
            placeholder={t("editor.skillsUsedPlaceholder")}
        />
    );

    const handleImportSkillsFromSections = () => {
        const collected: string[] = [];
        for (const section of [resume.experience, resume.education, resume.projects, resume.certificates, resume.courses, resume.awards, resume.publications, resume.organisations]) {
            for (const entry of section || []) {
                for (const skill of (entry as any).skills || []) {
                    const trimmed = String(skill).trim();
                    if (trimmed) collected.push(trimmed);
                }
            }
        }

        const groups = resume.skillGroups || [];
        const existing = allSkills(groups);
        const seen = new Set(existing.map((s: any) => (s.name || "").trim().toLowerCase()));
        const additions: any[] = [];
        for (const name of collected) {
            const key = name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            additions.push({ id: createId(), name, description: "", level: "", icon: "auto", display: "both", keywords: [] });
        }

        if (additions.length > 0) {
            updateSkillGroups(groups.map((group) =>
                group.id === UNGROUPED_SKILL_GROUP_ID
                    ? { ...group, skills: [...group.skills, ...additions] }
                    : group,
            ));
            setSkillImportMessage(tn("editor.importSkillsDone", additions.length));
        } else {
            setSkillImportMessage(t("editor.importSkillsNone"));
        }
        window.setTimeout(() => setSkillImportMessage(null), 3000);
    };

    const renderEntryEditor = ({
        items,
        updateFn,
        config,
        addLabel,
        createEmptyItem,
        subtitleSuggestions,
        sortableGroupId,
    }: {
        items: any[];
        updateFn: (items: any[]) => void;
        config: any;
        addLabel: string;
        createEmptyItem: () => any;
        subtitleSuggestions?: string[];
        /** Rows join the surrounding DndContext as one list of a multi-list drag (skills). */
        sortableGroupId?: string;
    }) => {
        // In single-entry mode the editor renders only the targeted entry
        // (expanded, no reorder/add — those live on the section card).
        const renderList: Array<{ item: any; index: number }> = singleEntryMode
            ? (scrollToEntry != null && items[scrollToEntry] ? [{ item: items[scrollToEntry], index: scrollToEntry }] : [])
            : items.map((item, index) => ({ item, index }));
        const renderEntryRow = ({ item, index }: { item: any; index: number }, sortable?: SortableItemState) => (
                    <div key={item.id || index} data-entry-index={index} {...(sortable?.itemProps ?? {})}>
                        {!singleEntryMode && (
                        <div
                            className="flex items-center justify-between gap-2 mb-2 cursor-pointer"
                            onDoubleClick={() => toggleEntryCollapsed(String(item.id || index))}
                            title={t("editor.doubleClickCollapse")}
                        >
                            <span className="flex items-center gap-1.5 text-xs text-faint font-medium uppercase tracking-wider">
                                {sortable && (
                                    <button
                                        type="button"
                                        {...sortable.handleProps}
                                        onClick={(e) => e.stopPropagation()}
                                        aria-label={t("editor.dragFromHere")}
                                        title={t("editor.dragFromHere")}
                                        data-testid="entry-drag-handle"
                                        className="-ml-1 flex h-6 w-6 items-center justify-center rounded-md text-faint hover:bg-edge hover:text-strong cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                    >
                                        <GripVertical className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {t("editor.entryNumber", { number: index + 1 })}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        moveEntry(index, "up", items, updateFn);
                                    }}
                                    disabled={index === 0}
                                    className="w-7 h-7 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint disabled:opacity-35 disabled:hover:text-faint disabled:hover:border-edge transition-colors flex items-center justify-center"
                                >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        moveEntry(index, "down", items, updateFn);
                                    }}
                                    disabled={index === items.length - 1}
                                    className="w-7 h-7 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint disabled:opacity-35 disabled:hover:text-faint disabled:hover:border-edge transition-colors flex items-center justify-center"
                                >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                        )}
                        {(singleEntryMode || !collapsedEntries[String(item.id || index)]) && (
                            <EntryForm
                                item={item}
                                config={config}
                                sectionId={baseId}
                                onChange={(updated) => {
                                    const next = [...items];
                                    next[index] = updated;
                                    updateFn(next);
                                }}
                                onRemove={() => {
                                    const next = items.filter((_, i) => i !== index);
                                    updateFn(next);
                                    if (singleEntryMode) onBack();
                                }}
                                locationSuggestions={allLocations}
                                subtitleSuggestions={subtitleSuggestions}
                                flush={singleEntryMode}
                            />
                        )}
                    </div>
        );
        return (
        <div className="space-y-6">
            <div className="space-y-4">
                {sortableGroupId ? (
                    <SortableContext items={renderList.map(({ item }) => String(item.id))} strategy={verticalListSortingStrategy}>
                        {renderList.map((row) => (
                            <SortableRow key={String(row.item.id)} id={String(row.item.id)} data={{ groupId: sortableGroupId }}>
                                {(state) => renderEntryRow(row, state)}
                            </SortableRow>
                        ))}
                    </SortableContext>
                ) : renderList.map((row) => renderEntryRow(row))}
            </div>

            {!singleEntryMode && (
            <button
                type="button"
                onClick={() => updateFn([...items, createEmptyItem()])}
                data-testid={`${baseId}-add-entry`}
                className="w-full flex items-center justify-center gap-2 py-3 bg-surface-1 border border-dashed border-faint rounded-xl text-sm font-medium text-faint hover:text-strong hover:border-faint transition-colors"
            >
                <Plus className="w-4 h-4" />
                {addLabel}
            </button>
            )}
        </div>
        );
    };

    const renderContent = () => {
        // Flat-entry sections only render in single-entry mode; the section card
        // owns their entry list. Skills and Custom handle their own modes below.
        if (!singleEntryMode && baseId !== "skills" && baseId !== "custom") return null;

        if (baseId === "education") {
            const items = resume.education || [];

            const config = {
                titleLabel: t("editor.degree"),
                titlePlaceholder: t("editor.degreePlaceholder"),
                titleKey: "studyType",
                subtitleLabel: t("editor.school"),
                subtitlePlaceholder: t("editor.schoolPlaceholder"),
                subtitleKey: "institution",
                urlKey: "url",
                urlIconKey: "urlIcon",
                locationKey: "location",
                descriptionKey: "description",
                endDateLabel: t("editor.graduationDate"),
                extraFields: renderSkillsUsedField,
            };
            return renderEntryEditor({
                items,
                updateFn: updateEducation,
                config,
                addLabel: t("editor.addEducation"),
                subtitleSuggestions: allInstitutions,
                createEmptyItem: () => ({
                    id: createId(),
                    institution: "",
                    area: "",
                    studyType: "",
                    start: "",
                    end: "",
                    location: "",
                    description: "",
                    score: "",
                    courses: [],
                    url: "",
                    urlIcon: "auto",
                }),
            });
        }

        if (baseId === "courses") {
            const items = resume.courses || [];
            const config = {
                titleLabel: t("editor.courseName"),
                titlePlaceholder: t("editor.courseNamePlaceholder"),
                titleKey: "name",
                subtitleLabel: t("editor.courseInstitution"),
                subtitlePlaceholder: t("editor.courseInstitutionPlaceholder"),
                subtitleKey: "institution",
                urlKey: "url",
                urlIconKey: "urlIcon",
                locationKey: "location",
                descriptionKey: "description",
                extraFields: renderSkillsUsedField,
            };
            return renderEntryEditor({
                items,
                updateFn: updateCourses,
                config,
                addLabel: t("editor.addCourse"),
                subtitleSuggestions: allInstitutions,
                createEmptyItem: () => ({
                    id: createId(),
                    name: "",
                    institution: "",
                    start: "",
                    end: "",
                    location: "",
                    description: "",
                    skills: [],
                    url: "",
                    urlIcon: "auto",
                }),
            });
        }

        if (baseId === "experience") {
            const items = resume.experience || [];
            const config = {
                titleLabel: t("editor.jobTitle"),
                titlePlaceholder: t("editor.jobTitlePlaceholder"),
                titleKey: "position",
                subtitleLabel: t("editor.employer"),
                subtitlePlaceholder: t("editor.employerPlaceholder"),
                subtitleKey: "company",
                urlKey: "url",
                urlIconKey: "urlIcon",
                locationKey: "location",
                descriptionKey: "description",
                extraFields: renderSkillsUsedField,
            };
            return renderEntryEditor({
                items,
                updateFn: updateExperience,
                config,
                addLabel: t("editor.addExperience"),
                subtitleSuggestions: allCompanies,
                createEmptyItem: () => ({
                    id: createId(),
                    company: "",
                    position: "",
                    start: "",
                    end: "",
                    location: "",
                    description: "",
                    highlights: [],
                    url: "",
                    urlIcon: "auto",
                }),
            });
        }

        if (baseId === "certificates") {
            const items = resume.certificates || [];
            const config = {
                titleLabel: t("editor.certName"),
                titlePlaceholder: t("editor.certNamePlaceholder"),
                titleKey: "name",
                titleUrlKey: "url",
                titleUrlIconKey: "urlIcon",
                subtitleLabel: t("editor.issuingOrg"),
                subtitlePlaceholder: t("editor.issuingOrgPlaceholder"),
                subtitleKey: "issuer",
                urlKey: "issuerUrl",
                urlIconKey: "issuerUrlIcon",
                descriptionKey: "description",
                dateMode: "single" as const,
                singleDateKey: "date",
                singleDateLabel: t("editor.dateEarned"),
                extraFields: renderSkillsUsedField,
            };

            // Collect issuers for autocomplete
            const allIssuers = [...new Set(items.map((c: any) => c.issuer).filter(Boolean))];

            return renderEntryEditor({
                items,
                updateFn: updateCertificates,
                config,
                addLabel: t("editor.addCertificate"),
                subtitleSuggestions: allIssuers,
                createEmptyItem: () => ({
                    id: createId(),
                    name: "",
                    date: "",
                    issuer: "",
                    description: "",
                    url: "",
                    urlIcon: "auto",
                    issuerUrl: "",
                    issuerUrlIcon: "auto",
                }),
            });
        }

        if (baseId === "awards") {
            const items = resume.awards || [];
            const config = {
                titleLabel: t("editor.awardName"),
                titlePlaceholder: t("editor.awardNamePlaceholder"),
                titleKey: "name",
                subtitleLabel: t("editor.awardIssuer"),
                subtitlePlaceholder: t("editor.awardIssuerPlaceholder"),
                subtitleKey: "issuer",
                urlKey: "url",
                urlIconKey: "urlIcon",
                descriptionKey: "description",
                dateMode: "single" as const,
                singleDateKey: "date",
                singleDateLabel: t("editor.dateAwarded"),
                extraFields: renderSkillsUsedField,
            };

            // Collect issuers for autocomplete
            const allAwardIssuers = [...new Set(items.map((a: any) => a.issuer).filter(Boolean))];

            return renderEntryEditor({
                items,
                updateFn: updateAwards,
                config,
                addLabel: t("editor.addAward"),
                subtitleSuggestions: allAwardIssuers,
                createEmptyItem: () => ({
                    id: createId(),
                    name: "",
                    issuer: "",
                    date: "",
                    description: "",
                    skills: [],
                    url: "",
                    urlIcon: "auto",
                }),
            });
        }

        if (baseId === "publications") {
            const items = resume.publications || [];
            const config = {
                titleLabel: t("editor.publicationTitle"),
                titlePlaceholder: t("editor.publicationTitlePlaceholder"),
                titleKey: "name",
                titleUrlKey: "url",
                titleUrlIconKey: "urlIcon",
                subtitleLabel: t("editor.publicationPublisher"),
                subtitlePlaceholder: t("editor.publicationPublisherPlaceholder"),
                subtitleKey: "publisher",
                descriptionKey: "description",
                dateMode: "single" as const,
                singleDateKey: "date",
                singleDateLabel: t("editor.datePublished"),
                extraFields: renderSkillsUsedField,
            };

            // Collect publishers for autocomplete
            const allPublishers = [...new Set(items.map((p: any) => p.publisher).filter(Boolean))];

            return renderEntryEditor({
                items,
                updateFn: updatePublications,
                config,
                addLabel: t("editor.addPublication"),
                subtitleSuggestions: allPublishers,
                createEmptyItem: () => ({
                    id: createId(),
                    name: "",
                    publisher: "",
                    date: "",
                    description: "",
                    skills: [],
                    url: "",
                    urlIcon: "auto",
                }),
            });
        }

        if (baseId === "references") {
            const items = resume.references || [];
            const renderReferenceFields = (item: any, onChange: (updated: any) => void) => (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label={t("editor.referenceOrganisation")}
                        value={item.organisation || ""}
                        onChange={(e: any) => onChange({ ...item, organisation: e.target.value })}
                        placeholder={t("editor.referenceOrganisationPlaceholder")}
                    />
                    <Input
                        type="email"
                        label={t("editor.referenceEmail")}
                        value={item.email || ""}
                        onChange={(e: any) => onChange({ ...item, email: e.target.value })}
                        placeholder={t("editor.referenceEmailPlaceholder")}
                    />
                    <Input
                        label={t("editor.referencePhone")}
                        value={item.phone || ""}
                        onChange={(e: any) => onChange({ ...item, phone: e.target.value })}
                        placeholder={t("editor.referencePhonePlaceholder")}
                    />
                    <LinkInput
                        label={t("editor.referenceProfile")}
                        url={item.url || ""}
                        onUrlChange={(val) => onChange({ ...item, url: val })}
                        iconValue={item.urlIcon || "auto"}
                        onIconChange={(val) => onChange({ ...item, urlIcon: val })}
                        placeholder="linkedin.com/in/username"
                    />
                </div>
            );
            const config = {
                titleLabel: t("editor.referenceName"),
                titlePlaceholder: t("editor.referenceNamePlaceholder"),
                titleKey: "name",
                subtitleLabel: t("editor.referencePosition"),
                subtitlePlaceholder: t("editor.referencePositionPlaceholder"),
                subtitleKey: "position",
                descriptionKey: "description",
                descriptionLabel: t("editor.referenceNote"),
                dateMode: "none" as const,
                extraFields: renderReferenceFields,
            };

            return renderEntryEditor({
                items,
                updateFn: updateReferences,
                config,
                addLabel: t("editor.addReference"),
                createEmptyItem: () => ({
                    id: createId(),
                    name: "",
                    position: "",
                    organisation: "",
                    email: "",
                    phone: "",
                    description: "",
                    url: "",
                    urlIcon: "auto",
                }),
            });
        }

        if (baseId === "declaration") {
            return <DeclarationForm />;
        }

        if (baseId === "languages") {
            const items = resume.languages || [];
            const config = {
                titleLabel: t("editor.languageName"),
                titlePlaceholder: t("editor.languageNamePlaceholder"),
                titleKey: "language",
                descriptionKey: "description",
                descriptionLabel: t("editor.additionalInformation"),
                dateMode: "none" as const,
                extraFields: renderLanguageExtraFields,
            };

            return renderEntryEditor({
                items,
                updateFn: updateLanguages,
                config,
                addLabel: t("editor.addLanguage"),
                createEmptyItem: () => ({
                    id: createId(),
                    language: "",
                    fluency: "B2",
                    assessmentType: "none",
                    issuer: "",
                    assessmentId: "",
                    assessmentUrl: "",
                    description: "",
                }),
            });
        }

        if (baseId === "projects") {
            const items = resume.projects || [];
            const config = {
                titleLabel: t("editor.projectTitle"),
                titlePlaceholder: t("editor.projectTitlePlaceholder"),
                titleKey: "name",
                subtitleLabel: t("editor.subTitle"),
                subtitlePlaceholder: t("editor.subTitlePlaceholder"),
                subtitleKey: "subtitle",
                urlKey: "url",
                urlIconKey: "urlIcon",
                descriptionKey: "description",
                extraFields: (item: any, onChange: (updated: any) => void) => (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-[11px] font-medium text-faint uppercase tracking-wider">
                                    {t("editor.projectIcon")}
                                </label>
                                <CustomIconSelect
                                    linkName={item.name || ""}
                                    value={item.icon || ""}
                                    onChange={(icon) => onChange({ ...item, icon })}
                                    noneLabel={t("editor.projectIconNone")}
                                />
                            </div>
                            {isGithubProject(item) && (
                                <div className="space-y-2">
                                    <label className="text-[11px] font-medium text-faint uppercase tracking-wider">
                                        {t("editor.repoVisibility")}
                                    </label>
                                    <div role="radiogroup" aria-label={t("editor.repoVisibility")} className="grid grid-cols-3 gap-1.5 rounded-xl border border-edge bg-surface-1 p-1">
                                        {([
                                            { value: "", label: t("editor.repoVisibilityUnset") },
                                            { value: "public", label: t("editor.repoVisibilityPublic") },
                                            { value: "private", label: t("editor.repoVisibilityPrivate") },
                                        ] as const).map((option) => {
                                            const active = (item.visibility || "") === option.value;
                                            return (
                                                <button
                                                    key={option.value || "unset"}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={active}
                                                    onClick={() => onChange({ ...item, visibility: option.value })}
                                                    data-testid={`project-visibility-${option.value || "unset"}`}
                                                    className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                                                        active ? "bg-edge text-strong" : "text-faint hover:text-strong"
                                                    }`}
                                                >
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <RepoLinksEditor
                            repos={item.repos || []}
                            onChange={(repos) => onChange({ ...item, repos })}
                        />
                        {renderSkillsUsedField(item, onChange)}
                    </div>
                ),
            };
            return renderEntryEditor({
                items,
                updateFn: updateProjects,
                config,
                addLabel: t("editor.addProject"),
                createEmptyItem: () => ({
                    id: createId(),
                    name: "",
                    subtitle: "",
                    description: "",
                    highlights: [],
                    keywords: [],
                    start: "",
                    end: "",
                    url: "",
                    urlIcon: "auto",
                    repos: [],
                }),
            });
        }

        if (baseId === "organisations") {
            const items = resume.organisations || [];
            const config = {
                titleLabel: t("editor.organisationName"),
                titlePlaceholder: t("editor.organisationNamePlaceholder"),
                titleKey: "name",
                subtitleLabel: t("editor.organisationRole"),
                subtitlePlaceholder: t("editor.organisationRolePlaceholder"),
                subtitleKey: "role",
                urlKey: "url",
                urlIconKey: "urlIcon",
                locationKey: "location",
                descriptionKey: "description",
                extraFields: renderSkillsUsedField,
            };
            return renderEntryEditor({
                items,
                updateFn: updateOrganisations,
                config,
                addLabel: t("editor.addOrganisation"),
                createEmptyItem: () => ({
                    id: createId(),
                    name: "",
                    role: "",
                    start: "",
                    end: "",
                    location: "",
                    description: "",
                    skills: [],
                    url: "",
                    urlIcon: "auto",
                }),
            });
        }

        if (baseId === "interests") {
            const items = resume.interests || [];
            const config = {
                titleLabel: t("editor.interestName"),
                titlePlaceholder: t("editor.interestNamePlaceholder"),
                titleKey: "name",
                descriptionKey: "description",
                descriptionLabel: t("editor.additionalInformation"),
                dateMode: "none" as const,
            };
            return renderEntryEditor({
                items,
                updateFn: updateInterests,
                config,
                addLabel: t("editor.addInterest"),
                createEmptyItem: () => ({
                    id: createId(),
                    name: "",
                    description: "",
                }),
            });
        }

        if (baseId === "skills") {
            const skillGroups = resume.skillGroups || [];
            const config = {
                titleLabel: t("editor.skillName"),
                titlePlaceholder: t("editor.skillNamePlaceholder"),
                titleKey: "name",
                descriptionKey: "description",
                descriptionLabel: t("editor.additionalInformation"),
                dateMode: "none" as const,
                extraFields: renderSkillExtraFields,
            };
            const createEmptySkill = () => ({
                id: createId(),
                name: "",
                description: "",
                level: "",
                icon: "auto",
                display: "both",
                keywords: [],
            });
            const patchGroup = (groupId: string, patch: Partial<SkillGroup>) => {
                updateSkillGroups(skillGroups.map((group) =>
                    group.id === groupId ? { ...group, ...patch } : group,
                ));
            };
            const deleteGroup = (groupId: string) => {
                const doomed = skillGroups.find((group) => group.id === groupId);
                if (!doomed || groupId === UNGROUPED_SKILL_GROUP_ID) return;
                // Never lose skills: they fall back into the Non-group.
                updateSkillGroups(
                    skillGroups
                        .filter((group) => group.id !== groupId)
                        .map((group) =>
                            group.id === UNGROUPED_SKILL_GROUP_ID
                                ? { ...group, skills: [...group.skills, ...doomed.skills] }
                                : group,
                        ),
                );
            };
            const moveGroup = (index: number, direction: "up" | "down") => {
                // Index 0 is the pinned Non-group; named groups shuffle below it.
                const target = direction === "up" ? index - 1 : index + 1;
                if (index <= 0 || target <= 0 || target >= skillGroups.length) return;
                const next = [...skillGroups];
                [next[index], next[target]] = [next[target], next[index]];
                updateSkillGroups(next);
            };
            const groupOfSkill = (skillId: string) => skillGroups.find((group) => group.skills.some((skill) => skill.id === skillId));
            const overGroupId = (over: DragEndEvent["over"]) => {
                if (!over) return null;
                const id = String(over.id);
                if (id.startsWith(SKILL_GROUP_DROP_PREFIX)) return id.slice(SKILL_GROUP_DROP_PREFIX.length);
                return (over.data.current?.groupId as string | undefined) ?? groupOfSkill(id)?.id ?? null;
            };
            const handleSkillDragStart = ({ active }: DragStartEvent) => {
                const groupId = groupOfSkill(String(active.id))?.id;
                if (groupId) setSkillDrag({ groupId, skillId: String(active.id) });
            };
            const handleSkillDragOver = ({ over }: DragOverEvent) => {
                setSkillDropGroupId(overGroupId(over));
            };
            const handleSkillDragEnd = ({ active, over }: DragEndEvent) => {
                setSkillDrag(null);
                setSkillDropGroupId(null);
                const skillId = String(active.id);
                const fromGroup = groupOfSkill(skillId);
                const toGroupId = overGroupId(over);
                if (!fromGroup || !toGroupId || !over || over.id === active.id) return;
                const dragged = fromGroup.skills.find((skill) => skill.id === skillId)!;

                if (toGroupId === fromGroup.id) {
                    const to = fromGroup.skills.findIndex((skill) => skill.id === String(over.id));
                    if (to < 0) return;
                    const from = fromGroup.skills.findIndex((skill) => skill.id === skillId);
                    patchGroup(fromGroup.id, { skills: arrayMove(fromGroup.skills, from, to) });
                    return;
                }

                updateSkillGroups(skillGroups.map((group) => {
                    if (group.id === fromGroup.id) return { ...group, skills: group.skills.filter((skill) => skill.id !== skillId) };
                    if (group.id !== toGroupId) return group;
                    const at = group.skills.findIndex((skill) => skill.id === String(over.id));
                    const skills = [...group.skills];
                    skills.splice(at >= 0 ? at : skills.length, 0, dragged);
                    return { ...group, skills };
                }));
            };
            return (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={handleImportSkillsFromSections}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-edge text-bright hover:text-strong hover:border-faint transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            {t("editor.importSkills")}
                        </button>
                        {skillImportMessage && (
                            <span className="text-xs text-accent">{skillImportMessage}</span>
                        )}
                    </div>
                    <DndContext
                        sensors={skillSortable.sensors}
                        accessibility={skillSortable.accessibility}
                        collisionDetection={skillCollision}
                        modifiers={verticalOnly}
                        onDragStart={handleSkillDragStart}
                        onDragOver={handleSkillDragOver}
                        onDragEnd={handleSkillDragEnd}
                        onDragCancel={() => {
                            setSkillDrag(null);
                            setSkillDropGroupId(null);
                        }}
                    >
                    {skillGroups.map((group, groupIndex) => {
                        const isUngrouped = group.id === UNGROUPED_SKILL_GROUP_ID;
                        const collapsed = !!collapsedGroups[group.id];
                        const isDropTarget = skillDropGroupId === group.id && skillDrag?.groupId !== group.id;
                        return (
                            <DropZone key={group.id} id={`${SKILL_GROUP_DROP_PREFIX}${group.id}`}>
                            {(dropRef) => (
                            <div
                                ref={dropRef}
                                data-testid="skill-group-card"
                                className={`rounded-2xl border transition-colors ${
                                    isDropTarget ? "border-accent bg-accent/5" : "border-edge bg-surface-1"
                                }`}
                            >
                                <div className="flex items-center gap-2 p-3">
                                    <button
                                        type="button"
                                        onClick={() => setCollapsedGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                                        aria-expanded={!collapsed}
                                        aria-label={t("editor.skillGroupToggle")}
                                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-faint transition-colors hover:bg-edge hover:text-strong"
                                    >
                                        <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                                    </button>
                                    {isUngrouped ? (
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-bright">
                                            {t("editor.ungroupedSkills")}
                                        </span>
                                    ) : (
                                        <input
                                            type="text"
                                            value={group.name}
                                            onChange={(e) => patchGroup(group.id, { name: e.target.value })}
                                            placeholder={t("editor.skillGroupNamePlaceholder")}
                                            data-testid="skill-group-name"
                                            className="min-w-0 flex-1 border-none bg-transparent p-0 text-sm font-medium text-strong outline-none placeholder:text-faint/60 focus:ring-0"
                                        />
                                    )}
                                    <span className="shrink-0 text-xs text-faint">{group.skills.length}</span>
                                    {!isUngrouped && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => moveGroup(groupIndex, "up")}
                                                disabled={groupIndex <= 1}
                                                aria-label={t("editor.moveUp")}
                                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-edge text-faint transition-colors hover:border-faint hover:text-strong disabled:opacity-35"
                                            >
                                                <ChevronUp className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveGroup(groupIndex, "down")}
                                                disabled={groupIndex >= skillGroups.length - 1}
                                                aria-label={t("editor.moveDown")}
                                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-edge text-faint transition-colors hover:border-faint hover:text-strong disabled:opacity-35"
                                            >
                                                <ChevronDown className="h-3.5 w-3.5" />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => patchGroup(group.id, { hidden: !group.hidden })}
                                        aria-label={t(group.hidden ? "editor.showGroup" : "editor.hideGroup")}
                                        data-testid="skill-group-visibility"
                                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-edge transition-colors hover:border-faint ${
                                            group.hidden ? "text-faint/50" : "text-faint hover:text-strong"
                                        }`}
                                    >
                                        {group.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                    </button>
                                    {!isUngrouped && (
                                        <button
                                            type="button"
                                            onClick={() => deleteGroup(group.id)}
                                            aria-label={t("editor.deleteGroup")}
                                            data-testid="skill-group-delete"
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-edge text-faint transition-colors hover:border-danger/60 hover:text-danger"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                                {!collapsed && (
                                    <div className={`px-3 pb-3 ${group.hidden ? "opacity-50" : ""}`}>
                                        {renderEntryEditor({
                                            items: group.skills,
                                            updateFn: (skills) => patchGroup(group.id, { skills }),
                                            config,
                                            addLabel: t("editor.addSkill"),
                                            createEmptyItem: createEmptySkill,
                                            sortableGroupId: group.id,
                                        })}
                                    </div>
                                )}
                            </div>
                            )}
                            </DropZone>
                        );
                    })}
                    </DndContext>
                    <button
                        type="button"
                        onClick={() => updateSkillGroups([
                            ...skillGroups,
                            { id: createId(), name: "", hidden: false, skills: [] },
                        ])}
                        data-testid="skills-add-group"
                        className="w-full flex items-center justify-center gap-2 py-3 bg-surface-1 border border-dashed border-faint rounded-xl text-sm font-medium text-faint hover:text-strong hover:border-faint transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        {t("editor.addSkillGroup")}
                    </button>
                </div>
            );
        }

        if (baseId === "custom" && customSection) {
            const layout = customSection.layout;
            const config = {
                titleLabel: t("editor.customEntryTitle"),
                titlePlaceholder: t("editor.customEntryTitlePlaceholder"),
                titleKey: "title",
                subtitleLabel: t("editor.customEntrySubtitle"),
                subtitlePlaceholder: t("editor.customEntrySubtitlePlaceholder"),
                subtitleKey: "subtitle",
                urlKey: "url",
                urlIconKey: "urlIcon",
                locationKey: "location",
                descriptionKey: "description",
                descriptionLabel: t("editor.description"),
                dateMode: "range" as const,
                extraFields: renderSkillsUsedField,
            };
            const createEmptyCustomEntry = (): CustomEntry => ({
                id: createId(), hidden: false, title: "", subtitle: "", start: "", end: "",
                location: "", description: "", skills: [], url: "", urlIcon: "auto",
            });
            const layoutOptions: { value: CustomSection["layout"]; label: string }[] = [
                { value: "entries", label: t("editor.customLayoutEntries") },
                { value: "text", label: t("editor.customLayoutText") },
                { value: "tags", label: t("editor.customLayoutTags") },
            ];
            // Editing a single custom entry (opened from the section card list).
            if (singleEntryMode) {
                return renderEntryEditor({
                    items: customSection.entries || [],
                    updateFn: (entries) => patchCustom({ entries }),
                    config,
                    addLabel: t("editor.customAddEntry"),
                    createEmptyItem: createEmptyCustomEntry,
                });
            }
            return (
                <div className="space-y-6">
                    <Input
                        label={t("editor.customSectionTitle")}
                        value={customSection.title}
                        onChange={(e: any) => patchCustom({ title: e.target.value })}
                        placeholder={t("editor.customSectionTitlePlaceholder")}
                        data-testid="custom-section-title"
                    />
                    <div>
                        <label className="text-[11px] font-medium text-faint uppercase tracking-wider">{t("editor.customLayoutLabel")}</label>
                        <div className="mt-2 flex bg-surface-1 p-1 rounded-xl border border-edge">
                            {layoutOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => patchCustom({ layout: opt.value })}
                                    data-testid={`custom-layout-${opt.value}`}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                                        layout === opt.value ? "bg-edge text-strong" : "text-faint hover:text-strong"
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {layout === "text" && (
                        <div className="space-y-2">
                            <label className="text-[11px] font-medium text-faint uppercase tracking-wider">{t("editor.customTextLabel")}</label>
                            <textarea
                                value={customSection.text}
                                onChange={(e) => patchCustom({ text: e.target.value })}
                                placeholder={t("editor.customTextPlaceholder")}
                                data-testid="custom-section-text"
                                rows={8}
                                className="w-full rounded-xl border border-edge bg-surface-1 p-3 text-sm text-strong outline-none placeholder:text-faint/60 focus:border-faint resize-y"
                            />
                        </div>
                    )}

                    {layout === "tags" && (
                        <TagsInput
                            label={t("editor.customTagsLabel")}
                            value={(customSection.tags || []).join(", ")}
                            onChange={(val) => patchCustom({ tags: val.split(",").map((s) => s.trim()).filter(Boolean) })}
                            placeholder={t("editor.customTagsPlaceholder")}
                        />
                    )}

                    {layout === "entries" && (
                        <p className="rounded-xl border border-edge bg-surface-1 p-3 text-xs text-faint leading-relaxed">
                            {t("editor.customEntriesManagedHint")}
                        </p>
                    )}
                </div>
            );
        }

        return (
            <div className="bg-surface-1 border border-edge rounded-xl p-4 text-sm text-faint">
                {t("editor.sectionEditorUnavailable")}
            </div>
        );
    };

    return (
        <div ref={formContainerRef} className="sidebar-scroll h-full min-h-0 bg-surface-4 rounded-[1.25rem] border border-edge text-strong overflow-y-auto [overscroll-behavior-y:contain] [will-change:scroll-position]">
            <div className="sticky top-0 z-10 bg-surface-4 rounded-t-[2rem] px-6 md:px-8 pt-6 md:pt-8 pb-4 border-b border-edge">
                <div className="flex items-center justify-between">
                    <div
                        data-testid="section-form-back"
                        className="flex items-center gap-3 text-faint hover:text-strong transition-colors cursor-pointer"
                        onClick={onBack}
                    >
                        <div className="h-8 w-8 rounded-lg bg-surface-1 border border-edge flex items-center justify-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </div>
                        <span className="text-sm">{t("editor.back")}</span>
                    </div>
                    {!singleEntryMode && (
                    <button
                        type="button"
                        onClick={onRemove}
                        className="text-xs px-3 py-1.5 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint transition-colors"
                    >
                        {t("editor.removeSection")}
                    </button>
                    )}
                </div>
                <div className="flex items-center justify-between gap-3 mt-4">
                    <div className="flex items-center gap-3 min-w-0">
                        {showSectionIcon && <SectionIcon className="w-6 h-6 shrink-0 text-accent" />}
                        <h2 className="text-xl font-medium tracking-tight text-strong/90 truncate">{singleEntryMode ? t("editor.editEntryIn", { section: sectionTitle }) : sectionTitle}</h2>
                    </div>
                    {singleEntryMode && singleEntryItem && (
                        <div className="flex items-center gap-2 shrink-0">
                            <GetTipsLink sectionId={baseId} className="bg-surface-1" />
                            <button
                                type="button"
                                data-testid="single-entry-visibility"
                                onClick={() => patchSingleEntry({ hidden: !singleEntryItem.hidden })}
                                aria-label={singleEntryItem.hidden ? t("editor.showEntry") : t("editor.hideEntry")}
                                title={singleEntryItem.hidden ? t("editor.showEntry") : t("editor.hideEntry")}
                                className={`w-8 h-8 rounded-lg bg-surface-1 border transition-colors flex items-center justify-center shadow-sm ${
                                    singleEntryItem.hidden ? "border-faint text-mid hover:text-strong" : "border-edge text-faint hover:text-strong"
                                }`}
                            >
                                {singleEntryItem.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                                type="button"
                                data-testid="single-entry-delete"
                                onClick={() => setSingleEntryDeleteOpen(true)}
                                aria-label={t("editor.deleteEntry")}
                                title={t("editor.deleteEntry")}
                                className="w-8 h-8 rounded-lg bg-surface-1 border border-edge text-faint hover:text-danger hover:border-danger/60 transition-colors flex items-center justify-center shadow-sm"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="px-6 md:px-8 pb-24 lg:pb-8 pt-6 space-y-6">
            {!singleEntryMode && <p className="text-sm text-faint leading-relaxed">{def.description}</p>}
            {!customSection && !singleEntryMode && (
            <div className="space-y-4">
                <Input
                    label={t("editor.sectionHeading")}
                    value={sectionDisplay.title ?? def.title}
                    onChange={(e: any) => updateSectionDisplay({ title: e.target.value })}
                    placeholder={def.title}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[11px] font-medium text-faint uppercase tracking-wider">{t("editor.sectionIcon")}</label>
                        <CustomIconSelect
                            linkName={def.title}
                            value={sectionIconKey}
                            onChange={(v) => updateSectionDisplay({ icon: v })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[11px] font-medium text-faint uppercase tracking-wider">{t("editor.showIcon")}</label>
                        <button
                            type="button"
                            onClick={() => updateSectionDisplay({ showIcon: !showSectionIcon })}
                            className={`w-full h-[42px] rounded-xl border text-sm transition-colors flex items-center justify-center ${showSectionIcon
                                ? "bg-edge border-accent text-strong"
                                : "bg-surface-1 border-edge text-faint hover:text-strong hover:border-faint"
                                }`}
                        >
                            {showSectionIcon ? t("editor.visible") : t("editor.hidden")}
                        </button>
                    </div>
                </div>
                {baseId === "languages" && (
                    <div className="space-y-2">
                        <label className="text-[11px] font-medium text-faint uppercase tracking-wider">{t("editor.languagePreviewStyle")}</label>
                        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-edge bg-surface-1 p-1">
                            {[
                                { value: "list" as const, label: t("editor.languagePreviewList") },
                                { value: "table" as const, label: t("editor.languagePreviewTable") },
                                { value: "cefr" as const, label: t("editor.languagePreviewCefr") },
                            ].map((option) => {
                                const active = (sectionDisplay.languageLayout || "list") === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => updateSectionDisplay({ languageLayout: option.value })}
                                        className={`rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                                            active
                                                ? "bg-accent text-surface-2"
                                                : "text-faint hover:bg-surface-4 hover:text-strong"
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
                {(sectionDisplay.title != null || (sectionDisplay.icon && sectionDisplay.icon !== "auto") || sectionDisplay.showIcon !== false || sectionDisplay.languageLayout) && (
                    <button
                        type="button"
                        onClick={() => {
                            updateSettings({
                                sectionDisplay: {
                                    ...sectionDisplayMap,
                                    [baseId]: { title: def.title, icon: "auto", showIcon: false },
                                },
                            } as any);
                        }}
                        className="w-full flex items-center justify-center gap-2 text-xs text-faint hover:text-accent transition-colors py-1.5"
                    >
                        <RotateCcw className="w-3 h-3" />
                        {t("editor.resetDefaults")}
                    </button>
                )}
                </div>
            )}
            {renderContent()}
            {/* The meta editor holds no entry list, so without this the section
                is a dead end: you would have to go back to the section card to
                add anything. */}
            {!singleEntryMode && !customSection && baseId !== "skills" && onAddEntry && (
                <button
                    type="button"
                    onClick={onAddEntry}
                    data-testid={`${baseId}-meta-add-entry`}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-surface-1 border border-dashed border-faint rounded-xl text-sm font-medium text-faint hover:text-strong hover:border-faint transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    {t("editor.addEntry")}
                </button>
            )}
            </div>
            <ConfirmModal
                open={singleEntryDeleteOpen}
                title={t("editor.deleteEntryTitle")}
                description={t("editor.deleteEntriesConfirm", { names: (singleEntryItem && (singleEntryItem.title || singleEntryItem.name || singleEntryItem.position || singleEntryItem.studyType || singleEntryItem.language)) || t("editor.theseEntries") })}
                confirmLabel={t("editor.delete")}
                destructive
                onCancel={() => setSingleEntryDeleteOpen(false)}
                onConfirm={() => { setSingleEntryDeleteOpen(false); removeSingleEntry(); }}
            />
        </div>
    );
}

function ProposalReviewPanel({
    title,
    proposals,
    onAccept,
    onDecline,
    onAcceptAll,
    onDeclineAll,
}: {
    title: string;
    proposals: Array<{ id: string; path: string; next: unknown }>;
    onAccept: (id: string) => void;
    onDecline: (id: string) => void;
    onAcceptAll: () => void;
    onDeclineAll: () => void;
}) {
    const { t } = useTranslation();
    if (proposals.length === 0) return null;
    return (
        <div className="bg-surface-1 border border-edge rounded-2xl p-4 space-y-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-strong/90">{title} ({proposals.length})</p>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onDeclineAll}
                        className="px-2.5 py-1.5 rounded-lg text-xs border border-edge text-faint hover:text-strong hover:border-faint transition-colors"
                    >
                        {t("editor.declineAll")}
                    </button>
                    <button
                        type="button"
                        onClick={onAcceptAll}
                        className="px-2.5 py-1.5 rounded-lg text-xs bg-accent text-surface-2 hover:bg-accent-soft transition-colors"
                    >
                        {t("editor.acceptAll")}
                    </button>
                </div>
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {proposals.map((p) => (
                    <div key={p.id} className="border border-edge rounded-xl p-2.5">
                        <div className="text-xs text-info mb-2">{p.path}</div>
                        <div className="text-[11px] text-strong/80 break-words">{JSON.stringify(p.next)}</div>
                        <div className="flex items-center justify-end gap-2 mt-2">
                            <button
                                type="button"
                                onClick={() => onDecline(p.id)}
                                className="px-2 py-1 rounded-md text-[11px] border border-edge text-faint hover:text-strong hover:border-faint transition-colors"
                            >
                                {t("editor.decline")}
                            </button>
                            <button
                                type="button"
                                onClick={() => onAccept(p.id)}
                                className="px-2 py-1 rounded-md text-[11px] bg-accent text-surface-2 hover:bg-accent-soft transition-colors"
                            >
                                {t("editor.accept")}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

interface EditorSidebarProps {
    onMobilePreview?: () => void;
}

export function EditorSidebar({ onMobilePreview }: EditorSidebarProps = {}) {
    const { t } = useTranslation();
    const modKey = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
    const resume = useResumeStore((state) => state.resume);
    const dateFormat = resume.settings?.dateFormat || "DD/MM/YYYY";
    const language = resume.settings?.language || "en";
    const CONTENT_SECTION_DEFS = getContentSectionDefs(t);
    const updateSettings = useResumeStore((state) => state.updateSettings);
    const requestCustomizePanel = useResumeStore((state) => state.requestCustomizePanel);
    const applyContentTransform = useResumeStore((state) => state.applyContentTransform);
    const updateResumePatch = useResumeStore((state) => state.updateResumePatch);
    const aiProposals = useResumeStore((state) => state.aiProposals);
    const acceptAIProposal = useResumeStore((state) => state.acceptAIProposal);
    const declineAIProposal = useResumeStore((state) => state.declineAIProposal);
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [activeEntryIndex, setActiveEntryIndex] = useState<number | null>(null);
    const pendingEditorNav = useResumeStore((state) => state.pendingEditorNav);
    const consumeEditorNav = useResumeStore((state) => state.consumeEditorNav);
    const pendingContentNav = useResumeStore((state) => state.pendingContentNav);
    const consumeContentNav = useResumeStore((state) => state.consumeContentNav);
    const setSelectedContentTarget = useResumeStore((state) => state.setSelectedContentTarget);
    // Preview clicked an element → open that section (and scroll to its entry).
    useEffect(() => {
        if (!pendingEditorNav) return;
        setActiveSection(pendingEditorNav.section);
        setActiveEntryIndex(pendingEditorNav.entryIndex);
        consumeEditorNav();
    }, [pendingEditorNav, consumeEditorNav]);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [githubProjectsOpen, setGithubProjectsOpen] = useState(false);

    useEffect(() => {
        setSelectedContentTarget(activeSection
            ? { section: activeSection, entryIndex: activeEntryIndex }
            : null);
        return () => setSelectedContentTarget(null);
    }, [activeEntryIndex, activeSection, setSelectedContentTarget]);
    const toggleSectionExpanded = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    const setAllSectionsExpanded = (expanded: boolean) => {
        const sectionKeys = resume.settings?.contentSections || [];
        setExpandedSections(Object.fromEntries(sectionKeys.map((k: string) => [k, expanded])));
    };
    const updateExperience = useResumeStore((state) => state.updateExperience);
    const updateEducation = useResumeStore((state) => state.updateEducation);
    const updateCertificates = useResumeStore((state) => state.updateCertificates);
    const updateProjects = useResumeStore((state) => state.updateProjects);
    const updateOrganisations = useResumeStore((state) => state.updateOrganisations);
    const updateCourses = useResumeStore((state) => state.updateCourses);
    const updateAwards = useResumeStore((state) => state.updateAwards);
    const updatePublications = useResumeStore((state) => state.updatePublications);
    const updateReferences = useResumeStore((state) => state.updateReferences);
    const updateDeclaration = useResumeStore((state) => state.updateDeclaration);
    const updateInterests = useResumeStore((state) => state.updateInterests);
    const updateLanguages = useResumeStore((state) => state.updateLanguages);
    const updateSkillGroups = useResumeStore((state) => state.updateSkillGroups);
    const updateCustomSections = useResumeStore((state) => state.updateCustomSections);

    // Custom section helpers: resolve a `custom:<id>` key to its model, and
    // patch a single custom section in place.
    const getCustomSection = (sectionKey: string) =>
        (resume.customSections || []).find((cs) => `custom:${cs.id}` === sectionKey) || null;
    const patchCustomSection = (id: string, patch: Partial<CustomSection>) => {
        updateCustomSections((resume.customSections || []).map((cs) => (cs.id === id ? { ...cs, ...patch } : cs)));
    };

    const toSortableTimestamp = (raw?: string) => {
        if (!raw) return Number.NEGATIVE_INFINITY;
        const v = raw.trim().toLowerCase();
        if (!v) return Number.NEGATIVE_INFINITY;
        if (v === "present" || v === "current" || v === "now") return Number.POSITIVE_INFINITY;
        const parsed = Date.parse(raw);
        return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
    };

    const sortEducationByDate = () => {
        const items = resume.education || [];
        const sorted = [...items]
            .map((item, idx) => ({ item, idx }))
            .sort((a, b) => {
                const aEnd = toSortableTimestamp(a.item.end);
                const bEnd = toSortableTimestamp(b.item.end);
                if (aEnd !== bEnd) return bEnd - aEnd;
                const aStart = toSortableTimestamp(a.item.start);
                const bStart = toSortableTimestamp(b.item.start);
                if (aStart !== bStart) return bStart - aStart;
                return a.idx - b.idx;
            })
            .map(({ item }) => item);
        updateEducation(sorted);
    };
    const sortExperienceByDate = () => {
        const items = resume.experience || [];
        const sorted = [...items]
            .map((item, idx) => ({ item, idx }))
            .sort((a, b) => {
                const aEnd = toSortableTimestamp(a.item.end);
                const bEnd = toSortableTimestamp(b.item.end);
                if (aEnd !== bEnd) return bEnd - aEnd;
                const aStart = toSortableTimestamp(a.item.start);
                const bStart = toSortableTimestamp(b.item.start);
                if (aStart !== bStart) return bStart - aStart;
                return a.idx - b.idx;
            })
            .map(({ item }) => item);
        updateExperience(sorted);
    };
    const sortCoursesByDate = () => {
        const items = resume.courses || [];
        const sorted = [...items]
            .map((item, idx) => ({ item, idx }))
            .sort((a, b) => {
                const aEnd = toSortableTimestamp(a.item.end);
                const bEnd = toSortableTimestamp(b.item.end);
                if (aEnd !== bEnd) return bEnd - aEnd;
                const aStart = toSortableTimestamp(a.item.start);
                const bStart = toSortableTimestamp(b.item.start);
                if (aStart !== bStart) return bStart - aStart;
                return a.idx - b.idx;
            })
            .map(({ item }) => item);
        updateCourses(sorted);
    };
    const sortCertificatesByDate = () => {
        const items = resume.certificates || [];
        const sorted = [...items]
            .map((item, idx) => ({ item, idx }))
            .sort((a, b) => {
                const aDate = toSortableTimestamp((a.item as any).date);
                const bDate = toSortableTimestamp((b.item as any).date);
                if (aDate !== bDate) return bDate - aDate;
                return a.idx - b.idx;
            })
            .map(({ item }) => item);
        updateCertificates(sorted);
    };
    const sortAwardsByDate = () => {
        const items = resume.awards || [];
        const sorted = [...items]
            .map((item, idx) => ({ item, idx }))
            .sort((a, b) => {
                const aDate = toSortableTimestamp((a.item as any).date);
                const bDate = toSortableTimestamp((b.item as any).date);
                if (aDate !== bDate) return bDate - aDate;
                return a.idx - b.idx;
            })
            .map(({ item }) => item);
        updateAwards(sorted);
    };
    const sortPublicationsByDate = () => {
        const items = resume.publications || [];
        const sorted = [...items]
            .map((item, idx) => ({ item, idx }))
            .sort((a, b) => {
                const aDate = toSortableTimestamp((a.item as any).date);
                const bDate = toSortableTimestamp((b.item as any).date);
                if (aDate !== bDate) return bDate - aDate;
                return a.idx - b.idx;
            })
            .map(({ item }) => item);
        updatePublications(sorted);
    };
    const sortProjectsByDate = () => {
        const items = resume.projects || [];
        const sorted = [...items]
            .map((item, idx) => ({ item, idx }))
            .sort((a, b) => {
                const aEnd = toSortableTimestamp(a.item.end);
                const bEnd = toSortableTimestamp(b.item.end);
                if (aEnd !== bEnd) return bEnd - aEnd;
                const aStart = toSortableTimestamp(a.item.start);
                const bStart = toSortableTimestamp(b.item.start);
                if (aStart !== bStart) return bStart - aStart;
                return a.idx - b.idx;
            })
            .map(({ item }) => item);
        updateProjects(sorted);
    };
    const sortInterestsByName = () => {
        const items = resume.interests || [];
        const sorted = [...items]
            .map((item, idx) => ({ item, idx }))
            .sort((a, b) => {
                const aName = (a.item.name || "").trim().toLocaleLowerCase();
                const bName = (b.item.name || "").trim().toLocaleLowerCase();
                if (aName !== bName) return aName.localeCompare(bName);
                return a.idx - b.idx;
            })
            .map(({ item }) => item);
        updateInterests(sorted);
    };
    const sortReferencesByName = () => {
        const items = resume.references || [];
        const sorted = [...items]
            .map((item, idx) => ({ item, idx }))
            .sort((a, b) => {
                const aName = (a.item.name || "").trim().toLocaleLowerCase();
                const bName = (b.item.name || "").trim().toLocaleLowerCase();
                if (aName !== bName) return aName.localeCompare(bName);
                return a.idx - b.idx;
            })
            .map(({ item }) => item);
        updateReferences(sorted);
    };

    const sortOrganisationsByName = () => {
        const items = resume.organisations || [];
        const sorted = [...items]
            .map((item, idx) => ({ item, idx }))
            .sort((a, b) => {
                const aName = (a.item.name || "").trim().toLocaleLowerCase();
                const bName = (b.item.name || "").trim().toLocaleLowerCase();
                if (aName !== bName) return aName.localeCompare(bName);
                return a.idx - b.idx;
            })
            .map(({ item }) => item);
        updateOrganisations(sorted);
    };

    const sortSkillsByName = () => {
        const groups = resume.skillGroups || [];
        updateSkillGroups(groups.map((group) => ({
            ...group,
            skills: [...group.skills]
                .map((item, idx) => ({ item, idx }))
                .sort((a, b) => {
                    const aName = (a.item.name || "").trim().toLocaleLowerCase();
                    const bName = (b.item.name || "").trim().toLocaleLowerCase();
                    if (aName !== bName) return aName.localeCompare(bName);
                    return a.idx - b.idx;
                })
                .map(({ item }) => item),
        })));
    };
    const sortLanguagesByName = () => {
        const items = resume.languages || [];
        const sorted = [...items]
            .map((item, idx) => ({ item, idx }))
            .sort((a, b) => {
                const aName = (a.item.language || "").trim().toLocaleLowerCase();
                const bName = (b.item.language || "").trim().toLocaleLowerCase();
                if (aName !== bName) return aName.localeCompare(bName);
                return a.idx - b.idx;
            })
            .map(({ item }) => item);
        updateLanguages(sorted);
    };

    const shiftPreviewEntry = (index: number, dir: "up" | "down", items: any[], updateFn: (items: any[]) => void) => {
        const nextIndex = dir === "up" ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= items.length) return;
        const next = [...items];
        [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
        updateFn(next);
    };
    const activeTab = useResumeStore((state) => state.sidebarTab);
    const setSidebarTab = useResumeStore((state) => state.setSidebarTab);
    const [contentSearch, setContentSearch] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<{ key: string; label: string } | null>(null);
    // Pending entry deletion (single or bulk) awaiting confirmation.
    const [entryDeleteTarget, setEntryDeleteTarget] = useState<{ sectionKey: string; indices: number[]; label: string } | null>(null);
    // Multi-select: section key -> selected entry indices.
    const [selectedEntries, setSelectedEntries] = useState<Record<string, number[]>>({});
    const [importDataOpen, setImportDataOpen] = useState(false);

    const switchSidebarTab = (tab: "content" | "customize" | "json") => {
        setActiveSection(null);
        setActiveEntryIndex(null);
        setSidebarTab(tab);
    };

    const renderSidebarTabButton = (tab: "content" | "customize" | "json", variant: "top" | "rail" = "top") => {
        const isActive = activeTab === tab;
        const Icon = tab === "content" ? FileText : tab === "json" ? CodeIcon : SlidersHorizontal;
        const label = t(tab === "content" ? "editor.contentTab" : tab === "json" ? "jsonEditor.tab" : "editor.customizeTab");

        return (
            <button
                type="button"
                onClick={() => switchSidebarTab(tab)}
                data-testid={`sidebar-tab-${tab}`}
                aria-label={label}
                data-state={isActive ? "active" : "inactive"}
                aria-pressed={isActive}
                className={variant === "rail"
                    ? `inline-flex h-10 min-w-0 items-center justify-center gap-1 rounded-xl border px-1.5 text-[11px] font-medium transition-all duration-200 ${isActive ? "border-faint bg-edge text-strong shadow-sm" : "border-edge bg-surface-4 text-faint hover:border-faint hover:text-strong"}`
                    : `min-w-0 rounded-xl py-2 text-sm font-medium transition-all duration-200 ${isActive ? "bg-edge text-strong shadow-sm" : "text-faint hover:text-strong"}`
                }
            >
                {variant === "rail" && <Icon className="h-3.5 w-3.5 shrink-0" />}
                <span className={variant === "rail" ? "min-w-0 truncate max-[374px]:hidden" : "block truncate"}>{label}</span>
            </button>
        );
    };

    const renderSidebarTabs = () => (
        <div className="grid grid-cols-3 gap-2 bg-surface-1 p-1.5 rounded-[0.875rem] shrink-0 border border-edge">
            {renderSidebarTabButton("content")}
            {renderSidebarTabButton("customize")}
            {renderSidebarTabButton("json")}
        </div>
    );

    const mobileFooter = onMobilePreview ? (
        <div className="fixed inset-x-0 bottom-0 z-40 grid shrink-0 grid-cols-4 items-center gap-2 border-t border-edge bg-surface-2/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.28)] backdrop-blur lg:hidden">
            {renderSidebarTabButton("content", "rail")}
            {renderSidebarTabButton("customize", "rail")}
            {renderSidebarTabButton("json", "rail")}
            <button
                type="button"
                onClick={() => requestJsonEditorLeave(() => onMobilePreview?.())}
                aria-pressed={false}
                className="inline-flex h-10 min-w-0 items-center justify-center gap-1 rounded-xl border border-edge bg-surface-4 px-1.5 text-[11px] font-medium text-faint transition-all duration-200 hover:border-faint hover:text-strong"
            >
                <Eye className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 truncate max-[374px]:hidden">{t("editor.preview")}</span>
            </button>
        </div>
    ) : null;

    const sectionKeys = resume.settings?.contentSections || [];

    const sectionCounts = sectionKeys.reduce<Record<string, number>>((acc, key) => {
        const base = sectionBaseId(key);
        acc[base] = (acc[base] || 0) + 1;
        return acc;
    }, {});
    const sectionDisplayMap = ((resume.settings as any)?.sectionDisplay || {}) as Record<string, { title?: string; icon?: string; showIcon?: boolean }>;
    const getSectionDisplayTitle = (base: string, fallback: string) => {
        const custom = sectionDisplayMap[base]?.title;
        return custom && custom.trim() ? custom.trim() : fallback;
    };
    const getSectionDisplayIcon = (base: string, fallbackIcon: LucideIcon): LucideIcon | null => {
        const cfg = sectionDisplayMap[base];
        if (cfg?.showIcon === false) return null;
        if (cfg?.icon && cfg.icon !== "auto") {
            return CUSTOM_ICON_LUCIDE_MAP[cfg.icon] || fallbackIcon;
        }
        return fallbackIcon;
    };
    const getSectionLabel = (sectionKey: string) => {
        const base = sectionBaseId(sectionKey);
        const def = sectionDefById(base, CONTENT_SECTION_DEFS);

        if (!def) {
            return base;
        }

        if (base === "custom") {
            return getCustomSection(sectionKey)?.title?.trim() || def.title;
        }

        const sameTypeKeys = sectionKeys.filter((key) => sectionBaseId(key) === base);
        const indexInType = sameTypeKeys.findIndex((key) => key === sectionKey) + 1;
        const baseLabel = getSectionDisplayTitle(base, def.title);

        return sectionCounts[base] > 1 ? `${baseLabel} (${indexInType})` : baseLabel;
    };
    const requestSectionRemoval = (sectionKey: string) => {
        setDeleteTarget({ key: sectionKey, label: getSectionLabel(sectionKey) });
    };
    const hiddenSectionKeys = resume.settings?.hiddenSections || [];
    const toggleSectionVisibility = (sectionKey: string) => {
        const next = hiddenSectionKeys.includes(sectionKey)
            ? hiddenSectionKeys.filter((key) => key !== sectionKey)
            : [...hiddenSectionKeys, sectionKey];
        updateSettings({ hiddenSections: next } as any);
    };
    const toggleEntryVisibility = (items: any[], updateFn: (items: any[]) => void, idx: number) => {
        updateFn(items.map((item, i) => (i === idx ? { ...item, hidden: !item.hidden } : item)));
    };

    const normalizedContentSearch = contentSearch.trim().toLowerCase();
    const matchesContentSearch = (title: string, description = "", keywords: readonly string[] = []) =>
        !normalizedContentSearch
        || title.toLowerCase().includes(normalizedContentSearch)
        || description.toLowerCase().includes(normalizedContentSearch)
        || keywords.some((keyword) => keyword.toLowerCase().includes(normalizedContentSearch));
    const visibleSectionKeys = sectionKeys.filter((sectionKey) => {
        const base = sectionBaseId(sectionKey);
        const def = sectionDefById(base, CONTENT_SECTION_DEFS);
        return def ? matchesContentSearch(getSectionLabel(sectionKey), def.description, def.keywords) : false;
    });
    const availableContentDefs = CONTENT_SECTION_DEFS.filter((def) =>
        isContentSectionAvailable(sectionKeys, def)
        && matchesContentSearch(def.title, def.description, def.keywords)
    );
    const basicsDefinition = CONTENT_SECTIONS[0];
    const showBasics = matchesContentSearch(
        t(basicsDefinition.labelKey),
        t(basicsDefinition.descriptionKey),
        basicsDefinition.keywords,
    );
    const contentProposals = aiProposals.filter((p) => !p.path.startsWith("settings."));
    const customizeProposals = aiProposals.filter((p) => p.path.startsWith("settings."));

    const addContentSection = (id: string) => {
        const def = sectionDefById(id, CONTENT_SECTION_DEFS);
        if (!def) return;
        const current = resume.settings?.contentSections || [];

        const isCustom = id === "custom";
        // Custom sections are instanced (multiple allowed); every other section
        // type is unique, so dedupe by base.
        if (!isCustom && hasContentSection(current, id)) {
            return;
        }

        const newCustomId = createId();
        const newKey = isCustom ? `custom:${newCustomId}` : id;
        if (isCustom) {
            updateCustomSections([
                ...(resume.customSections || []),
                { id: newCustomId, hidden: false, title: "", icon: "auto", layout: "entries", text: "", tags: [], entries: [] },
            ]);
        }
        const currentLayout = resume.settings?.layout;
        if (currentLayout?.columns === "mix") {
            updateSettings({
                contentSections: [...current, newKey],
                layout: {
                    sectionPlacement: {
                        ...(currentLayout.sectionPlacement || {}),
                        [newKey]: "full",
                    },
                },
            } as any);
        } else {
            updateSettings({ contentSections: [...current, newKey] } as any);
        }
        setContentSearch("");

        // A brand-new entry section opens on its first entry — the meta editor
        // (title/icon) is not what you came for, and offers nothing to fill in.
        // Skills and Custom keep their own list/layout editors in meta mode;
        // Declaration renders its whole list from a single index. A section
        // re-added while its entries are still in the resume keeps its data, so
        // open it as-is instead of appending an empty entry.
        const ownsItsListUi = isCustom || id === "skills";
        // addContentSection only runs from events and effects, after every const below exists.
        // eslint-disable-next-line react-hooks/immutability
        const entryConfig = ownsItsListUi ? null : getSectionEntryConfig(newKey);
        if (entryConfig && entryConfig.items().length === 0) {
            if (id === "declaration") {
                setActiveEntryIndex(0);
                setActiveSection(newKey);
                return;
            }
            // eslint-disable-next-line react-hooks/immutability
            addAndEditEntry(newKey);
            return;
        }
        setActiveSection(newKey);
    };

    useEffect(() => {
        if (!pendingContentNav) return;

        if (pendingContentNav.mode === "add") {
            addContentSection(contentSectionBaseId(pendingContentNav.section));
        } else {
            setActiveEntryIndex(pendingContentNav.entryIndex ?? null);
            setActiveSection(pendingContentNav.section);
        }
        consumeContentNav();
    }, [consumeContentNav, pendingContentNav]);

    const removeContentSection = (sectionKey: string) => {
        const base = sectionBaseId(sectionKey);
        const nextContentSections = sectionKeys.filter((key) => key !== sectionKey);
        const isRemovingLastSectionOfBase = !nextContentSections.some((key) => sectionBaseId(key) === base);
        const currentLayout = resume.settings?.layout;
        const nextSectionOrder = (currentLayout?.sectionOrder || []).filter((entry) => {
            if (entry === sectionKey) {
                return false;
            }

            if (isRemovingLastSectionOfBase && entry === base) {
                return false;
            }

            return true;
        });
        const nextSectionPlacement = { ...(currentLayout?.sectionPlacement || {}) } as Record<string, string>;

        delete nextSectionPlacement[sectionKey];
        if (isRemovingLastSectionOfBase) {
            delete nextSectionPlacement[base];
        }

        const patch: any = {
            settings: {
                contentSections: nextContentSections,
                hiddenSections: (resume.settings?.hiddenSections || []).filter((key) => key !== sectionKey),
                layout: {
                    sectionOrder: nextSectionOrder,
                    sectionPlacement: nextSectionPlacement,
                },
            },
        };

        if (isRemovingLastSectionOfBase) {
            if (base === "experience") patch.experience = [];
            if (base === "education") patch.education = [];
            if (base === "certificates") patch.certificates = [];
            if (base === "projects") patch.projects = [];
            if (base === "organisations") patch.organisations = [];
            if (base === "courses") patch.courses = [];
            if (base === "awards") patch.awards = [];
            if (base === "publications") patch.publications = [];
            if (base === "references") patch.references = [];
            if (base === "declaration") patch.declaration = [];
            if (base === "skills") patch.skillGroups = [createUngroupedSkillGroup()];
            if (base === "languages") patch.languages = [];
            if (base === "interests") patch.interests = [];
        }

        // Custom sections are instanced, so always drop this specific one's model
        // (not gated on isRemovingLastSectionOfBase, which is per-base).
        if (base === "custom") {
            patch.customSections = (resume.customSections || []).filter((cs) => `custom:${cs.id}` !== sectionKey);
        }

        updateResumePatch(patch);
        setActiveSection(null);
        setActiveEntryIndex(null);
    };
    const updateSectionDisplay = (base: string, patch: Partial<{ title: string; icon: string; showIcon: boolean }>) => {
        const current = ((resume.settings as any)?.sectionDisplay || {}) as Record<string, any>;
        updateSettings({
            sectionDisplay: {
                ...current,
                [base]: {
                    ...(current[base] || {}),
                    ...patch,
                },
            },
        } as any);
    };
    // Unified section entry config — drives previews, reorder, add, sort, and toolbar visibility
    const sectionEntryConfig: Record<string, {
        items: () => any[];
        updateFn: (items: any[]) => void;
        sortFn?: () => void;
        sortLabel?: string;
        sortTitle?: string;
        createEmpty: () => any;
        toPreview: (item: any) => { title: string; subtitle: string; dates: string };
    }> = {
        education: {
            items: () => resume.education || [],
            updateFn: updateEducation,
            sortFn: sortEducationByDate,
            createEmpty: () => ({ id: createId(), institution: "", area: "", studyType: "", start: "", end: "", location: "", description: "", score: "", courses: [], url: "", urlIcon: "auto" }),
            toPreview: (edu: any) => ({ title: edu.studyType || edu.area || "Untitled Degree", subtitle: edu.institution || "No institution", dates: [edu.start, edu.end].filter(Boolean).map((d: string) => formatDateForDisplay(d, dateFormat, language)).join(" – ") || "" }),
        },
        experience: {
            items: () => resume.experience || [],
            updateFn: updateExperience,
            sortFn: sortExperienceByDate,
            createEmpty: () => ({ id: createId(), company: "", position: "", start: "", end: "", location: "", description: "", highlights: [], url: "", urlIcon: "auto" }),
            toPreview: (exp: any) => ({ title: exp.position || "Untitled Position", subtitle: exp.company || "No company", dates: [exp.start, exp.end].filter(Boolean).map((d: string) => formatDateForDisplay(d, dateFormat, language)).join(" – ") || "" }),
        },
        certificates: {
            items: () => resume.certificates || [],
            updateFn: updateCertificates,
            sortFn: sortCertificatesByDate,
            createEmpty: () => ({ id: createId(), name: "", date: "", issuer: "", description: "", url: "", urlIcon: "auto", issuerUrl: "", issuerUrlIcon: "auto" }),
            toPreview: (cert: any) => ({ title: cert.name || "Untitled Certificate", subtitle: cert.issuer || "No issuer", dates: cert.date ? formatDateForDisplay(cert.date, dateFormat, language) : "" }),
        },
        languages: {
            items: () => resume.languages || [],
            updateFn: updateLanguages,
            sortFn: sortLanguagesByName,
            sortLabel: t("editor.sortByName"),
            sortTitle: t("editor.sortEntriesByNameTitle"),
            createEmpty: () => ({ id: createId(), language: "", fluency: "B2", assessmentType: "none", issuer: "", assessmentId: "", assessmentUrl: "", description: "" }),
            toPreview: (lang: any) => ({
                title: lang.language || "Untitled Language",
                subtitle: [
                    lang.fluency,
                    lang.assessmentType === "issuer" && lang.issuer
                        ? lang.issuer
                        : lang.assessmentType === "self"
                            ? t("editor.languageSelfAssessed")
                            : "",
                ]
                    .filter(Boolean)
                    .join(" · "),
                dates: "",
            }),
        },
        projects: {
            items: () => resume.projects || [],
            updateFn: updateProjects,
            sortFn: sortProjectsByDate,
            createEmpty: () => ({ id: createId(), name: "", subtitle: "", description: "", highlights: [], keywords: [], start: "", end: "", url: "", urlIcon: "auto" }),
            toPreview: (proj: any) => ({ title: proj.name || "Untitled Project", subtitle: proj.subtitle || "", dates: [proj.start, proj.end].filter(Boolean).map((d: string) => formatDateForDisplay(d, dateFormat, language)).join(" – ") || "" }),
        },
        awards: {
            items: () => resume.awards || [],
            updateFn: updateAwards,
            sortFn: sortAwardsByDate,
            createEmpty: () => ({ id: createId(), name: "", issuer: "", date: "", description: "", skills: [], url: "", urlIcon: "auto" }),
            toPreview: (award: any) => ({
                title: award.name || "Untitled Award",
                subtitle: award.issuer || "",
                dates: award.date ? formatDateForDisplay(award.date, dateFormat, language) : "",
            }),
        },
        publications: {
            items: () => resume.publications || [],
            updateFn: updatePublications,
            sortFn: sortPublicationsByDate,
            createEmpty: () => ({ id: createId(), name: "", publisher: "", date: "", description: "", skills: [], url: "", urlIcon: "auto" }),
            toPreview: (publication: any) => ({
                title: publication.name || "Untitled Publication",
                subtitle: publication.publisher || "",
                dates: publication.date ? formatDateForDisplay(publication.date, dateFormat, language) : "",
            }),
        },
        references: {
            items: () => resume.references || [],
            updateFn: updateReferences,
            sortFn: sortReferencesByName,
            sortLabel: t("editor.sortByName"),
            sortTitle: t("editor.sortEntriesByNameTitle"),
            createEmpty: () => ({ id: createId(), name: "", position: "", organisation: "", email: "", phone: "", description: "", url: "", urlIcon: "auto" }),
            toPreview: (reference: any) => ({
                title: reference.name || "Untitled Reference",
                subtitle: [reference.position, reference.organisation].filter(Boolean).join(" · "),
                dates: "",
            }),
        },
        declaration: {
            items: () => resume.declaration || [],
            updateFn: updateDeclaration,
            createEmpty: () => ({ id: createId(), text: "", signature: "", fullName: "", place: "", date: "" }),
            toPreview: (declaration: any) => ({
                title: declaration.fullName || t("editor.sectionDeclaration"),
                subtitle: [declaration.place, declaration.date].filter(Boolean).join(" · "),
                dates: "",
            }),
        },
        courses: {
            items: () => resume.courses || [],
            updateFn: updateCourses,
            sortFn: sortCoursesByDate,
            createEmpty: () => ({ id: createId(), name: "", institution: "", start: "", end: "", location: "", description: "", skills: [], url: "", urlIcon: "auto" }),
            toPreview: (course: any) => ({
                title: course.name || "Untitled Course",
                subtitle: course.institution || "",
                dates: [course.start, course.end].filter(Boolean).map((d: string) => formatDateForDisplay(d, dateFormat, language)).join(" – ") || "",
            }),
        },
        organisations: {
            items: () => resume.organisations || [],
            updateFn: updateOrganisations,
            sortFn: sortOrganisationsByName,
            sortLabel: t("editor.sortByName"),
            sortTitle: t("editor.sortEntriesByNameTitle"),
            createEmpty: () => ({ id: createId(), name: "", role: "", start: "", end: "", location: "", description: "", skills: [], url: "", urlIcon: "auto" }),
            toPreview: (organisation: any) => ({
                title: organisation.name || "Untitled Organisation",
                subtitle: organisation.role || "",
                dates: [organisation.start, organisation.end].filter(Boolean).map((d: string) => formatDateForDisplay(d, dateFormat, language)).join(" – ") || "",
            }),
        },
        interests: {
            items: () => resume.interests || [],
            updateFn: updateInterests,
            sortFn: sortInterestsByName,
            sortLabel: t("editor.sortByName"),
            sortTitle: t("editor.sortEntriesByNameTitle"),
            createEmpty: () => ({ id: createId(), name: "", description: "" }),
            toPreview: (interest: any) => ({ title: interest.name || "Untitled Interest", subtitle: interest.description || "", dates: "" }),
        },
        skills: {
            items: () => allSkills(resume.skillGroups || []),
            updateFn: (skills: any[]) => {
                // Overview edits arrive flat: apply edits/removals to whichever
                // group holds each skill; additions land in the Non-group.
                const byId = new Map(skills.map((skill) => [skill.id, skill]));
                const known = new Set(allSkills(resume.skillGroups || []).map((skill) => skill.id));
                const additions = skills.filter((skill) => !known.has(skill.id));
                updateSkillGroups((resume.skillGroups || []).map((group) => ({
                    ...group,
                    skills: [
                        ...group.skills
                            .filter((skill) => byId.has(skill.id))
                            .map((skill) => byId.get(skill.id)),
                        ...(group.id === UNGROUPED_SKILL_GROUP_ID ? additions : []),
                    ],
                })));
            },
            sortFn: sortSkillsByName,
            sortLabel: t("editor.sortByName"),
            sortTitle: t("editor.sortEntriesByNameTitle"),
            createEmpty: () => ({ id: createId(), name: "", description: "", level: "", icon: "auto", display: "both", keywords: [] }),
            toPreview: (skill: any) => ({
                title: skill.name || "Untitled Skill",
                subtitle: skill.level ? t(SKILL_LEVEL_LABEL_KEYS[skill.level as SkillLevel] ?? "") : "",
                dates: "",
            }),
        },
    };

    // Resolves the entry config for a section key. Custom sections in "entries"
    // layout get a config bound to their own model.entries; text/tags custom
    // layouts (and unknown sections) return null so the card shows no entry list.
    const getSectionEntryConfig = (sectionKey: string) => {
        const base = sectionBaseId(sectionKey);
        if (base === "custom") {
            const cs = getCustomSection(sectionKey);
            if (!cs || cs.layout !== "entries") return null;
            return {
                items: () => cs.entries || [],
                updateFn: (entries: any[]) => patchCustomSection(cs.id, { entries }),
                sortFn: undefined as (() => void) | undefined,
                sortLabel: undefined as string | undefined,
                sortTitle: undefined as string | undefined,
                createEmpty: () => ({ id: createId(), hidden: false, title: "", subtitle: "", start: "", end: "", location: "", description: "", skills: [], url: "", urlIcon: "auto" }),
                toPreview: (entry: any) => ({
                    title: entry.title || t("editor.customEntryUntitled"),
                    subtitle: entry.subtitle || "",
                    dates: [entry.start, entry.end].filter(Boolean).map((d: string) => formatDateForDisplay(d, dateFormat, language)).join(" – ") || "",
                }),
            };
        }
        return sectionEntryConfig[base] || null;
    };

    // Append a new entry and jump straight into its single-entry editor.
    const addAndEditEntry = (sectionKey: string) => {
        const cfg = getSectionEntryConfig(sectionKey);
        if (!cfg) return;
        const items = cfg.items();
        cfg.updateFn([...items, cfg.createEmpty()] as any);
        setActiveEntryIndex(items.length);
        setActiveSection(sectionKey);
    };

    // --- Entry multi-select + bulk actions ---
    const getSelectedEntries = (sectionKey: string) => selectedEntries[sectionKey] || [];
    const toggleEntrySelected = (sectionKey: string, idx: number) => {
        setSelectedEntries((prev) => {
            const cur = prev[sectionKey] || [];
            const next = cur.includes(idx) ? cur.filter((i) => i !== idx) : [...cur, idx];
            return { ...prev, [sectionKey]: next };
        });
    };
    const clearEntrySelection = (sectionKey: string) => {
        setSelectedEntries((prev) => (prev[sectionKey]?.length ? { ...prev, [sectionKey]: [] } : prev));
    };
    const bulkSetEntriesHidden = (sectionKey: string, indices: number[], hidden: boolean) => {
        const cfg = getSectionEntryConfig(sectionKey);
        if (!cfg) return;
        const set = new Set(indices);
        cfg.updateFn(cfg.items().map((item: any, i: number) => (set.has(i) ? { ...item, hidden } : item)));
    };
    const requestEntryDeletion = (sectionKey: string, indices: number[]) => {
        const cfg = getSectionEntryConfig(sectionKey);
        if (!cfg || indices.length === 0) return;
        const items = cfg.items();
        const label = indices
            .map((i) => cfg.toPreview(items[i])?.title)
            .filter(Boolean)
            .join(", ");
        setEntryDeleteTarget({ sectionKey, indices, label });
    };
    const confirmEntryDeletion = () => {
        if (!entryDeleteTarget) return;
        const { sectionKey, indices } = entryDeleteTarget;
        const cfg = getSectionEntryConfig(sectionKey);
        if (cfg) {
            const set = new Set(indices);
            cfg.updateFn(cfg.items().filter((_: any, i: number) => !set.has(i)));
        }
        clearEntrySelection(sectionKey);
        setEntryDeleteTarget(null);
    };

    const deleteConfirmModal = (
        <ConfirmModal
            open={!!deleteTarget}
            title={t("editor.deleteSectionTitle")}
            description={deleteTarget ? t("editor.deleteSectionConfirm", { name: deleteTarget.label }) : ""}
            confirmLabel={t("editor.delete")}
            destructive
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => {
                if (deleteTarget) {
                    removeContentSection(deleteTarget.key);
                }
                setDeleteTarget(null);
            }}
        />
    );

    const entryDeleteConfirmModal = (
        <ConfirmModal
            open={!!entryDeleteTarget}
            title={entryDeleteTarget && entryDeleteTarget.indices.length > 1 ? t("editor.deleteEntriesTitle") : t("editor.deleteEntryTitle")}
            description={entryDeleteTarget ? t("editor.deleteEntriesConfirm", { names: entryDeleteTarget.label || t("editor.theseEntries") }) : ""}
            confirmLabel={t("editor.delete")}
            destructive
            onCancel={() => setEntryDeleteTarget(null)}
            onConfirm={confirmEntryDeletion}
        />
    );

    // If active section is 'basics', render the form without tabs visible
    if (activeTab !== "json" && activeSection === "basics") {
        return (
            <div className="flex h-full min-h-0 flex-col text-strong">
                <div className="min-h-0 flex-1">
                    <BasicsForm onBack={() => setActiveSection(null)} />
                </div>
                {mobileFooter}
            </div>
        );
    }

    if (activeTab !== "json" && activeSection) {
        return (
            <div className="flex h-full min-h-0 flex-col text-strong">
                <div className="min-h-0 flex-1">
                    <SectionEditForm
                        sectionKey={activeSection}
                        onBack={() => { setActiveSection(null); setActiveEntryIndex(null); }}
                        onRemove={() => requestSectionRemoval(activeSection)}
                        scrollToEntry={activeEntryIndex}
                        onScrolledToEntry={() => setActiveEntryIndex(null)}
                        onAddEntry={getSectionEntryConfig(activeSection) ? () => addAndEditEntry(activeSection) : undefined}
                    />
                </div>
                {mobileFooter}
                {deleteConfirmModal}
            </div>
        );
    }

    return (
        <div className="flex-1 h-full min-h-0 flex flex-col space-y-3 text-strong overflow-hidden">
            {/* Tab Switcher */}
            {!onMobilePreview && renderSidebarTabs()}

            <div ref={setJsonEditorSlot} className={activeTab === "json" ? "flex flex-1 min-h-0 min-w-0 flex-col" : "hidden"} />
            {activeTab === "json" ? null : activeTab === "customize" ? (
                <>
                    <ProposalReviewPanel
                        title={t("editor.aiProposedCustomize")}
                        proposals={customizeProposals}
                        onAccept={acceptAIProposal}
                        onDecline={declineAIProposal}
                        onAcceptAll={() => customizeProposals.forEach((p) => acceptAIProposal(p.id))}
                        onDeclineAll={() => customizeProposals.forEach((p) => declineAIProposal(p.id))}
                    />
                    <CustomizeSidebar />
                </>
            ) : (
                <div className="sidebar-scroll flex-1 min-h-0 flex flex-col overflow-y-auto pb-24 lg:pb-0 [overscroll-behavior-y:contain] [will-change:scroll-position]">
                    <ProposalReviewPanel
                        title={t("editor.aiProposedContent")}
                        proposals={contentProposals}
                        onAccept={acceptAIProposal}
                        onDecline={declineAIProposal}
                        onAcceptAll={() => contentProposals.forEach((p) => acceptAIProposal(p.id))}
                        onDeclineAll={() => contentProposals.forEach((p) => declineAIProposal(p.id))}
                    />
                    <div className="sticky top-0 z-20 mb-1 border border-edge bg-surface-1" style={{ borderRadius: 8 }}>
                        <div className="relative flex items-center px-3">
                            <Search className="h-4 w-4 shrink-0 text-faint" />
                            <input
                                type="text"
                                value={contentSearch}
                                onChange={(event) => setContentSearch(event.target.value)}
                                placeholder={t("editor.searchContentTypes")}
                                aria-label={t("editor.searchContentTypes")}
                                className="h-10 w-full bg-transparent px-2 py-2 text-sm text-strong outline-none placeholder:text-faint"
                            />
                        </div>
                    </div>

                    <div className="mx-1 mt-2 flex min-h-11 items-center gap-2.5 rounded-md border border-edge bg-surface-1 px-2.5 py-2">
                        <Globe className="h-4 w-4 shrink-0 text-accent" />
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-dim">
                            {t("editor.cvLanguage")}
                        </span>
                        <UiSelect
                            value={language}
                            onValueChange={(nextLanguage) => {
                                updateSettings({
                                    language: nextLanguage,
                                    dateFormat: getDefaultCvDateFormat(nextLanguage),
                                });
                            }}
                        >
                            <SelectTrigger
                                aria-label={t("editor.cvLanguage")}
                                data-testid="content-cv-language-select"
                                className="h-7 w-36 min-w-0 shrink-0 border-transparent bg-transparent px-2 text-xs hover:border-transparent hover:bg-surface-3 focus:border-faint"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="start" className="max-h-72 w-40 min-w-0">
                                {CV_LANGUAGE_OPTIONS.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                        data-testid={`content-cv-language-option-${option.value}`}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </UiSelect>
                        <button
                            type="button"
                            onClick={() => {
                                requestCustomizePanel("languageRegion");
                                setSidebarTab("customize");
                            }}
                            aria-label={t("editor.languageRegionSettings")}
                            title={t("editor.languageRegionSettings")}
                            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-faint hover:bg-surface-4 hover:text-strong"
                        >
                            {dateFormat}
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <button
                        type="button"
                        data-testid="content-overlay-elements"
                        onClick={() => requestCustomizePanel("designOverlays")}
                        className="mx-1 mt-2 flex min-h-11 shrink-0 items-center gap-2.5 rounded-md border border-edge bg-surface-1 px-2.5 py-2 text-left outline-none transition-colors hover:border-faint hover:bg-surface-4 focus-visible:ring-1 focus-visible:ring-accent"
                    >
                        <Palette className="h-4 w-4 shrink-0 text-accent" />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-bright">{t("editor.overlayElements")}</span>
                            <span className="block truncate text-[11px] text-faint">{t("editor.overlayElementsDescription")}</span>
                        </span>
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-edge px-1.5 text-[11px] font-medium tabular-nums text-mid">
                            {resume.settings.design?.elements?.length ?? 0}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-dim" />
                    </button>

                    {(showBasics || visibleSectionKeys.length > 0) && (
                        <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase text-dim">
                            {t("palette.group.onResume")}
                        </div>
                    )}

                    {showBasics && (
                        <button
                            type="button"
                            data-testid="sidebar-basics-card"
                            onClick={() => setActiveSection("basics")}
                            className="mx-1 flex min-h-11 shrink-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-bright outline-none transition-colors hover:bg-surface-4 focus-visible:bg-surface-4 focus-visible:ring-1 focus-visible:ring-accent"
                        >
                            <basicsDefinition.icon className="h-4 w-4 shrink-0 text-faint" />
                            <span className="min-w-0 flex-1 truncate">{t(basicsDefinition.labelKey)}</span>
                            <span className="max-w-[38%] truncate text-xs text-faint">
                                {resume.basics.name || t("editor.professionalTitle")}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-dim" />
                        </button>
                    )}

                    {/* Other Sections */}
                    <div className="shrink-0">
                        {visibleSectionKeys.map((sectionKey) => {
                            const base = sectionBaseId(sectionKey);
                            const def = sectionDefById(base, CONTENT_SECTION_DEFS);
                            if (!def) return null;
                            const label = getSectionLabel(sectionKey);
                            const SectionIcon = getSectionDisplayIcon(base, def.icon);

                            const entryCfg = getSectionEntryConfig(sectionKey);
                            const rawEntries = entryCfg ? entryCfg.items() : [];
                            const entries = entryCfg ? rawEntries.map(entryCfg.toPreview) : [];
                            const hiddenEntryCount = rawEntries.filter((item: any) => item?.hidden).length;
                            const isSectionHiddenState = hiddenSectionKeys.includes(sectionKey);
                            const hasEntries = entries.length > 0;
                            const isExpanded = expandedSections[sectionKey] ?? false;
                            const reorderInfo = entryCfg ? { items: entryCfg.items(), updateFn: entryCfg.updateFn } : null;
                            const selectedIdx = getSelectedEntries(sectionKey);
                            const selectedSet = new Set(selectedIdx);

                            return (
                                <div
                                    key={sectionKey}
                                    data-testid={`section-card-${sectionKey}`}
                                    className={`mx-1 rounded-md text-strong transition-colors ${isExpanded ? "bg-surface-1" : "hover:bg-surface-4"} ${isSectionHiddenState ? "opacity-60" : ""}`}
                                    onClick={() => toggleSectionExpanded(sectionKey)}
                                >
                                    <div className="flex min-h-11 items-center gap-2.5 px-2.5 py-2">
                                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                            {SectionIcon && <SectionIcon className="h-4 w-4 shrink-0 text-faint" />}
                                            <span className="min-w-0 truncate text-sm text-bright">{label}</span>
                                            {entryCfg && (
                                                <span className="flex shrink-0 items-center gap-1">
                                                    <span
                                                        data-testid={`section-count-${sectionKey}`}
                                                        className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-edge px-1.5 text-[11px] font-medium tabular-nums text-mid"
                                                    >
                                                        {rawEntries.length}
                                                    </span>
                                                    {hiddenEntryCount > 0 && (
                                                        <span
                                                            data-testid={`section-hidden-count-${sectionKey}`}
                                                            title={t("editor.hiddenCount", { count: hiddenEntryCount })}
                                                            className="inline-flex items-center gap-0.5 text-[11px] text-faint"
                                                        >
                                                            <EyeOff className="h-3 w-3" />
                                                            {hiddenEntryCount}
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <button
                                                type="button"
                                                data-testid={`section-visibility-${sectionKey}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSectionVisibility(sectionKey);
                                                }}
                                                aria-label={
                                                    isSectionHiddenState
                                                        ? t("editor.showSection", { label })
                                                        : t("editor.hideSection", { label })
                                                }
                                                title={
                                                    isSectionHiddenState
                                                        ? t("editor.showSection", { label })
                                                        : t("editor.hideSection", { label })
                                                }
                                                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                                                    isSectionHiddenState
                                                        ? "text-mid hover:bg-edge hover:text-strong"
                                                        : "text-faint hover:bg-edge hover:text-strong"
                                                }`}
                                            >
                                                {isSectionHiddenState ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                            </button>
                                            {!entryCfg && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        requestSectionRemoval(sectionKey);
                                                    }}
                                                    className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-edge hover:text-danger"
                                                    title={t("editor.deleteSectionAction", { label })}
                                                >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            {/* Toggle show/hide entries */}
                                            {(entryCfg || hasEntries) && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            type="button"
                                                            data-testid={`section-expand-${sectionKey}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (e.ctrlKey || e.metaKey) {
                                                                    setAllSectionsExpanded(!isExpanded);
                                                                } else {
                                                                    toggleSectionExpanded(sectionKey);
                                                                }
                                                            }}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-edge hover:text-strong"
                                                        >
                                                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="left">
                                                        <div className="font-medium text-strong">{isExpanded ? t("editor.collapseSection") : t("editor.expandSection")}</div>
                                                        <div className="mt-1 text-[10px] text-mid">
                                                            {t("editor.collapseAllHint", { key: modKey })}
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                            {/* Section metadata editor. */}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveEntryIndex(null);
                                                    setActiveSection(sectionKey);
                                                }}
                                                data-testid={`section-edit-${sectionKey}`}
                                                className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-edge hover:text-strong"
                                                title={t("editor.editSectionAction", { label })}
                                            >
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Entry previews - shown when expanded */}
                                    {isExpanded && hasEntries && (
                                        <div className="mx-2 space-y-1 border-t border-edge pb-1 pt-2">
                                            {selectedIdx.length > 0 && (
                                                <div className="flex items-center justify-between gap-2 rounded-md border border-accent/40 bg-accent/5 px-2 py-1.5">
                                                    <span className="text-xs font-medium text-strong">{t("editor.selectedCount", { count: selectedIdx.length })}</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); bulkSetEntriesHidden(sectionKey, selectedIdx, true); }}
                                                            title={t("editor.hideSelected")}
                                                            className="w-7 h-7 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint transition-colors flex items-center justify-center"
                                                        >
                                                            <EyeOff className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); bulkSetEntriesHidden(sectionKey, selectedIdx, false); }}
                                                            title={t("editor.showSelected")}
                                                            className="w-7 h-7 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint transition-colors flex items-center justify-center"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            data-testid={`bulk-delete-${sectionKey}`}
                                                            onClick={(e) => { e.stopPropagation(); requestEntryDeletion(sectionKey, selectedIdx); }}
                                                            title={t("editor.deleteSelected")}
                                                            className="w-7 h-7 rounded-lg border border-edge text-faint hover:text-danger hover:border-danger/60 transition-colors flex items-center justify-center"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); clearEntrySelection(sectionKey); }}
                                                            className="h-7 px-2 rounded-lg border border-edge text-[11px] text-faint hover:text-strong hover:border-faint transition-colors"
                                                        >
                                                            {t("editor.clearSelection")}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            <SortableList
                                                items={entries}
                                                getId={(_entry, idx) => String(rawEntries[idx]?.id ?? idx)}
                                                onReorder={(from, to) => reorderInfo?.updateFn(arrayMove(reorderInfo.items, from, to))}
                                                describe={(entry) => entry.title}
                                                disabled={!reorderInfo}
                                            >
                                            {(entry, idx, { itemProps, handleProps, isDragging }) => (
                                                <div
                                                    {...itemProps}
                                                    data-testid={`entry-row-${sectionKey}-${idx}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveEntryIndex(idx);
                                                        setActiveSection(sectionKey);
                                                    }}
                                                    className={`group/entry flex cursor-pointer items-start gap-2 rounded-md border px-2 py-2 transition-colors ${isDragging ? "border-accent bg-surface-3 shadow-lg" : selectedSet.has(idx) ? "border-accent/60 bg-accent/5" : "border-transparent hover:border-edge hover:bg-surface-4"} ${rawEntries[idx]?.hidden ? "opacity-50" : ""}`}
                                                >
                                                    <label className="flex items-center pt-0.5 shrink-0 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            data-testid={`entry-select-${sectionKey}-${idx}`}
                                                            checked={selectedSet.has(idx)}
                                                            onChange={() => toggleEntrySelected(sectionKey, idx)}
                                                            className="peer sr-only"
                                                        />
                                                        <span
                                                            aria-hidden="true"
                                                            className="flex h-[18px] w-[18px] items-center justify-center rounded-md border border-edge bg-surface-2 text-transparent transition-colors peer-hover:border-faint peer-checked:border-accent peer-checked:bg-accent peer-checked:text-surface-2 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40"
                                                        >
                                                            <Check className="h-3 w-3" strokeWidth={3} />
                                                        </span>
                                                    </label>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            {reorderInfo && (
                                                                <button
                                                                    type="button"
                                                                    {...handleProps}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    data-testid={`entry-drag-${sectionKey}-${idx}`}
                                                                    aria-label={t("editor.dragFromHere")}
                                                                    className="w-6 h-6 rounded-md border border-edge text-faint hover:text-strong hover:border-faint cursor-grab active:cursor-grabbing flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                                                    title={t("editor.dragFromHere")}
                                                                >
                                                                    <span className="grid grid-cols-2 gap-[2px]">
                                                                        <span className="w-[2px] h-[2px] rounded-full bg-current" />
                                                                        <span className="w-[2px] h-[2px] rounded-full bg-current" />
                                                                        <span className="w-[2px] h-[2px] rounded-full bg-current" />
                                                                        <span className="w-[2px] h-[2px] rounded-full bg-current" />
                                                                        <span className="w-[2px] h-[2px] rounded-full bg-current" />
                                                                        <span className="w-[2px] h-[2px] rounded-full bg-current" />
                                                                    </span>
                                                                </button>
                                                            )}
                                                            <div className="text-sm font-medium text-strong/90 truncate">{entry.title}</div>
                                                            {entry.dates && (
                                                                <span className="text-xs text-faint shrink-0 whitespace-nowrap ml-auto">{entry.dates}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-faint truncate mt-1">{entry.subtitle}</div>
                                                    </div>
                                                    {entryCfg && (
                                                        <button
                                                            type="button"
                                                            data-testid={`entry-visibility-${sectionKey}-${idx}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleEntryVisibility(entryCfg.items(), entryCfg.updateFn, idx);
                                                            }}
                                                            aria-label={rawEntries[idx]?.hidden ? t("editor.showEntry") : t("editor.hideEntry")}
                                                            title={rawEntries[idx]?.hidden ? t("editor.showEntry") : t("editor.hideEntry")}
                                                            className="w-7 h-7 shrink-0 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint transition-colors flex items-center justify-center"
                                                        >
                                                            {rawEntries[idx]?.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                        </button>
                                                    )}
                                                    {entryCfg && (
                                                        <button
                                                            type="button"
                                                            data-testid={`entry-delete-${sectionKey}-${idx}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                requestEntryDeletion(sectionKey, [idx]);
                                                            }}
                                                            aria-label={t("editor.deleteEntry")}
                                                            title={t("editor.deleteEntry")}
                                                            className="w-7 h-7 shrink-0 rounded-lg border border-edge text-faint hover:text-danger hover:border-danger/60 transition-colors flex items-center justify-center"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {reorderInfo && (
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    shiftPreviewEntry(idx, "up", reorderInfo.items, reorderInfo.updateFn);
                                                                }}
                                                                disabled={idx === 0}
                                                                className="w-7 h-7 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint disabled:opacity-35 disabled:hover:text-faint disabled:hover:border-edge transition-colors flex items-center justify-center"
                                                            >
                                                                <ChevronUp className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    shiftPreviewEntry(idx, "down", reorderInfo.items, reorderInfo.updateFn);
                                                                }}
                                                                disabled={idx === entries.length - 1}
                                                                className="w-7 h-7 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint disabled:opacity-35 disabled:hover:text-faint disabled:hover:border-edge transition-colors flex items-center justify-center"
                                                            >
                                                                <ChevronDown className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            </SortableList>
                                        </div>
                                    )}
                                    {entryCfg && isExpanded && (
                                        <div className="mx-2 mt-1 flex items-center justify-between gap-2 border-t border-edge pb-2 pt-2">
                                            <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    addAndEditEntry(sectionKey);
                                                }}
                                                className="h-8 px-2.5 rounded-lg border border-dashed border-faint text-[11px] text-faint hover:text-strong hover:border-strong transition-colors flex items-center gap-1.5"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                {t("editor.addEntry")}
                                            </button>
                                            {base === "projects" && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setGithubProjectsOpen(true);
                                                    }}
                                                    data-testid="projects-add-from-github"
                                                    title={t("githubProjects.actionTitle")}
                                                    className="h-8 px-2.5 rounded-lg border border-edge text-[11px] text-faint hover:text-strong hover:border-faint transition-colors flex items-center gap-1.5"
                                                >
                                                    <Github className="w-3.5 h-3.5" />
                                                    {t("githubProjects.action")}
                                                </button>
                                            )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                            {entryCfg.sortFn && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        entryCfg.sortFn?.();
                                                    }}
                                                    className="h-8 px-2.5 rounded-lg border border-edge text-[11px] text-faint hover:text-strong hover:border-faint transition-colors flex items-center gap-1.5"
                                                    title={entryCfg.sortTitle || t("editor.sortEntriesByDateTitle")}
                                                >
                                                    <ArrowUpDown className="w-3.5 h-3.5" />
                                                    {entryCfg.sortLabel || t("editor.sortByDate")}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    requestSectionRemoval(sectionKey);
                                                }}
                                                className="w-8 h-8 rounded-lg border border-edge text-faint hover:text-danger hover:border-danger/60 transition-colors flex items-center justify-center"
                                                title={t("editor.deleteSectionAction", { label })}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {availableContentDefs.length > 0 && (
                        <div className="shrink-0 pt-2">
                            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase text-dim">
                                {t("palette.group.available")}
                            </div>
                            {availableContentDefs.map((def) => (
                                <button
                                    key={def.id}
                                    type="button"
                                    onClick={() => addContentSection(def.id)}
                                    data-testid={`add-content-${def.id}`}
                                    className="mx-1 flex min-h-11 w-[calc(100%-0.5rem)] items-center gap-2.5 rounded-md px-2.5 py-2 text-left outline-none transition-colors hover:bg-surface-4 focus-visible:bg-surface-4 focus-visible:ring-1 focus-visible:ring-accent"
                                >
                                    <def.icon className="h-4 w-4 shrink-0 text-faint" />
                                    <span className="min-w-0 flex-1 truncate text-sm text-mid">
                                        {t("palette.addContentSection", { section: def.title })}
                                    </span>
                                    <span className="shrink-0 text-xs text-dim">{t("palette.notAdded")}</span>
                                    <Plus className="h-3.5 w-3.5 shrink-0 text-faint" />
                                </button>
                            ))}
                        </div>
                    )}

                    {normalizedContentSearch
                        && !showBasics
                        && visibleSectionKeys.length === 0
                        && availableContentDefs.length === 0 && (
                            <p className="px-3 py-8 text-center text-xs text-faint">
                                {t("customize.noResults")}
                            </p>
                        )}

                    <div className="mx-1 mt-3 shrink-0 border-t border-edge py-2">
                        <button
                            type="button"
                            onClick={() => setImportDataOpen(true)}
                            data-testid="import-data-content"
                            className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left outline-none transition-colors hover:bg-surface-4 focus-visible:bg-surface-4 focus-visible:ring-1 focus-visible:ring-accent"
                        >
                            <FileText className="h-4 w-4 shrink-0 text-faint" />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-bright">{t("editor.importData")}</span>
                                <span className="block truncate text-xs text-faint">{t("editor.importDataDesc")}</span>
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-dim" />
                        </button>
                    </div>
                </div>
            )}

            {mobileFooter}

            {deleteConfirmModal}
            {entryDeleteConfirmModal}
            {githubProjectsOpen && (
                <GithubProjectsImportDialog
                    existingProjects={resume.projects || []}
                    onApply={updateProjects}
                    onClose={() => setGithubProjectsOpen(false)}
                />
            )}

            {importDataOpen && (
                <ImportDataDialog
                    current={resume}
                    onApply={(next) => {
                        // Marks the CV as changed, so autosave writes it.
                        applyContentTransform(() => ({ ...next, id: resume.id, createdAt: resume.createdAt, updatedAt: Date.now() }));
                        setContentSearch("");
                    }}
                    onUndo={(previous) => applyContentTransform(() => previous)}
                    onCreateNew={persistImportedResume}
                    onClose={() => setImportDataOpen(false)}
                />
            )}
        </div>
    );
}
