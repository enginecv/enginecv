"use client";

import { useResumeStore } from "@/lib/store";
import "./preview-fonts";
import { Fragment, useId, useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo, type CSSProperties } from "react";
import {
    Maximize, Minimize, Mail, Phone, MapPin, Globe,
    Linkedin, Github,
    UserRound, Heart,
    CalendarDays, Flag, Car, CreditCard, ShieldCheck, Accessibility, Plane, Ruler,
    RotateCcw, ZoomIn, ZoomOut, Link,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { fromHardBreaks, preserveLineBreaks } from "@/lib/markdown-breaks";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";
import { CUSTOM_ICON_LUCIDE_MAP, formatDateForDisplay } from "./FormUtils";
import {
    CountryFlag,
    parseCountryTokens,
    lookupCountry,
    countryDisplayText,
    shouldShowFlag,
    shouldShowText,
    type CountryDisplayMode,
} from "@/components/ui/country-dropdown";
import { parseLicenses } from "@/lib/driving-license-classes";
import { parsePassportId, parseDocuments } from "@/components/ui/passport-id-input";
import { getMaritalStatusLabel, isMaritalStatusKey, isHiddenMaritalStatus } from "@/lib/marital-status";
import { renderDisability } from "@/lib/disability";
import { parsePhones } from "@/components/ui/phone-input";
import { parsePhoneNumber } from "react-phone-number-input";
import { formatCvText, getCvLanguageLabels } from "@/lib/cv-language";
import { resolveExternalHref } from "@/lib/external-links";
import { getPrimaryResumeEmail, getResumeEmails } from "@/lib/emails";
import { useTranslation } from "@/lib/i18n";
import type { Resume, ResumeSettings } from "@/lib/schema";
import { isNativeLanguageFluency, skillLevelRank, SKILL_LEVELS, type SkillGroup } from "@/lib/schema";
import { assessedCefrSkills, CEFR_SKILL_GROUPS, CEFR_SKILLS, isCefrLevel, type CefrSkill, type CefrSkillGroup } from "@/lib/cefr";
import { resolveSectionSettings } from "@/lib/customization";
import type { IconComponent } from "@/lib/icons/brand-icons";
import { getVisibleContentKeys, getVisibleSectionEntries, visibleEntries } from "@/lib/preview/visibility";
import { getRoleFonts, roleFontStack, fontFamilyCssValue } from "@/lib/fonts";
import { PreviewNavMenu } from "./PreviewNavMenu";
import { RepoBadgeList } from "./RepoBadge";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import {
    buildBoxBorderStyles,
    blendHex,
    type BoxBorderSettings,
} from "@/lib/preview/box-style";
import { DEFAULT_DESIGN_BORDER, DEFAULT_DESIGN_SETTINGS, DEFAULT_DESIGN_STYLE, type DesignElement } from "@/lib/design";
import { clampPan, computePanBounds } from "@/lib/preview/pan-bounds";
import { derivePageGeometry } from "@/lib/preview/page-geometry";
import { isGithubProject } from "@/lib/import/github-projects";
import {
    PAPER,
    PREVIEW_PAGE_GAP_PX,
    SECTION_DEFAULT_ICON_MAP,
    buildPhotoFilterValue,
    getCustomLinkIcon,
    getSkillIcon,
    getBrandIconHex,
    mmToPx,
    ptToPx,
} from "./preview/preview-constants";
import {
    arePositionedLayoutsEqual,
    chunkPreviewBlocks,
    chunkSectionEntries,
    getMeasuredBlockFootprints,
    getPreviewSectionBaseId,
    normalizeLayoutPlacement,
    resolvePreviewFlowOrder,
    resolvePreviewRenderableItems,
} from "@/lib/preview/pagination";
import type {
    LayoutItemRender,
    LayoutSectionPlacement,
    PositionedLayoutItem,
    PreviewBlock,
    PreviewSection,
    PreviewSectionKey,
} from "@/lib/preview/pagination-types";
import { DesignOverlayElementView } from "./preview/DesignOverlay";
import { InlineEditProvider, InlineInteractiveContext, InlineField, InlineToolbar } from "./preview/PreviewInlineEdit";

interface ResumePreviewProps {
    resumeOverride?: Resume;
    paperSizeOverride?: "a4" | "letter";
    thumbnailMode?: boolean;
}

// Browser layout can gain a few pixels after font shaping and sub-pixel
// rounding. Keep content clear of the footer even when measured values land
// exactly on the printable boundary.
const PAGINATION_OVERFLOW_GUARD_PX = 8;

// Smallest base-scale change worth re-rendering for. Below this the difference
// is invisible, and treating it as a change is what lets a scrollbar toggle
// feed itself (see `updateScale`).
const BASE_SCALE_EPSILON = 1e-4;

function observePaginationMeasurements(
    container: HTMLElement,
    targetSelector: string,
    requestMeasure: () => void,
) {
    let active = true;
    const resizeObserver = typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => requestMeasure());

    resizeObserver?.observe(container);
    container.querySelectorAll<HTMLElement>(targetSelector).forEach((node) => resizeObserver?.observe(node));

    const fontSet = typeof document === "undefined" ? null : document.fonts;
    const handleFontLayoutChange = () => {
        if (active) requestMeasure();
    };

    if (fontSet) {
        void fontSet.ready.then(handleFontLayoutChange);
        fontSet.addEventListener("loadingdone", handleFontLayoutChange);
        fontSet.addEventListener("loadingerror", handleFontLayoutChange);
    }

    return () => {
        active = false;
        resizeObserver?.disconnect();
        fontSet?.removeEventListener("loadingdone", handleFontLayoutChange);
        fontSet?.removeEventListener("loadingerror", handleFontLayoutChange);
    };
}

export function ResumePreview({ resumeOverride, paperSizeOverride, thumbnailMode = false }: ResumePreviewProps = {}) {
    const storeResume = useResumeStore((state) => state.resume);
    const storePaperSize = useResumeStore((state) => state.paperSize);
    const selectedDesignElementId = useResumeStore((state) => state.selectedDesignElementId);
    const selectDesignElement = useResumeStore((state) => state.selectDesignElement);
    const clearDesignSelection = useResumeStore((state) => state.clearDesignSelection);
    const setActiveDesignPage = useResumeStore((state) => state.setActiveDesignPage);
    const setPreviewPageCount = useResumeStore((state) => state.setPreviewPageCount);
    const updateDesignElement = useResumeStore((state) => state.updateDesignElement);
    const updateDesignElementStyle = useResumeStore((state) => state.updateDesignElementStyle);
    const duplicateDesignElement = useResumeStore((state) => state.duplicateDesignElement);
    const moveDesignElementLayer = useResumeStore((state) => state.moveDesignElementLayer);
    const removeDesignElement = useResumeStore((state) => state.removeDesignElement);
    const resume = resumeOverride ?? storeResume;
    // Hidden sections/entries are filtered here once; everything below (and
    // therefore every visual export, which consumes this preview's pages)
    // renders only visible content. JSON export reads the raw document.
    const content = useMemo(() => getVisibleSectionEntries(resume), [resume]);
    const allSkillsVisible = useMemo(
        () => content.skillGroups.flatMap((group) => group.skills),
        [content],
    );
    const paperSize = paperSizeOverride ?? storePaperSize;
    const isInteractiveDesignPreview = !resumeOverride;
    const { name, headline, phone, location, website, summary, linkedin, github } = resume.basics;
    const emailEntries = getResumeEmails(resume.basics);
    const primaryEmail = getPrimaryResumeEmail(resume.basics);
    const { t } = useTranslation();

    const defaultSettings = {
        theme: "modern",
        language: "en",
        dateFormat: "DD/MM/YYYY",
        layout: {
            columns: "one" as const,
            headerPosition: "top" as const,
            leftColumnWidth: 50,
            sectionPlacement: {} as Record<string, LayoutSectionPlacement>,
            sectionOrder: ["experience", "education", "certificates", "projects"],
        },
        typography: { fontFamily: "Inter", fontSize: 10, lineHeight: 1.35 },
        spacing: { marginH: 20, marginV: 18, itemSpacing: 10 },
        colors: { variant: "basic" as const, accent: "#ffaa8d", text: "#111827", background: "#fff8f6", applyTo: ["headingsLine", "dotsBarsBubbles"] as string[] },
        headings: {
            style: "baseline", capitalization: "uppercase" as const, size: "m" as const,
            fontFamily: "", fontSize: 14, fontWeight: "700", fontStyle: "normal", textDecoration: "none",
            textAlign: "left" as const, letterSpacing: 0, lineHeight: 1.15,
            paddingTop: 0, paddingBottom: 6, paddingLeft: 0, paddingRight: 0, marginTop: 0, marginBottom: 16, marginLeft: 0, marginRight: 0,
            border: { style: "solid" as const, width: 2, color: "", radius: 0, top: false, bottom: true, left: false, right: false, dashLength: 6, dashGap: 4 },
            backgroundColor: "", borderColor: "", preset: "baseline",
        },
        header: { fontFamily: "", fontSize: 36, fontWeight: "bold" as const, fontStyle: "normal" as const, textDecoration: "none" as const, textTransform: "none" as const },
        customFonts: [] as Array<{ name: string, url: string }>,
        linkIcon: { side: "left" as const, size: 0.85, align: "baseline" as const },
        headerIcon: { side: "hidden" as "left" | "right" | "hidden", size: 0.85, align: "baseline" as const },
        personalDetails: {
            alignment: "left" as const,
            layout: "imageRight" as const,
            detailsLayout: "wrap" as const,
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            border: {
                style: "solid" as const,
                width: 0,
                color: "",
                radius: 0,
                top: false,
                bottom: false,
                left: false,
                right: false,
                dashLength: 6,
                dashGap: 4,
            },
            photo: {
                width: 96,
                height: 96,
                paddingTop: 0,
                paddingBottom: 0,
                paddingLeft: 0,
                paddingRight: 0,
                marginTop: 0,
                marginBottom: 0,
                marginLeft: 0,
                marginRight: 0,
                border: {
                    style: "solid" as const,
                    width: 1,
                    color: "",
                    radius: 18,
                    top: true,
                    bottom: true,
                    left: true,
                    right: true,
                    dashLength: 6,
                    dashGap: 4,
                },
                filter: {
                    preset: "natural",
                    brightness: 100,
                    contrast: 100,
                    saturate: 100,
                    grayscale: 0,
                    sepia: 0,
                    hueRotate: 0,
                    blur: 0,
                },
            },
        },
        contentStyle: {
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            border: {
                style: "solid" as const,
                width: 0,
                color: "",
                radius: 0,
                top: false,
                bottom: false,
                left: false,
                right: false,
                dashLength: 6,
                dashGap: 4,
            },
            backgroundColor: "",
            preset: "plain",
        },
        footer: {
            show: false,
            showName: false,
            showPhone: false,
            showEmail: false,
            showPageNumbers: false,
            left: "",
            middle: "",
            right: "",
            heightLines: 1,
        },
        repoBadge: {
            fontFamily: "",
            fontSize: 9,
            fontWeight: "600" as const,
            fontStyle: "normal" as const,
            textTransform: "none" as const,
            letterSpacing: 0,
            paddingX: 8,
            paddingY: 2,
            gap: 6,
            marginTop: 4,
            marginBottom: 4,
            iconSize: 0.85,
            colorMode: "platform" as const,
            textColor: "",
            backgroundColor: "",
            backgroundOpacity: 0.1,
            borderColor: "",
            borderOpacity: 0.33,
            border: {
                style: "solid" as const,
                width: 1,
                color: "",
                radius: 999,
                top: true,
                bottom: true,
                left: true,
                right: true,
                dashLength: 6,
                dashGap: 4,
            },
            showIcon: true,
            showPlatformName: false,
            showVisibility: false,
        },
        languagesSection: {
            columns: 1,
            columnGap: 16,
            itemSpacing: null as number | null,
            fluencyDisplay: "badge" as const,
            fluencySize: 0.85,
            fluencyPlacement: "nextLine" as const,
            fluencyOrder: "languageFirst" as const,
            textAlign: "left" as const,
            tableCellPaddingX: 8,
            tableCellPaddingY: 6,
        },
        design: DEFAULT_DESIGN_SETTINGS,
    };

    const settings = {
        ...defaultSettings,
        ...(resume.settings || {}),
        layout: { ...defaultSettings.layout, ...(resume.settings?.layout || {}) },
        typography: { ...defaultSettings.typography, ...(resume.settings?.typography || {}) },
        spacing: { ...defaultSettings.spacing, ...(resume.settings?.spacing || {}) },
        colors: { ...defaultSettings.colors, ...(resume.settings?.colors || {}) },
        headings: { ...defaultSettings.headings, ...(resume.settings?.headings || {}) },
        header: { ...defaultSettings.header, ...((resume.settings as any)?.header || {}) },
        customFonts: ((resume.settings as any)?.customFonts || defaultSettings.customFonts) as Array<{ name: string, url: string }>,
        linkIcon: { ...defaultSettings.linkIcon, ...((resume.settings as any)?.linkIcon || {}) },
        headerIcon: { ...defaultSettings.headerIcon, ...((resume.settings as any)?.headerIcon || {}) },
        personalDetails: {
            ...defaultSettings.personalDetails,
            ...(resume.settings?.personalDetails || {}),
            border: {
                ...defaultSettings.personalDetails.border,
                ...((resume.settings?.personalDetails as any)?.border || {}),
            },
            photo: {
                ...defaultSettings.personalDetails.photo,
                ...((resume.settings?.personalDetails as any)?.photo || {}),
                border: {
                    ...defaultSettings.personalDetails.photo.border,
                    ...(((resume.settings?.personalDetails as any)?.photo?.border) || {}),
                },
                filter: {
                    ...defaultSettings.personalDetails.photo.filter,
                    ...(((resume.settings?.personalDetails as any)?.photo?.filter) || {}),
                },
            },
        },
        contentStyle: { ...defaultSettings.contentStyle, ...((resume.settings as any)?.contentStyle || {}) },
        footer: { ...defaultSettings.footer, ...((resume.settings as any)?.footer || {}) },
        repoBadge: {
            ...((defaultSettings as any).repoBadge || {}),
            ...((resume.settings as any)?.repoBadge || {}),
            border: {
                ...(((defaultSettings as any).repoBadge?.border) || {}),
                ...(((resume.settings as any)?.repoBadge?.border) || {}),
            },
        },
        languagesSection: {
            ...defaultSettings.languagesSection,
            ...((resume.settings as any)?.languagesSection || {}),
        },
        design: {
            ...defaultSettings.design,
            ...((resume.settings as any)?.design || {}),
            elements: (((resume.settings as any)?.design?.elements || defaultSettings.design.elements) as DesignElement[]).map((element) => ({
                ...element,
                style: {
                    ...DEFAULT_DESIGN_STYLE,
                    ...element.style,
                    border: {
                        ...DEFAULT_DESIGN_BORDER,
                        ...(element.style?.border || {}),
                    },
                },
            })),
        },
    };
    const getScopedSettings = (sectionKey: string): typeof settings => {
        const base = sectionKey.split(":")[0];
        const overrides = resume.customization?.sectionOverrides || {};
        const configuredKey = sectionKey.includes(":")
            ? sectionKey
            : (resume.settings.contentSections || []).find((key) => key.split(":")[0] === base) || sectionKey;
        const override = overrides[configuredKey] || overrides[base];
        return resolveSectionSettings(
            settings as unknown as ResumeSettings,
            override,
        ) as typeof settings;
    };
    const cvLabels = getCvLanguageLabels(settings.language);
    const interestsLabel = cvLabels.interests || "Interests";
    const interestLabel = cvLabels.interest || "Interest";
    const organisationsLabel = cvLabels.organisations;
    const coursesLabel = cvLabels.courses;
    const awardsLabel = cvLabels.awards;
    const publicationsLabel = cvLabels.publications;
    const referencesLabel = cvLabels.references;
    const declarationLabel = cvLabels.declaration;
    const languagesLabel = cvLabels.languages;
    const skillsLabel = cvLabels.skills;
    const storedLanguageLayout = (settings.sectionDisplay as any)?.languages?.languageLayout;
    const languageLayout: "list" | "table" | "cefr" =
        storedLanguageLayout === "table" || storedLanguageLayout === "cefr" ? storedLanguageLayout : "list";
    const languagesStyle = getScopedSettings("languages").languagesSection;
    const projectsStyle = getScopedSettings("projects");
    const languageColumns = languageLayout === "list" ? Math.min(3, Math.max(1, languagesStyle.columns ?? 1)) : 1;
    // Custom entry spacing replaces the global spacing.itemSpacing part of the wrapper margin.
    const languageEntrySpacing = languagesStyle.itemSpacing == null ? null : Math.max(0, languagesStyle.itemSpacing);
    const designElements = settings.design.elements || [];
    const accentTargets = new Set(settings.colors.applyTo || defaultSettings.colors.applyTo);
    const resolveAccentTargetColor = (target: string, fallback = settings.colors.text) =>
        accentTargets.has(target) ? settings.colors.accent : fallback;
    const typographyScale = settings.typography.fontSize / defaultSettings.typography.fontSize;
    const scaledHeaderFontSize = settings.header.fontSize * typographyScale;
    const scaledHeadingFontSize = (((settings.headings as any).fontSize ?? 14) as number) * typographyScale;
    const scaledTextSmSize = 14 * typographyScale;
    const scaledTextSmLineHeight = 20 * typographyScale;
    const scaledTextXsSize = 12 * typographyScale;
    const scaledTextXsLineHeight = 16 * typographyScale;
    const nameColor = resolveAccentTargetColor("name");
    const jobTitleColor = resolveAccentTargetColor("jobTitle");
    const headingColor = resolveAccentTargetColor("headings");
    const headingLineColor = resolveAccentTargetColor("headingsLine");
    const entrySubtitleColor = resolveAccentTargetColor("entrySubtitle");
    const dateColor = resolveAccentTargetColor("dates");
    const headerIconColor = resolveAccentTargetColor("headerIcons");
    const linkIconColor = resolveAccentTargetColor("linkIcons");
    const markerColor = resolveAccentTargetColor("dotsBarsBubbles");
    const sectionDisplayMap = ((settings as any).sectionDisplay || {}) as Record<string, { title?: string; icon?: string; showIcon?: boolean }>;
    const getSectionHeading = (base: string, fallback: string) => {
        const custom = sectionDisplayMap[base]?.title;
        return custom && custom.trim() ? custom.trim() : fallback;
    };
    const getSectionHeadingIcon = (base: string): LucideIcon | null => {
        const cfg = sectionDisplayMap[base];
        if (cfg?.showIcon === false) return null;
        if (cfg?.icon && cfg.icon !== "auto") {
            return CUSTOM_ICON_LUCIDE_MAP[cfg.icon] || SECTION_DEFAULT_ICON_MAP[base] || null;
        }
        return SECTION_DEFAULT_ICON_MAP[base] || null;
    };
    const formatResumeDate = (value: string) => formatDateForDisplay(value, settings.dateFormat, settings.language);
    const formatResumeDateRange = (start?: string, end?: string) =>
        [start, end].filter(Boolean).map((d) => formatResumeDate(String(d))).join(" – ");

    const containerRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLDivElement>(null);
    const multiMeasureRef = useRef<HTMLDivElement>(null);
    const rawScopeId = useId();
    const scopeClass = `resume-preview-scope-${rawScopeId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const scopeSelector = `.${scopeClass}`;
    const [baseScale, setBaseScale] = useState(1);
    const [fullscreen, setFullscreen] = useState(false);
    const [pageChunks, setPageChunks] = useState<number[][]>([[]]); // array of arrays of block indices
    const [multiPageLayouts, setMultiPageLayouts] = useState<PositionedLayoutItem[][]>([]);

    // Zoom & pan state
    const [zoom, setZoom] = useState(1);
    const [hasRestoredPreferredZoom, setHasRestoredPreferredZoom] = useState(false);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const panRef = useRef({ x: 0, y: 0 });
    const isPanning = useRef(false);
    const didDrag = useRef(false);
    const spaceHeld = useRef(false);
    const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const isMobile = useRef(false);
    // Element-selection context menu (opened by clicking a preview element).
    const [navMenu, setNavMenu] = useState<{ x: number; y: number; section: string; entryIndex: number | null; kind: string } | null>(null);
    const requestEditorNav = useResumeStore((state) => state.requestEditorNav);
    const requestCustomizeSection = useResumeStore((state) => state.requestCustomizeSection);
    const pendingPreviewCommand = useResumeStore((state) => state.pendingPreviewCommand);
    const consumePreviewCommand = useResumeStore((state) => state.consumePreviewCommand);
    const updateBasics = useResumeStore((state) => state.updateBasics);
    const updateExperience = useResumeStore((state) => state.updateExperience);
    const updateSettings = useResumeStore((state) => state.updateSettings);
    const preferencesHydrated = useClientPreferencesStore((state) => state.hydrated);
    const preferredZoom = useClientPreferencesStore((state) => state.preferences.preview.zoom);
    const updateClientPreferenceSection = useClientPreferencesStore(
        (state) => state.updateSection,
    );
    // Pending single-click nav menu, deferred so a following double-click
    // (inline edit) can cancel it before its backdrop swallows the 2nd click.
    const navClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const viewportRef = useRef({ width: 0, height: 0 });
    const contentSizeRef = useRef({ width: 0, height: 0 });

    const scale = baseScale * zoom;

    const paper = PAPER[paperSize];
    const pageBorderWidth = settings.colors.variant === 'border' ? 16 : 0;
    const pageContentWidth = paper.width - (pageBorderWidth * 2);
    const pageContentHeight = paper.height - (pageBorderWidth * 2);
    const marginHorizontalPx = mmToPx(settings.spacing.marginH);
    const marginVerticalPx = mmToPx(settings.spacing.marginV);
    const footerSettings = settings.footer ?? defaultSettings.footer;
    const footerHeightPx = (
        footerSettings.show
        || footerSettings.showName
        || footerSettings.showPhone
        || footerSettings.showEmail
        || footerSettings.showPageNumbers
    )
        ? ptToPx(settings.typography.fontSize) * settings.typography.lineHeight * Math.max(footerSettings.heightLines || 1, 1)
        : 0;
    const layoutContentWidth = Math.max(0, pageContentWidth - (marginHorizontalPx * 2));
    const pageGeometry = derivePageGeometry({
        pageContentHeight,
        marginVerticalPx,
        footerHeightPx,
    });
    const layoutContentHeight = pageGeometry.usableContentHeightPx;
    const paginationContentHeight = Math.max(0, layoutContentHeight - PAGINATION_OVERFLOW_GUARD_PX);
    const columnGap = 24;
    const separatorLineThickness = 1;
    const leftColumnWidth = Math.max(0, ((layoutContentWidth - columnGap) * settings.layout.leftColumnWidth) / 100);
    const rightColumnWidth = Math.max(0, layoutContentWidth - columnGap - leftColumnWidth);
    const pairedLeftColumnWidth = Math.max(0, ((layoutContentWidth - separatorLineThickness) * settings.layout.leftColumnWidth) / 100);
    const pairedRightColumnWidth = Math.max(0, layoutContentWidth - separatorLineThickness - pairedLeftColumnWidth);
    const isStructuredLayout = settings.layout.columns === "two" || settings.layout.columns === "mix";
    const layoutSectionGap = 20;

    const ZOOM_MIN = 0.5;
    const ZOOM_MAX = 3;
    const ZOOM_STEP = 0.15;

    // 0.15 is not exact in binary, so stepping repeatedly drifts (0.75 becomes
    // 0.7500000000000011) and the drifted value is what gets persisted. Rounding
    // to the step's own precision keeps the stored zoom clean and keeps the
    // `zoom === preferredZoom` guard below a meaningful comparison.
    const clampZoom = (value: number) =>
        Math.round(Math.min(Math.max(value, ZOOM_MIN), ZOOM_MAX) * 100) / 100;

    // Detect mobile once on mount
    useEffect(() => {
        isMobile.current = window.innerWidth < 1024 || 'ontouchstart' in window;
    }, []);

    const resetPan = useCallback(() => {
        const origin = { x: 0, y: 0 };
        panRef.current = origin;
        setPan(origin);
    }, []);

    const resetView = useCallback(() => {
        setZoom(1);
        resetPan();
    }, [resetPan]);

    const zoomIn = useCallback(() => {
        setZoom(z => clampZoom(z + ZOOM_STEP));
    }, []);

    const zoomOut = useCallback(() => {
        setZoom(z => clampZoom(z - ZOOM_STEP));
    }, []);

    const isZoomedOrPanned = zoom !== 1 || pan.x !== 0 || pan.y !== 0;

    // Ctrl+Wheel zoom (desktop only)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            if (isMobile.current) return;
            if (!e.ctrlKey && !e.metaKey) return;

            e.preventDefault();
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            setZoom(z => clampZoom(z + delta));
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, []);

    // Keep panRef in sync with state so the mousedown handler always reads current values
    useEffect(() => {
        panRef.current = pan;
    }, [pan]);

    // The saved zoom only seeds the session. Once it has been applied the local
    // `zoom` owns the value and the effect below writes it back, so restoring on
    // every `preferredZoom` change makes the two effects mirror each other: a
    // write that lands between one wheel tick and the next re-applies the stored
    // value on top of the newer local one, and the pair trade updates until React
    // trips "Maximum update depth exceeded". Restoring once breaks the cycle.
    useEffect(() => {
        if (thumbnailMode || !preferencesHydrated || hasRestoredPreferredZoom) return;
        setZoom(preferredZoom);
        setHasRestoredPreferredZoom(true);
    }, [hasRestoredPreferredZoom, preferencesHydrated, preferredZoom, thumbnailMode]);

    useEffect(() => {
        if (thumbnailMode || !hasRestoredPreferredZoom || zoom === preferredZoom) return;
        updateClientPreferenceSection("preview", { zoom });
    }, [
        hasRestoredPreferredZoom,
        preferredZoom,
        thumbnailMode,
        updateClientPreferenceSection,
        zoom,
    ]);

    // Mouse drag panning (desktop only) – registered once, reads pan from ref
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Pan with the MIDDLE mouse button, or Spacebar + left drag (trackpad
        // fallback). Left click is reserved for selecting preview elements.
        const handleMouseDown = (e: MouseEvent) => {
            if (isMobile.current) return;
            const isMiddle = e.button === 1;
            const isSpaceLeft = e.button === 0 && spaceHeld.current;
            if (!isMiddle && !isSpaceLeft) return;
            const target = e.target as HTMLElement;
            if (target.closest('button, a, input, [data-no-drag]')) return;

            isPanning.current = true;
            didDrag.current = false;
            panStart.current = { x: e.clientX, y: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
            container.style.cursor = 'grabbing';
            e.preventDefault();
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isPanning.current) return;
            const dx = e.clientX - panStart.current.x;
            const dy = e.clientY - panStart.current.y;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
            const rawPan = { x: panStart.current.panX + dx, y: panStart.current.panY + dy };
            const bounds = computePanBounds(viewportRef.current, contentSizeRef.current);
            const newPan = clampPan(rawPan, bounds);
            panRef.current = newPan;
            setPan(newPan);
        };

        const handleMouseUp = () => {
            if (!isPanning.current) return;
            isPanning.current = false;
            container.style.cursor = spaceHeld.current ? 'grab' : '';
        };

        // Left click on a tagged preview element opens the selection menu.
        const handleClick = (e: MouseEvent) => {
            if (thumbnailMode) return;
            if (e.button !== 0 || didDrag.current || spaceHeld.current) return;
            const target = e.target as HTMLElement;
            // Clicks inside an actively-edited element place the caret; never
            // hijack them into the selection menu.
            if (target.isContentEditable) return;
            // Links retain native browser behavior. Element navigation remains
            // available by clicking surrounding personal-detail/entry content.
            const linkEl = target.closest('a[href]') as HTMLAnchorElement | null;
            if (linkEl) {
                setNavMenu(null);
                return;
            }
            // Second click of a double-click: cancel the deferred menu so the
            // element's own double-click (inline edit) proceeds unobstructed.
            if (e.detail >= 2) {
                if (navClickTimer.current) { clearTimeout(navClickTimer.current); navClickTimer.current = null; }
                return;
            }
            const el = target.closest('[data-nav-section]') as HTMLElement | null;
            if (!el) {
                if (navClickTimer.current) { clearTimeout(navClickTimer.current); navClickTimer.current = null; }
                setNavMenu(null);
                return;
            }
            const section = el.getAttribute('data-nav-section');
            if (!section) return;
            const idxAttr = el.getAttribute('data-nav-entry-index');
            const entryIndex = idxAttr != null && idxAttr !== '' ? Number(idxAttr) : null;
            const kind = el.getAttribute('data-nav-kind') || 'entry';
            e.preventDefault();
            // Defer: a double-click within ~220ms clears this before it fires.
            const payload = { x: e.clientX, y: e.clientY, section, entryIndex, kind };
            if (navClickTimer.current) clearTimeout(navClickTimer.current);
            navClickTimer.current = setTimeout(() => {
                setNavMenu(payload);
                navClickTimer.current = null;
            }, 220);
        };

        // Middle-button "auxclick" would otherwise autoscroll / open links.
        const handleAuxClick = (e: MouseEvent) => {
            if (e.button === 1) e.preventDefault();
        };

        container.addEventListener('mousedown', handleMouseDown);
        container.addEventListener('click', handleClick);
        container.addEventListener('auxclick', handleAuxClick);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            container.removeEventListener('click', handleClick);
            container.removeEventListener('auxclick', handleAuxClick);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            if (navClickTimer.current) clearTimeout(navClickTimer.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Spacebar toggles pan mode (hold Space + left drag). Ignored while typing.
    useEffect(() => {
        const isTypingTarget = (el: EventTarget | null) => {
            const node = el as HTMLElement | null;
            if (!node) return false;
            const tag = node.tagName;
            return tag === "INPUT" || tag === "TEXTAREA" || node.isContentEditable;
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.code !== "Space" || spaceHeld.current || isTypingTarget(e.target)) return;
            spaceHeld.current = true;
            const container = containerRef.current;
            if (container && !isPanning.current) container.style.cursor = 'grab';
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code !== "Space") return;
            spaceHeld.current = false;
            const container = containerRef.current;
            if (container && !isPanning.current) container.style.cursor = '';
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);

    // Observe container size and compute base scale so the page fits
    useEffect(() => {
        if (thumbnailMode) {
            setBaseScale(1);
            return;
        }
        const container = containerRef.current;
        if (!container) return;

        const updateScale = () => {
            const padding = fullscreen ? 80 : 48;
            const { width, height } = container.getBoundingClientRect();
            viewportRef.current = { width, height };
            const availableWidth = width - padding;
            const availableHeight = height - padding;

            const scaleByWidth = availableWidth / paper.width;
            const scaleByHeight = availableHeight / paper.height;

            // The container is `overflow-auto`, so the scale set here changes the
            // content's size, which can add or remove a scrollbar, which resizes
            // the container and fires this observer again. At a fractional
            // container width the two scrollbar states can each imply the other,
            // and the raw float never repeats exactly, so every pass looks like a
            // real change and the observer reschedules forever. Quantizing makes
            // the sequence converge: a difference this small is invisible on
            // screen but is all the loop needs to keep going.
            const nextBaseScale = Math.round(Math.min(scaleByWidth, scaleByHeight, 1) * 1000) / 1000;
            setBaseScale((prev) => (Math.abs(prev - nextBaseScale) < BASE_SCALE_EPSILON ? prev : nextBaseScale));

            const bounds = computePanBounds(viewportRef.current, contentSizeRef.current);
            const clamped = clampPan(panRef.current, bounds);
            if (clamped.x !== panRef.current.x || clamped.y !== panRef.current.y) {
                panRef.current = clamped;
                setPan(clamped);
            }
        };

        const observer = new ResizeObserver(updateScale);
        observer.observe(container);
        updateScale();

        return () => observer.disconnect();
    }, [paper.width, paper.height, fullscreen, thumbnailMode]);

    // Keep saved zoom while recentering for geometry changes.
    useEffect(() => {
        resetPan();
    }, [fullscreen, paperSize, resetPan]);

    // Close fullscreen on Escape
    useEffect(() => {
        if (!fullscreen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") setFullscreen(false);
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [fullscreen]);

    const toggleFullscreen = useCallback(() => setFullscreen(v => !v), []);

    useEffect(() => {
        if (!pendingPreviewCommand || thumbnailMode) return;

        switch (pendingPreviewCommand.command.type) {
            case "zoomIn":
                zoomIn();
                break;
            case "zoomOut":
                zoomOut();
                break;
            case "resetView":
                resetView();
                break;
            case "toggleFullscreen":
                toggleFullscreen();
                break;
            case "setZoom":
                setZoom(clampZoom(pendingPreviewCommand.command.value));
                break;
        }
        consumePreviewCommand();
    }, [
        consumePreviewCommand,
        pendingPreviewCommand,
        resetView,
        thumbnailMode,
        toggleFullscreen,
        zoomIn,
        zoomOut,
    ]);

    // --- Inline edit-in-place ---------------------------------------------
    const inlineEditable = !thumbnailMode && isInteractiveDesignPreview;

    // Patch a single experience entry (by id) from an inline edit.
    const patchExperience = useCallback((id: string, patch: Record<string, unknown>) => {
        const next = resume.experience.map((e) =>
            e.id === id ? { ...e, ...patch } : e,
        );
        updateExperience(next);
    }, [resume.experience, updateExperience]);

    // Global-binding size targets for the floating toolbar (class-wide).
    const entryTitleSizeTarget = {
        size: {
            value: settings.entryLayout.titleFontSize,
            min: 8, max: 16, step: 1, unit: "pt",
            set: (n: number) => updateSettings({ entryLayout: { ...settings.entryLayout, titleFontSize: n } }),
        },
    };
    const entrySubtitleSizeTarget = {
        size: {
            value: settings.entryLayout.subtitleFontSize,
            min: 8, max: 16, step: 1, unit: "pt",
            set: (n: number) => updateSettings({ entryLayout: { ...settings.entryLayout, subtitleFontSize: n } }),
        },
    };
    const nameSizeTarget = {
        size: {
            value: settings.header.fontSize,
            min: 12, max: 54, step: 2, unit: "px",
            set: (n: number) => updateSettings({ header: { ...settings.header, fontSize: n } }),
        },
    };

    const contentAlignClass = settings.personalDetails.alignment === "center" ? "items-center text-center" :
        settings.personalDetails.alignment === "right" ? "items-end text-right" :
            "items-start text-left";

    const contactJustifyClass = settings.personalDetails.alignment === "center" ? "justify-center" :
        settings.personalDetails.alignment === "right" ? "justify-end" : "justify-start";

    const contactGridAlignClass = settings.personalDetails.alignment === "center" ? "justify-items-center text-center" :
        settings.personalDetails.alignment === "right" ? "justify-items-end text-right" :
            "justify-items-start text-left";

    const personalDetailsLayout = settings.personalDetails.layout ?? "imageRight";
    const contactLayout = settings.personalDetails.detailsLayout ?? "wrap";
    const hasProfilePhoto = Boolean(resume.basics.photo);
    const profilePhotoSettings = settings.personalDetails.photo ?? defaultSettings.personalDetails.photo;
    const usesDefaultProfilePhotoSize =
        profilePhotoSettings.width === defaultSettings.personalDetails.photo.width &&
        profilePhotoSettings.height === defaultSettings.personalDetails.photo.height;
    const resolvedProfilePhotoWidth = Math.round(
        (
            usesDefaultProfilePhotoSize && personalDetailsLayout === "imageTop"
                ? profilePhotoSettings.width * (124 / 96)
                : profilePhotoSettings.width
        ) * typographyScale
    );
    const resolvedProfilePhotoHeight = Math.round(
        (
            usesDefaultProfilePhotoSize && personalDetailsLayout === "imageTop"
                ? profilePhotoSettings.height * (124 / 96)
                : profilePhotoSettings.height
        ) * typographyScale
    );
    const profileImageBorderColor = blendHex(settings.colors.accent, "#ffffff", 0.45);
    const profilePhotoFilterValue = buildPhotoFilterValue(profilePhotoSettings.filter);
    const profileSectionBorder = settings.personalDetails.border ?? defaultSettings.personalDetails.border;
    const profileSectionHasCustomBorder =
        (profileSectionBorder.width ?? 0) > 0 &&
        Boolean(profileSectionBorder.top || profileSectionBorder.bottom || profileSectionBorder.left || profileSectionBorder.right);
    const profileSectionBorderColor = profileSectionBorder.color || settings.colors.accent;

    const roleFonts = getRoleFonts(settings.typography);
    const headerFontFamilyCss = fontFamilyCssValue(settings.header.fontFamily, "primary");
    const headingFontFamilyCss = fontFamilyCssValue(settings.headings.fontFamily, "primary");
    const FONT_WEIGHT_MAP: Record<string, number> = { normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 };
    const headerWeightRaw = settings.header.fontWeight;
    const headerWeight = /^\d+$/.test(String(headerWeightRaw))
        ? Number(headerWeightRaw)
        : (FONT_WEIGHT_MAP[headerWeightRaw] ?? 700);

    const customFontImports = settings.customFonts.map(f => `@import url('${f.url}');`).join('\n        ');

    const customStyles = useMemo(() => `
        ${customFontImports}
        .resume-document {
            --font-primary: ${roleFontStack("primary", roleFonts)};
            --font-secondary: ${roleFontStack("secondary", roleFonts)};
            --font-mono: ${roleFontStack("mono", roleFonts)};
            font-family: var(--font-secondary);
            font-size: ${settings.typography.fontSize}pt;
            line-height: ${settings.typography.lineHeight};
            color: ${settings.colors.text};
            padding: ${settings.spacing.marginV}mm ${settings.spacing.marginH}mm;
            --resume-name-color: ${nameColor};
            --resume-job-title-color: ${jobTitleColor};
            --resume-heading-color: ${headingColor};
            --resume-heading-line-color: ${headingLineColor};
            --resume-entry-subtitle-color: ${entrySubtitleColor};
            --resume-date-color: ${dateColor};
            --resume-header-icon-color: ${headerIconColor};
            --resume-link-icon-color: ${linkIconColor};
            --resume-marker-color: ${markerColor};
            --resume-list-style: ${settings.entryLayout.listStyle === 'hyphen' ? '"- "' : 'disc'};
        }
        .resume-document h1 {
            color: var(--resume-name-color);
            font-family: ${headerFontFamilyCss};
            font-size: ${scaledHeaderFontSize}px;
            font-weight: ${headerWeight};
            font-style: ${settings.header.fontStyle};
            text-decoration: ${settings.header.textDecoration};
            text-transform: ${settings.header.textTransform || 'none'};
        }
        .resume-document .job-title {
            color: var(--resume-job-title-color);
        }
        .resume-document .heading-style {
            color: var(--resume-heading-color);
            font-family: ${headingFontFamilyCss};
            text-transform: ${settings.headings.capitalization === 'uppercase' ? 'uppercase' : 'capitalize'};
            font-size: ${scaledHeadingFontSize}px;
            font-weight: ${settings.headings.fontWeight ?? '700'};
            font-style: ${settings.headings.fontStyle ?? 'normal'};
            text-decoration: ${settings.headings.textDecoration ?? 'none'};
            text-align: ${(settings.headings as any).textAlign ?? 'left'};
            letter-spacing: ${((settings.headings as any).letterSpacing ?? 0) * typographyScale}px;
            line-height: ${(settings.headings as any).lineHeight ?? 1.15};
            padding-top: ${((settings.headings as any).paddingTop ?? 0) * typographyScale}px;
            padding-bottom: ${((settings.headings as any).paddingBottom ?? 6) * typographyScale}px;
            padding-left: ${((settings.headings as any).paddingLeft ?? 0) * typographyScale}px;
            padding-right: ${((settings.headings as any).paddingRight ?? 0) * typographyScale}px;
            margin-top: ${((settings.headings as any).marginTop ?? 0) * typographyScale}px;
            margin-bottom: ${((settings.headings as any).marginBottom ?? 16) * typographyScale}px;
            margin-left: ${((settings.headings as any).marginLeft ?? 0) * typographyScale}px;
            margin-right: ${((settings.headings as any).marginRight ?? 0) * typographyScale}px;
            ${(() => {
                const border = (settings.headings as any).border;
                const borderColor = (settings.headings as any).borderColor || border?.color || 'var(--resume-heading-line-color)';
                const borderStyle = border?.style ?? 'solid';
                const borderWidth = (border?.width ?? 2) * typographyScale;
                const hasBorder = border ? (border.top || border.bottom || border.left || border.right) : (settings.headings.style === 'baseline');
                if (!hasBorder) return '';
                const lines: string[] = [];
                const bTop = border?.top;
                const bBottom = border?.bottom ?? (settings.headings.style === 'baseline');
                const bLeft = border?.left;
                const bRight = border?.right;

                if (borderStyle === 'solid') {
                    if (bTop) lines.push(`border-top: ${borderWidth}px solid ${borderColor};`);
                    if (bBottom) lines.push(`border-bottom: ${borderWidth}px solid ${borderColor};`);
                    if (bLeft) lines.push(`border-left: ${borderWidth}px solid ${borderColor};`);
                    if (bRight) lines.push(`border-right: ${borderWidth}px solid ${borderColor};`);
                } else {
                    const dl = (border?.dashLength ?? 6) * typographyScale;
                    const dg = (border?.dashGap ?? 4) * typographyScale;
                    const isDotted = borderStyle === 'dotted';
                    const segLen = isDotted ? Math.max(borderWidth, 1) : dl;
                    const cycle = segLen + dg;
                    const bgs: string[] = [];
                    const sizes: string[] = [];
                    const positions: string[] = [];
                    const repeats: string[] = [];
                    if (bTop) {
                        bgs.push(`repeating-linear-gradient(to right, ${borderColor} 0, ${borderColor} ${segLen}px, transparent ${segLen}px, transparent ${cycle}px)`);
                        sizes.push(`100% ${borderWidth}px`);
                        positions.push('left top');
                        repeats.push('no-repeat');
                    }
                    if (bBottom) {
                        bgs.push(`repeating-linear-gradient(to right, ${borderColor} 0, ${borderColor} ${segLen}px, transparent ${segLen}px, transparent ${cycle}px)`);
                        sizes.push(`100% ${borderWidth}px`);
                        positions.push('left bottom');
                        repeats.push('no-repeat');
                    }
                    if (bLeft) {
                        bgs.push(`repeating-linear-gradient(to bottom, ${borderColor} 0, ${borderColor} ${segLen}px, transparent ${segLen}px, transparent ${cycle}px)`);
                        sizes.push(`${borderWidth}px 100%`);
                        positions.push('left top');
                        repeats.push('no-repeat');
                    }
                    if (bRight) {
                        bgs.push(`repeating-linear-gradient(to bottom, ${borderColor} 0, ${borderColor} ${segLen}px, transparent ${segLen}px, transparent ${cycle}px)`);
                        sizes.push(`${borderWidth}px 100%`);
                        positions.push('right top');
                        repeats.push('no-repeat');
                    }
                    if (bgs.length) {
                        lines.push(`background-image: ${bgs.join(', ')};`);
                        lines.push(`background-size: ${sizes.join(', ')};`);
                        lines.push(`background-position: ${positions.join(', ')};`);
                        lines.push(`background-repeat: ${repeats.join(', ')};`);
                    }
                }
                if (border?.radius) lines.push(`border-radius: ${border.radius * typographyScale}px;`);
                return lines.join('\n            ');
            })()}
            ${(settings.headings as any).backgroundColor ? `background-color: ${(settings.headings as any).backgroundColor};` : ''}
        }
        .resume-document .text-sm {
            font-size: ${scaledTextSmSize}px;
            line-height: ${scaledTextSmLineHeight}px;
        }
        .resume-document .text-xs {
            font-size: ${scaledTextXsSize}px;
            line-height: ${scaledTextXsLineHeight}px;
        }
        .resume-document p, .resume-document span {
            color: ${settings.colors.text};
        }
        .resume-document a {
            color: ${settings.colors.text};
            text-decoration: none;
        }
        /* Interactive element selection (editor preview only). Scoped to @media
           screen so it never applies in print/PDF; export capture additionally
           forces it off (see export.ts) so a hovered element can't leak into
           PNG/SVG. */
        @media screen {
            .resume-document [data-nav-section]:hover {
                outline: 2px solid ${settings.colors.accent};
                outline-offset: 3px;
                border-radius: 3px;
                cursor: pointer;
            }
            /* Inline edit fields: Canva/Docs-style focusable "input" boxes. */
            .resume-document [data-editable-field] {
                border-radius: 4px;
                cursor: text;
                transition: box-shadow .12s ease, background-color .12s ease;
                outline: none;
            }
            .resume-document [data-editable-field]:hover {
                background-color: color-mix(in srgb, ${settings.colors.accent} 10%, transparent);
            }
            .resume-document [data-editable-field]:focus,
            .resume-document [data-editable-field]:focus-visible {
                box-shadow: 0 0 0 2px ${settings.colors.accent};
                background-color: color-mix(in srgb, ${settings.colors.accent} 6%, transparent);
            }
            .resume-document [data-editable-field].is-editing {
                box-shadow: 0 0 0 2px ${settings.colors.accent};
                background-color: color-mix(in srgb, ${settings.colors.accent} 5%, transparent);
                cursor: auto;
            }
        }
        .resume-document .date-text {
            color: var(--resume-date-color);
        }
        .resume-document .entry-subtitle {
            color: var(--resume-entry-subtitle-color);
        }
        .resume-document .contact-icon {
            width: 0.85em;
            height: 0.85em;
            display: inline-block;
            vertical-align: -0.1em;
            margin-right: 0.25em;
            opacity: 0.7;
        }
        .resume-document .contact-icon.header-icon {
            color: var(--resume-header-icon-color);
        }
        .resume-document .contact-icon.link-icon {
            color: var(--resume-link-icon-color);
        }
        .resume-document .resume-md ul {
            list-style-type: var(--resume-list-style, disc);
            padding-left: 1.25em;
            margin: 0.25em 0;
        }
        .resume-document .resume-md ol {
            list-style-type: decimal;
            padding-left: 1.25em;
            margin: 0.25em 0;
        }
        .resume-document .resume-md li {
            margin: 0.1em 0;
        }
        .resume-document .resume-md p {
            margin: 0.25em 0;
        }
        .resume-document .resume-md p:first-child {
            margin-top: 0;
        }
        .resume-document .resume-md p:last-child {
            margin-bottom: 0;
        }
        .resume-document .resume-md li::marker,
        .resume-document .list-disc > li::marker,
        .resume-document .list-decimal > li::marker {
            color: var(--resume-marker-color);
        }

        /* --- PDF Export & Print Styles --- */
        @media print {
            @page {
                size: ${paperSize === 'a4' ? 'A4' : 'letter'};
                margin: 0;
            }
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            
            /* Override the inline Zoom scale and Pan translate for pristine native printing */
            .print-exact-scroll-wrapper {
                transform: none !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            .print-exact-page-wrapper {
                transform: none !important;
                margin: 0 !important;
                width: 100% !important;
                height: 100% !important;
                box-shadow: none !important;
            }

            .resume-document {
                width: 100% !important;
                min-height: 100% !important;
                height: 100% !important;
                margin: 0 !important;
                box-shadow: none !important;
                /* Note: We preserve the explicit 'border' since it's a customization feature */
                background-color: white !important;
            }
            /* Prevent awkward page breaks */
            section, .resume-document > div {
                break-inside: avoid;
                page-break-inside: avoid;
            }
            .heading-style {
                page-break-after: avoid;
                break-after: avoid;
            }
        }
    `, [
        settings.typography.fontFamily, settings.typography.fontSize, settings.typography.lineHeight,
        settings.header.fontFamily, settings.header.fontStyle, settings.header.textDecoration,
        settings.header.textTransform, headerWeight, scaledHeaderFontSize,
        settings.headings.fontFamily, settings.headings.capitalization, settings.headings.fontWeight,
        settings.headings.fontStyle, settings.headings.textDecoration, settings.headings.style,
        (settings.headings as any).textAlign, (settings.headings as any).letterSpacing,
        (settings.headings as any).lineHeight, (settings.headings as any).paddingTop,
        (settings.headings as any).paddingBottom, (settings.headings as any).paddingLeft,
        (settings.headings as any).paddingRight, (settings.headings as any).marginTop,
        (settings.headings as any).marginBottom, (settings.headings as any).marginLeft,
        (settings.headings as any).marginRight,
        (settings.headings as any).backgroundColor,
        (settings.headings as any).borderColor,
        JSON.stringify((settings.headings as any).border),
        scaledHeadingFontSize, typographyScale,
        settings.colors.text, settings.colors.accent, settings.colors.variant, settings.colors.background,
        nameColor, jobTitleColor, headingColor, headingLineColor,
        entrySubtitleColor, dateColor, headerIconColor, linkIconColor, markerColor,
        customFontImports, headerFontFamilyCss, headingFontFamilyCss,
        roleFonts.primary, roleFonts.secondary, roleFonts.mono,
        paperSize, settings.spacing.marginH, settings.spacing.marginV,
        settings.linkIcon.side, settings.linkIcon.size,
        settings.headerIcon.side, settings.headerIcon.size,
    ]);

    const scopedStyles = useMemo(() => {
        const scopedDocumentStyles = customStyles.replace(/\.resume-document/g, `${scopeSelector} .resume-document`);

        return scopedDocumentStyles.replace(/(^|[\s,{])\.heading-style/g, (match: string, prefix: string, offset: number, source: string) => {
            const selectorStart = offset + prefix.length;
            const priorSelector = source.slice(
                Math.max(0, selectorStart - ".resume-document ".length),
                selectorStart
            );

            if (priorSelector === ".resume-document ") return match;
            return `${prefix}${scopeSelector} .heading-style`;
        });
    }, [customStyles, scopeSelector]);

    const optionalDetailDefs: Record<string, { label: string; icon: LucideIcon }> = {
        dateOfBirth: { label: cvLabels.dateOfBirth, icon: CalendarDays },
        nationality: { label: cvLabels.nationality, icon: Flag },
        drivingLicense: { label: cvLabels.drivingLicense, icon: Car },
        passportOrId: { label: cvLabels.passportOrId, icon: CreditCard },
        passport: { label: cvLabels.passport, icon: CreditCard },
        nationalId: { label: cvLabels.nationalId, icon: CreditCard },
        maritalStatus: { label: cvLabels.maritalStatus, icon: Heart },
        militaryService: { label: cvLabels.militaryService, icon: ShieldCheck },
        genderPronoun: { label: cvLabels.genderPronoun, icon: UserRound },
        disability: { label: cvLabels.disability, icon: Accessibility },
        visa: { label: cvLabels.visa, icon: Plane },
        height: { label: cvLabels.height, icon: Ruler },
    };

    type ContactItem = {
        icon: IconComponent;
        text: React.ReactNode;
        href?: string;
        accentTarget: "headerIcons" | "linkIcons";
    };
    const detailMap: Record<string, ContactItem | ContactItem[]> = {};
    if (emailEntries.length > 0) {
        detailMap["field:email"] = emailEntries.map((entry) => ({
            icon: Mail,
            text: (
                <span className="inline-flex min-w-0 flex-wrap items-baseline gap-1.5">
                    {entry.label ? (
                        <span className="rounded border border-current/20 px-1 py-0.5 text-[0.72em] font-semibold leading-none opacity-70">
                            {entry.label}
                        </span>
                    ) : null}
                    <span className="break-all">{entry.email}</span>
                </span>
            ),
            href: `mailto:${entry.email}`,
            accentTarget: "headerIcons",
        }));
    }
    if (phone) {
        const phoneList = parsePhones(String(phone));
        const mode = (resume.settings?.phoneDisplay ?? "both") as CountryDisplayMode;
        const showFlag = shouldShowFlag(mode);
        const showText = shouldShowText(mode);
        if (phoneList.length === 0) {
            detailMap["field:phone"] = { icon: Phone, text: phone, href: `tel:${phone}`, accentTarget: "headerIcons" };
        } else {
            const resolved = phoneList.map((p) => {
                try {
                    const parsed = parsePhoneNumber(p);
                    const cca2 = parsed?.country ?? "";
                    const tok = cca2 ? (lookupCountry(cca2) ?? { cca2, name: cca2 }) : undefined;
                    return {
                        e164: p,
                        cca2: tok?.cca2 ?? "",
                        countryName: tok?.name ?? "",
                        national: parsed?.formatNational() ?? p,
                    };
                } catch {
                    return { e164: p, cca2: "", countryName: "", national: p };
                }
            });
            const node = (
                <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    {resolved.map((d, i) => (
                        <span key={`${d.e164}-${i}`} className="inline-flex items-center gap-1" title={d.countryName}>
                            {showFlag && d.cca2 && (
                                <CountryFlag cca2={d.cca2} name={d.countryName} className="h-3.5 w-5 rounded-[2px]" />
                            )}
                            {showText && (d.countryName || d.cca2) && (
                                <span>{countryDisplayText({ cca2: d.cca2, name: d.countryName }, mode)}</span>
                            )}
                            <span>{d.national}</span>
                            {i < resolved.length - 1 ? <span>·</span> : null}
                        </span>
                    ))}
                </span>
            );
            detailMap["field:phone"] = {
                icon: Phone,
                text: node,
                href: resolved.length === 1 ? `tel:${resolved[0].e164}` : undefined,
                accentTarget: "headerIcons",
            };
        }
    }
    if (location) detailMap["field:location"] = { icon: MapPin, text: location, accentTarget: "headerIcons" };
    if (website) detailMap["field:website"] = { icon: Globe, text: website, href: resolveExternalHref(website), accentTarget: "linkIcons" };
    if (linkedin) detailMap["field:linkedin"] = { icon: Linkedin, text: "LinkedIn", href: resolveExternalHref(linkedin), accentTarget: "linkIcons" };
    if (github) detailMap["field:github"] = { icon: Github, text: "GitHub", href: resolveExternalHref(github), accentTarget: "linkIcons" };

    for (const [id, def] of Object.entries(optionalDetailDefs)) {
        const value = (resume.basics as any)[id];
        if (!value) continue;
        if (id === "disability") {
            const rendered = renderDisability(String(value), resume.settings?.language ?? "en");
            if (!rendered) continue;
            detailMap[`field:${id}`] = { icon: def.icon, text: `${def.label}: ${rendered}`, accentTarget: "headerIcons" };
            continue;
        }
        if (id === "maritalStatus") {
            if (isHiddenMaritalStatus(String(value))) continue;
            const display = isMaritalStatusKey(String(value))
                ? getMaritalStatusLabel(String(value), resume.settings?.language ?? "en")
                : String(value);
            detailMap[`field:${id}`] = { icon: def.icon, text: `${def.label}: ${display}`, accentTarget: "headerIcons" };
            continue;
        }
        if (id === "nationality") {
            const mode = (resume.settings?.nationalityDisplay ?? "both") as CountryDisplayMode;
            const tokens = parseCountryTokens(String(value));
            const showFlag = shouldShowFlag(mode);
            const showText = shouldShowText(mode);
            const node = (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span>{def.label}:</span>
                    {tokens.map((tok, i) => (
                        <span
                            key={`${tok.cca2 || tok.name}-${i}`}
                            className="inline-flex items-center gap-1"
                            title={tok.name}
                        >
                            {showFlag && tok.cca2 && (
                                <CountryFlag cca2={tok.cca2} name={tok.name} className="h-3.5 w-5 rounded-[2px]" />
                            )}
                            {showText && (
                                <span>
                                    {countryDisplayText(tok, mode, {
                                        nameStyle: resume.settings?.nationalityNameStyle ?? "country",
                                        language: resume.settings?.language ?? "en",
                                    })}
                                </span>
                            )}
                            {i < tokens.length - 1 && showText ? "," : null}
                        </span>
                    ))}
                </span>
            );
            detailMap[`field:${id}`] = { icon: def.icon, text: node, accentTarget: "headerIcons" };
            continue;
        }
        if (id === "passportOrId") {
            const { country, number } = parsePassportId(String(value));
            const tok = country ? parseCountryTokens(country)[0] : undefined;
            const node = (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span>{def.label}:</span>
                    {tok?.cca2 && (
                        <CountryFlag cca2={tok.cca2} name={tok.name} className="h-3.5 w-5 rounded-[2px]" />
                    )}
                    {number && <span>{number}</span>}
                </span>
            );
            detailMap[`field:${id}`] = { icon: def.icon, text: node, accentTarget: "headerIcons" };
            continue;
        }
        if (id === "passport" || id === "nationalId" || id === "visa" || id === "militaryService") {
            const settingKey =
                id === "passport"
                    ? resume.settings?.passportDisplay
                    : id === "nationalId"
                    ? resume.settings?.nationalIdDisplay
                    : id === "visa"
                    ? resume.settings?.visaDisplay
                    : resume.settings?.militaryServiceDisplay;
            const mode = (settingKey ?? "both") as CountryDisplayMode;
            const showFlag = shouldShowFlag(mode);
            const showText = shouldShowText(mode);
            const docs = parseDocuments(String(value));
            const resolved = docs.map((d) => {
                const tok = d.country ? parseCountryTokens(d.country)[0] : undefined;
                return { cca2: tok?.cca2 ?? "", name: tok?.name ?? d.country, number: d.number };
            });
            const node = (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span>{def.label}:</span>
                    {resolved.map((d, i) => {
                        const text = showText ? countryDisplayText(d, mode) : "";
                        return (
                            <span key={`${d.cca2 || d.name || "x"}-${i}`} className="inline-flex items-center gap-1" title={d.name}>
                                {showFlag && d.cca2 && (
                                    <CountryFlag cca2={d.cca2} name={d.name} className="h-3.5 w-5 rounded-[2px]" />
                                )}
                                {text && <span>{text}</span>}
                                {d.number && (
                                    <span className={text ? "ml-0.5" : ""}>
                                        {text ? `(${d.number})` : d.number}
                                    </span>
                                )}
                                {i < resolved.length - 1 ? ";" : null}
                            </span>
                        );
                    })}
                </span>
            );
            detailMap[`field:${id}`] = { icon: def.icon, text: node, accentTarget: "headerIcons" };
            continue;
        }
        if (id === "drivingLicense") {
            const mode = (resume.settings?.licenseDisplay ?? "both") as CountryDisplayMode;
            const showFlag = shouldShowFlag(mode);
            const showText = shouldShowText(mode);
            const entries = parseLicenses(String(value));
            const resolved = entries.map((e) => {
                const country = parseCountryTokens(e.country)[0] ?? { cca2: "", name: e.country };
                return { ...country, classes: e.classes };
            });
            const node = (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span>{def.label}:</span>
                    {resolved.map((e, i) => {
                        const text = showText ? countryDisplayText(e, mode) : "";
                        return (
                            <span
                                key={`${e.cca2 || e.name || "x"}-${i}`}
                                className="inline-flex items-center gap-1"
                                title={e.name}
                            >
                                {showFlag && e.cca2 && (
                                    <CountryFlag cca2={e.cca2} name={e.name} className="h-3.5 w-5 rounded-[2px]" />
                                )}
                                {text && <span>{text}</span>}
                                {e.classes.length > 0 && (
                                    <span className={text ? "ml-0.5" : ""}>
                                        {text ? `(${e.classes.join(", ")})` : e.classes.join(", ")}
                                    </span>
                                )}
                                {i < resolved.length - 1 ? ";" : null}
                            </span>
                        );
                    })}
                </span>
            );
            detailMap[`field:${id}`] = { icon: def.icon, text: node, accentTarget: "headerIcons" };
            continue;
        }
        const displayValue = id === "dateOfBirth" ? formatResumeDate(String(value)) : value;
        detailMap[`field:${id}`] = { icon: def.icon, text: `${def.label}: ${displayValue}`, accentTarget: "headerIcons" };
    }

    for (const link of (resume.basics.customLinks || [])) {
        if (!link.url) continue;
        const Icon = getCustomLinkIcon(link.name, (link as any).icon);
        const displayText = link.label || link.name;
        detailMap[`custom:${link.id}`] = {
            icon: Icon,
            text: displayText,
            href: resolveExternalHref(link.url),
            accentTarget: "linkIcons",
        };
    }

    const storedOrder = ((resume.basics as any).detailsOrder || []) as string[];
    const orderedKeys = [
        ...storedOrder.filter(key => !!detailMap[key]),
        ...Object.keys(detailMap).filter(key => !storedOrder.includes(key)),
    ];
    const contactItems = orderedKeys.flatMap((key) => {
        const item = detailMap[key];
        return Array.isArray(item) ? item : [item];
    });

    const renderContactItems = () => {
        if (contactItems.length === 0) return null;
        const headerLinkIconSize = `${settings.headerIcon.size}em`;
        const headerLinkIconSide = settings.headerIcon.side;

        const renderItem = (item: typeof contactItems[number], index: number) => {
            const IconComp = item.icon;
            const linkIndicator = item.href && headerLinkIconSide !== "hidden" ? (
                <Link className="link-icon shrink-0 opacity-50" style={{ width: headerLinkIconSize, height: headerLinkIconSize }} />
            ) : null;
            const content = (
                <>
                    {headerLinkIconSide === "left" && linkIndicator}
                    <IconComp className={`contact-icon ${item.accentTarget === "linkIcons" ? "link-icon" : "header-icon"}`} />
                    <span className="min-w-0 break-words">{item.text}</span>
                    {headerLinkIconSide === "right" && linkIndicator}
                </>
            );

            const sharedClass = `flex min-w-0 ${headerIconAlignClass} gap-0.5`;

            return item.href ? (
                <a
                    key={index}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${sharedClass} hover:opacity-100`}
                >
                    {content}
                </a>
            ) : (
                <span key={index} className={sharedClass}>
                    {content}
                </span>
            );
        };

        if (contactLayout === "rows") {
            return (
                <div data-testid="resume-preview-contact-items" data-layout="rows" data-nav-section="basics" data-nav-kind="heading" className={`flex flex-col gap-1 text-sm opacity-80 ${contentAlignClass}`}>
                    {contactItems.map(renderItem)}
                </div>
            );
        }

        if (contactLayout === "twoColumns") {
            return (
                <div data-testid="resume-preview-contact-items" data-layout="twoColumns" data-nav-section="basics" data-nav-kind="heading" className={`grid grid-cols-2 gap-x-4 gap-y-1 text-sm opacity-80 ${contactGridAlignClass}`}>
                    {contactItems.map(renderItem)}
                </div>
            );
        }

        return (
            <div data-testid="resume-preview-contact-items" data-layout="wrap" data-nav-section="basics" data-nav-kind="heading" className={`flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-80 ${contactJustifyClass}`}>
                {contactItems.map(renderItem)}
            </div>
        );
    };

    const renderProfilePhoto = () => {
        if (!hasProfilePhoto) return null;

        const photoBorder = profilePhotoSettings.border ?? defaultSettings.personalDetails.photo.border;
        const photoBorderColor = photoBorder.color || profileImageBorderColor;
        const photoMarginStyle: CSSProperties = {
            marginTop: `${(profilePhotoSettings.marginTop ?? 0) * typographyScale}px`,
            marginRight: `${(profilePhotoSettings.marginRight ?? 0) * typographyScale}px`,
            marginBottom: `${(profilePhotoSettings.marginBottom ?? 0) * typographyScale}px`,
            marginLeft: `${(profilePhotoSettings.marginLeft ?? 0) * typographyScale}px`,
        };
        const photoFrameStyle: CSSProperties = {
            ...buildBoxBorderStyles(photoBorder, photoBorderColor),
            paddingTop: `${(profilePhotoSettings.paddingTop ?? 0) * typographyScale}px`,
            paddingRight: `${(profilePhotoSettings.paddingRight ?? 0) * typographyScale}px`,
            paddingBottom: `${(profilePhotoSettings.paddingBottom ?? 0) * typographyScale}px`,
            paddingLeft: `${(profilePhotoSettings.paddingLeft ?? 0) * typographyScale}px`,
            backgroundColor: "#ffffff",
            boxSizing: "border-box",
        };

        return (
            <div
                data-testid="resume-preview-photo"
                data-nav-section="basics"
                data-nav-kind="heading"
                className="shrink-0"
                style={photoMarginStyle}
            >
                <div
                    data-testid="resume-preview-photo-frame"
                    className="overflow-hidden bg-white shadow-sm"
                    style={photoFrameStyle}
                >
                    <div
                        data-testid="resume-preview-photo-size"
                        style={{
                            width: resolvedProfilePhotoWidth,
                            height: resolvedProfilePhotoHeight,
                        }}
                    >
                        <img
                            data-testid="resume-preview-photo-image"
                            src={resume.basics.photo}
                            alt={t("preview.profilePhoto", { name: name || cvLabels.yourName })}
                            className="h-full w-full object-cover"
                            style={{ filter: profilePhotoFilterValue }}
                        />
                    </div>
                </div>
            </div>
        );
    };

    const getSectionHeadingStyle = (sectionKey: string): CSSProperties => {
        const scoped = getScopedSettings(sectionKey);
        const heading = scoped.headings;
        const border = heading.border ?? defaultSettings.headings.border;
        const borderColor = heading.borderColor || border.color || headingLineColor;

        return {
            ...buildBoxBorderStyles(border as BoxBorderSettings, borderColor),
            backgroundColor: heading.backgroundColor || undefined,
            fontFamily: fontFamilyCssValue(heading.fontFamily, "primary"),
            fontSize: `${(heading.fontSize ?? 14) * typographyScale}px`,
            fontWeight: heading.fontWeight ?? "700",
            fontStyle: heading.fontStyle ?? "normal",
            textDecoration: heading.textDecoration ?? "none",
            textTransform: heading.capitalization === "uppercase" ? "uppercase" : "capitalize",
            textAlign: heading.textAlign ?? "left",
            letterSpacing: `${(heading.letterSpacing ?? 0) * typographyScale}px`,
            lineHeight: heading.lineHeight ?? 1.15,
            paddingTop: `${(heading.paddingTop ?? 0) * typographyScale}px`,
            paddingBottom: `${(heading.paddingBottom ?? 6) * typographyScale}px`,
            paddingLeft: `${(heading.paddingLeft ?? 0) * typographyScale}px`,
            paddingRight: `${(heading.paddingRight ?? 0) * typographyScale}px`,
            marginTop: `${(heading.marginTop ?? 0) * typographyScale}px`,
            marginBottom: `${(heading.marginBottom ?? 16) * typographyScale}px`,
            marginLeft: `${(heading.marginLeft ?? 0) * typographyScale}px`,
            marginRight: `${(heading.marginRight ?? 0) * typographyScale}px`,
        };
    };

    const renderSectionHeading = (base: PreviewSectionKey, fallback: string) => {
        const sectionKey = base.includes(":") ? base : getConfiguredSectionKey(base);
        const scoped = getScopedSettings(sectionKey);
        const SectionIcon = getSectionHeadingIcon(base);
        const textAlign = scoped.headings.textAlign ?? "left";
        const justifyClass = textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start';
        return (
            <div data-preview-section-heading={sectionKey}>
                <h2
                    className={`heading-style flex items-center gap-2 ${justifyClass}`}
                    style={getSectionHeadingStyle(sectionKey)}
                >
                    {SectionIcon ? <SectionIcon className="w-4 h-4 opacity-80" /> : null}
                    {getSectionHeading(base, fallback)}
                </h2>
            </div>
        );
    };

    const renderSummarySection = (layout: "standalone" | "profile") => {
        if (!summary) return null;

        const trailingGap = layout === "standalone" ? layoutSectionGap : 0;

        return (
            <section
                data-testid="resume-preview-summary"
                data-preview-section="summary"
                data-summary-layout={layout}
                style={{ marginBottom: `${trailingGap}px` }}
            >
                <h2 className="heading-style" style={getSectionHeadingStyle("summary")}>{cvLabels.summary}</h2>
                {/* Markdown like entry descriptions, and double-click editable in the live preview. */}
                <div className="leading-relaxed opacity-90" data-testid="resume-preview-summary-body">
                    <InlineField
                        mode="rich"
                        // The editor reads Markdown, where a single line break is a space:
                        // hand it hard breaks and store plain line breaks again.
                        value={preserveLineBreaks(summary)}
                        onCommit={(md) => updateBasics({ summary: fromHardBreaks(md) })}
                        staticRender={(
                            <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{preserveLineBreaks(summary)}</ReactMarkdown>
                        )}
                    />
                </div>
            </section>
        );
    };

    const renderLayoutSeparator = (key: string) => (
        <div key={key} className="py-2.5">
            <hr
                style={{
                    border: "none",
                    borderTop: `1px solid ${headingLineColor}`,
                    opacity: 0.35,
                }}
            />
        </div>
    );

    const renderLayoutVerticalSeparator = (key: string) => (
        <div key={key} className="py-2.5 flex justify-center" data-layout-vertical-separator>
            <div
                style={{
                    width: separatorLineThickness,
                    height: 48,
                    backgroundColor: headingLineColor,
                    opacity: 0.45,
                }}
            />
        </div>
    );

    const renderFullSection = (section: PreviewSection) => (
        <section>
            {section.headingNode}
            {section.entryNodes.map((entryNode, index) => (
                <div key={`${section.key}:entry-fragment:${index}`} style={{ display: "flow-root" }}>
                    {entryNode}
                </div>
            ))}
        </section>
    );

    const renderPairedSections = (key: string, leftSection: PreviewSection, rightSection: PreviewSection) => (
        <div
            key={key}
            data-layout-section-pair
            style={{
                display: "grid",
                gridTemplateColumns: `${pairedLeftColumnWidth}px ${separatorLineThickness}px ${pairedRightColumnWidth}px`,
                alignItems: "stretch",
                width: layoutContentWidth,
                maxWidth: "100%",
            }}
        >
            <div style={{ minWidth: 0 }}>
                {renderFullSection(leftSection)}
            </div>
            <div
                data-layout-vertical-separator
                style={{
                    display: "flex",
                    alignSelf: "stretch",
                    justifyContent: "center",
                }}
            >
                <div
                    style={{
                        width: separatorLineThickness,
                        flex: 1,
                        backgroundColor: headingLineColor,
                        opacity: 0.45,
                    }}
                />
            </div>
            <div style={{ minWidth: 0 }}>
                {renderFullSection(rightSection)}
            </div>
        </div>
    );

    const flexAlignClass = (align: string | undefined) => {
        switch (align) {
            case "top": return "items-start";
            case "center": return "items-center";
            case "bottom": return "items-end";
            case "baseline": return "items-baseline";
            default: return "items-baseline";
        }
    };

    const linkIconAlignClass = flexAlignClass(settings.linkIcon.align);
    const headerIconAlignClass = flexAlignClass(settings.headerIcon.align);

    const renderEntrySubtitle = (text?: string, url?: string, urlIcon?: string, sectionKey = "") => {
        const scoped = sectionKey ? getScopedSettings(sectionKey) : settings;
        const scopedLinkIconAlignClass = flexAlignClass(scoped.linkIcon.align);
        if (!text) return null;
        if (url) {
            const IconComp = urlIcon && urlIcon !== "auto"
                ? (CUSTOM_ICON_LUCIDE_MAP[urlIcon] || Link)
                : Link;
            const iconSize = `${scoped.linkIcon.size}em`;
            const iconNode = <IconComp className="link-icon shrink-0" style={{ width: iconSize, height: iconSize }} />;
            return (
                <a href={resolveExternalHref(url)} target="_blank" rel="noopener noreferrer" className={`entry-subtitle opacity-80 text-sm hover:opacity-100 inline-flex ${scopedLinkIconAlignClass} gap-1 ${scoped.linkIcon.side === "right" ? "flex-row-reverse" : ""}`}>
                    {iconNode}
                    {text}
                </a>
            );
        }

        return <span className="entry-subtitle opacity-80 text-sm">{text}</span>;
    };

    // Project name with its optional icon and, when Customize asks for it, the
    // GitHub repository visibility in the CV's language.
    const renderProjectTitle = (proj: any): React.ReactNode => {
        const ProjectIcon = proj.icon ? getCustomLinkIcon(proj.name || "", proj.icon) : null;
        const visibility = projectsStyle.repoBadge.showVisibility && proj.visibility && isGithubProject(proj) ? proj.visibility : "";
        if (!ProjectIcon && !visibility) return proj.name || "";
        return (
            <span className="inline-flex flex-wrap items-center gap-x-[0.4em] gap-y-0.5">
                {ProjectIcon && (
                    <ProjectIcon data-testid="project-icon" aria-hidden="true" className="h-[1em] w-[1em] shrink-0" style={{ color: projectsStyle.colors.accent }} />
                )}
                <span>{proj.name || ""}</span>
                {visibility && (
                    <span
                        data-testid="project-visibility"
                        className="rounded-full border border-current px-[0.55em] text-[0.62em] font-medium uppercase leading-[1.6] tracking-wide opacity-60"
                    >
                        {visibility === "private" ? cvLabels.repoPrivate : cvLabels.repoPublic}
                    </span>
                )}
            </span>
        );
    };

    const linkIconSize = `${settings.linkIcon.size}em`;
    const markdownComponents = {
        a: ({ href, children, ...props }: any) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex ${linkIconAlignClass} gap-0.5 ${settings.linkIcon.side === "right" ? "flex-row-reverse" : ""}`} {...props}>
                <Link className="link-icon shrink-0" style={{ width: linkIconSize, height: linkIconSize }} />
                {children}
            </a>
        ),
    };

    const renderDeclarationEntry = (declaration: any, key: string) => {
        const sectionKey = getConfiguredSectionKey("declaration");
        const scoped = getScopedSettings(sectionKey);
        return (
        <div key={key} data-testid="resume-entry" style={{ ...getEntryWrapperStyle(sectionKey) }}>
            {declaration.text && (
                <div className="opacity-90 text-sm leading-relaxed resume-md mb-3">
                    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{declaration.text}</ReactMarkdown>
                </div>
            )}
            {declaration.signature && (
                <img
                    src={declaration.signature}
                    alt="Signature"
                    className="mb-1"
                    style={{ maxHeight: 64, maxWidth: "60%", objectFit: "contain" }}
                />
            )}
            {(declaration.fullName || declaration.place || declaration.date) && (
                <div>
                    {declaration.fullName && (
                        <div className="font-semibold" style={{ fontSize: `${scoped.entryLayout.titleFontSize}pt` }}>{declaration.fullName}</div>
                    )}
                    {(declaration.place || declaration.date) && (
                        <div className="opacity-70 text-xs mt-0.5">{[declaration.place, declaration.date].filter(Boolean).join(" · ")}</div>
                    )}
                </div>
            )}
        </div>
        );
    };

    const getEntryWrapperStyle = (sectionKey = ""): CSSProperties => {
        const scoped = sectionKey ? getScopedSettings(sectionKey) : settings;
        const contentStyle = scoped.contentStyle;
        const entryBorder = contentStyle.border ?? defaultSettings.contentStyle.border;
        const entryBorderColor = entryBorder.color || scoped.colors.accent;

        return {
            ...buildBoxBorderStyles(entryBorder, entryBorderColor),
            backgroundColor: contentStyle.backgroundColor || undefined,
            paddingTop: `${(contentStyle.paddingTop ?? 0) * typographyScale}px`,
            paddingBottom: `${(contentStyle.paddingBottom ?? 0) * typographyScale}px`,
            paddingLeft: `${(contentStyle.paddingLeft ?? 0) * typographyScale}px`,
            paddingRight: `${(contentStyle.paddingRight ?? 0) * typographyScale}px`,
            marginTop: `${(contentStyle.marginTop ?? 0) * typographyScale}px`,
            marginRight: `${(contentStyle.marginRight ?? 0) * typographyScale}px`,
            marginBottom: `${scoped.spacing.itemSpacing + ((contentStyle.marginBottom ?? 0) * typographyScale)}px`,
            marginLeft: `${(contentStyle.marginLeft ?? 0) * typographyScale}px`,
            boxSizing: "border-box",
        };
    };

    // Renders an entry's "skills used" (plain strings) as name-only badges,
    // reusing the Skills-section chip look. Returns null when the feature is off
    // or the entry has no skills. Non-exclusive with the Skills section.
    const renderEntrySkillBadges = (entryLayout: typeof settings.entryLayout, entrySkills?: string[]) => {
        if (!(entryLayout as any).showEntrySkills) return null;
        const list = (entrySkills || []).map((s) => s.trim()).filter(Boolean);
        if (list.length === 0) return null;
        return (
            <div data-testid="resume-entry-skills" className="flex flex-wrap gap-2 mt-2">
                {list.map((skill, i) => (
                    <span
                        key={`${skill}-${i}`}
                        data-testid="resume-entry-skill"
                        className="inline-flex items-center gap-1.5 rounded-md border border-current/15 px-2 py-1 text-[0.9em] leading-none"
                    >
                        <span className="font-medium">{skill}</span>
                    </span>
                ))}
            </div>
        );
    };

    const renderEntry = (
        title: React.ReactNode,
        subtitleNode: React.ReactNode,
        date: React.ReactNode,
        location: React.ReactNode,
        bodyContent: React.ReactNode,
        wrapperStyleOverride?: CSSProperties,
        contentAlign?: "left" | "center" | "right",
        entrySkills?: string[],
        sectionKey = "",
    ) => {
        const scoped = sectionKey ? getScopedSettings(sectionKey) : settings;
        const entryLayout = scoped.entryLayout;
        const { layout, leftWidth, middleWidth, rightWidth, titleFontSize, subtitleFontSize, subtitleFontWeight, subtitleFontStyle, subtitleTextDecoration, subtitlePlacement, indentBody } = entryLayout;
        const skillBadges = renderEntrySkillBadges(entryLayout, entrySkills);
        const underSubtitleBadges = (entryLayout as any).entrySkillsPlacement === "underSubtitle" ? skillBadges : null;
        const belowBodyBadges = (entryLayout as any).entrySkillsPlacement === "underSubtitle" ? null : skillBadges;
        const entryWrapperStyle = {
            ...getEntryWrapperStyle(sectionKey),
            ...(contentAlign && contentAlign !== "left" ? { textAlign: contentAlign } : {}),
            ...wrapperStyleOverride,
        };
        const alignItemsClass = contentAlign === "center" ? "items-center" : contentAlign === "right" ? "items-end" : "items-start";
        const sameLineJustifyClass = contentAlign === "center" ? "justify-center" : contentAlign === "right" ? "justify-end" : "";

        const TitleSubtitleNode = (
            <div className={`flex ${subtitlePlacement === 'sameLine' ? `items-baseline gap-2 ${sameLineJustifyClass}` : `flex-col ${alignItemsClass} gap-0.5`}`}>
                <span className="font-semibold" style={{ fontSize: `${titleFontSize}pt` }}>{title}</span>
                {subtitleNode && (
                    <div style={{
                        fontSize: `${subtitleFontSize}pt`,
                        fontWeight: subtitleFontWeight,
                        fontStyle: subtitleFontStyle,
                        textDecoration: subtitleTextDecoration !== 'none' ? subtitleTextDecoration : undefined
                    }}>
                        {subtitleNode}
                    </div>
                )}
            </div>
        );

        const BodyNode = bodyContent ? (
            <div className={`mt-1 opacity-90 text-sm leading-relaxed resume-md ${indentBody ? 'pl-4' : ''}`}>
                {bodyContent}
            </div>
        ) : null;

        const hasSideContent = Boolean(date || location);
        const effectiveLayout = hasSideContent ? layout : 'singleCol';

        if (effectiveLayout === 'contentRight') {
            return (
                <div data-testid="resume-entry" style={{ ...entryWrapperStyle, display: 'grid', gridTemplateColumns: `${leftWidth}fr ${100 - leftWidth}fr`, gap: '1rem' }}>
                    <div className="text-right">
                        {date && <div className="date-text text-xs opacity-60">{date}</div>}
                        {location && <div className="text-xs opacity-60 mt-0.5">{location}</div>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        {TitleSubtitleNode}
                        {underSubtitleBadges}
                        {BodyNode}
                        {belowBodyBadges}
                    </div>
                </div>
            );
        } else if (effectiveLayout === 'contentLeft') {
            return (
                <div data-testid="resume-entry" style={{ ...entryWrapperStyle, display: 'grid', gridTemplateColumns: `${leftWidth}fr ${100 - leftWidth}fr`, gap: '1rem' }}>
                    <div style={{ minWidth: 0 }}>
                        {TitleSubtitleNode}
                        {underSubtitleBadges}
                        {BodyNode}
                        {belowBodyBadges}
                    </div>
                    <div className="text-right">
                        {date && <div className="date-text text-xs opacity-60">{date}</div>}
                        {location && <div className="text-xs opacity-60 mt-0.5">{location}</div>}
                    </div>
                </div>
            );
        } else if (effectiveLayout === 'threeCol') {
            return (
                <div data-testid="resume-entry" style={{ ...entryWrapperStyle, display: 'grid', gridTemplateColumns: `${leftWidth}fr ${middleWidth}fr ${rightWidth}fr`, gap: '1rem' }}>
                    <div>
                        {date && <div className="date-text text-xs opacity-60">{date}</div>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        {TitleSubtitleNode}
                        {underSubtitleBadges}
                        {BodyNode}
                        {belowBodyBadges}
                    </div>
                    <div className="text-right">
                        {location && <div className="text-xs opacity-60">{location}</div>}
                    </div>
                </div>
            );
        } else {
            // singleCol
            return (
                <div data-testid="resume-entry" style={entryWrapperStyle}>
                    <div className="flex flex-col mb-0.5 gap-0.5">
                        {TitleSubtitleNode}
                        {hasSideContent && (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs opacity-60">
                                {date && <span className="date-text">{date}</span>}
                                {date && location && <span>•</span>}
                                {location && <span>{location}</span>}
                            </div>
                        )}
                    </div>
                    {underSubtitleBadges}
                    {BodyNode}
                    {belowBodyBadges}
                </div>
            );
        }
    };

    const getLanguageAssessment = (lang: any) => {
        if (isNativeLanguageFluency(lang.fluency || "")) {
            return null;
        }
        const assessmentType = lang.assessmentType || "none";
        if (assessmentType === "issuer") {
            return {
                text: lang.issuer
                    ? `${cvLabels.languageIssuerAssessed}: ${lang.issuer}`
                    : cvLabels.languageIssuerAssessed,
                id: lang.assessmentId || "",
                url: lang.assessmentUrl || "",
            };
        }
        if (assessmentType === "self") {
            return {
                text: cvLabels.languageSelfAssessed,
                id: "",
                url: "",
            };
        }
        return null;
    };

    const renderLanguageAssessment = (lang: any) => {
        const assessment = getLanguageAssessment(lang);
        if (!assessment) return null;

        const assessmentLabel = assessment.url ? (
            <a
                href={resolveExternalHref(assessment.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-baseline gap-1 hover:opacity-100"
            >
                <Link className="link-icon h-[0.9em] w-[0.9em] shrink-0" />
                {assessment.text}
            </a>
        ) : (
            <span>{assessment.text}</span>
        );

        return (
            <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                {assessmentLabel}
                {assessment.id && (
                    <span>{formatCvText(cvLabels.languageAssessmentIdValue, { id: assessment.id })}</span>
                )}
            </span>
        );
    };

    const renderLanguageFluency = (fluency: string) => {
        if (!fluency || languagesStyle.fluencyDisplay === "hidden") return null;
        const fluencyStyle: CSSProperties = { fontSize: `${languagesStyle.fluencySize ?? 0.85}em` };
        return languagesStyle.fluencyDisplay === "text" ? (
            <span className="opacity-75" style={fluencyStyle}>({fluency})</span>
        ) : (
            <span className="rounded-sm border border-current/20 px-1.5 py-0.5 font-semibold" style={fluencyStyle}>
                {fluency}
            </span>
        );
    };

    const renderLanguageEntry = (lang: any, index: number, wrapperStyleOverride?: CSSProperties) => {
        const assessmentNode = renderLanguageAssessment(lang);
        const fluencyNode = renderLanguageFluency(lang.fluency);
        const languageName = lang.language || `${languagesLabel} ${index + 1}`;
        // Same-line placement pulls fluency AND assessment up next to the name;
        // the row wraps only when it runs out of horizontal space.
        const inlineDetails = languagesStyle.fluencyPlacement === "sameLine" && Boolean(fluencyNode || assessmentNode);

        const titleNode = inlineDetails ? (
            <span data-testid="resume-language-inline" className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                {languagesStyle.fluencyOrder === "fluencyFirst" ? (
                    <>
                        {fluencyNode}
                        <span>{languageName}</span>
                    </>
                ) : (
                    <>
                        <span>{languageName}</span>
                        {fluencyNode}
                    </>
                )}
                {assessmentNode && (
                    <span className="entry-subtitle font-normal opacity-80 text-sm">{assessmentNode}</span>
                )}
            </span>
        ) : languageName;

        const subtitleNode = !inlineDetails && (fluencyNode || assessmentNode) ? (
            <span className="entry-subtitle inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 opacity-80 text-sm">
                {fluencyNode}
                {assessmentNode}
            </span>
        ) : null;

        return renderEntry(
            titleNode,
            subtitleNode,
            null,
            null,
            lang.description ? (
                <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{lang.description}</ReactMarkdown>
            ) : null,
            wrapperStyleOverride,
            languagesStyle.textAlign ?? "left",
            undefined,
            "languages",
        );
    };

    const scopedLanguagesSettings = getScopedSettings("languages");
    const languageEntrySpacingOverride: CSSProperties | undefined = languageEntrySpacing == null
        ? undefined
        : { marginBottom: `${languageEntrySpacing + ((scopedLanguagesSettings.contentStyle.marginBottom ?? 0) * typographyScale)}px` };

    // Multi-column list renders as one grid block (like the table) instead of per-entry blocks.
    // Each cell keeps the regular entry styling, so the outer div is only a spacer.
    const renderLanguageGrid = (languages: any[]) => (
        <div
            data-testid="resume-languages-grid"
            style={{
                display: "grid",
                gridTemplateColumns: `repeat(${languageColumns}, minmax(0, 1fr))`,
                columnGap: `${(languagesStyle.columnGap ?? 16) * typographyScale}px`,
                rowGap: `${languageEntrySpacing ?? settings.spacing.itemSpacing}px`,
                marginBottom: `${settings.spacing.itemSpacing}px`,
            }}
        >
            {languages.map((lang: any, index: number) => (
                <div key={lang.id || index}>
                    {renderLanguageEntry(lang, index, { marginBottom: "0px" })}
                </div>
            ))}
        </div>
    );

    const renderLanguageTable = (languages: any[]) => {
        const hasAssessments = languages.some((lang) => getLanguageAssessment(lang) !== null);
        const columnCount = hasAssessments ? 3 : 2;
        const tableAlign = languagesStyle.textAlign ?? "left";
        // A real <table> keeps header and body columns aligned; textAlign is set
        // explicitly on every cell because <th> centers by default.
        const cellStyle: CSSProperties = {
            paddingLeft: `${(languagesStyle.tableCellPaddingX ?? 8) * typographyScale}px`,
            paddingRight: `${(languagesStyle.tableCellPaddingX ?? 8) * typographyScale}px`,
            paddingTop: `${(languagesStyle.tableCellPaddingY ?? 6) * typographyScale}px`,
            paddingBottom: `${(languagesStyle.tableCellPaddingY ?? 6) * typographyScale}px`,
            textAlign: tableAlign,
        };
        // The proficiency column is the point of the table, so "hidden" only applies
        // to the list layout; badge/text style and size still apply here.
        const fluencyClass = languagesStyle.fluencyDisplay === "text"
            ? "font-semibold leading-tight"
            : "inline-block rounded-sm border border-current/20 px-1.5 py-0.5 font-semibold leading-tight";

        return (
            <div data-testid="resume-entry" style={getEntryWrapperStyle("languages")}>
            <div data-testid="resume-languages-table" className="overflow-hidden rounded-sm border border-current/10 text-sm">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-current/10 bg-current/5 text-[0.72em] font-semibold uppercase tracking-normal opacity-70">
                            <th className="font-semibold" style={cellStyle}>{cvLabels.languageName}</th>
                            <th className="font-semibold" style={cellStyle}>{cvLabels.languageProficiencyLevel}</th>
                            {hasAssessments && <th className="font-semibold" style={cellStyle}>{cvLabels.languageAssessment}</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {languages.map((lang: any, index: number) => {
                            const isLast = index === languages.length - 1;
                            const rowBorderClass = isLast ? "" : "border-b border-current/10";
                            return (
                                <Fragment key={lang.id || index}>
                                    <tr className={lang.description ? "" : rowBorderClass}>
                                        <td className="font-semibold break-words align-top" style={cellStyle}>
                                            {lang.language || `${languagesLabel} ${index + 1}`}
                                        </td>
                                        <td className="align-top" style={cellStyle}>
                                            <span className={fluencyClass} style={{ fontSize: `${languagesStyle.fluencySize ?? 0.85}em` }}>
                                                {lang.fluency || "-"}
                                            </span>
                                        </td>
                                        {hasAssessments && (
                                            <td className="opacity-80 align-top" style={cellStyle}>
                                                {renderLanguageAssessment(lang) ?? "-"}
                                            </td>
                                        )}
                                    </tr>
                                    {lang.description && (
                                        <tr className={rowBorderClass}>
                                            <td colSpan={columnCount} className="resume-md opacity-90" style={{ ...cellStyle, paddingTop: 0 }}>
                                                <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{lang.description}</ReactMarkdown>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            </div>
        );
    };

    // Europass-style self-assessment grid: mother tongues on one line, then a
    // row per other language with a level per CEFR skill.
    const renderLanguageCefrGrid = (languages: any[]) => {
        const nativeLanguages = languages.filter((lang) => isNativeLanguageFluency(lang.fluency || ""));
        const otherLanguages = languages.filter((lang) => !isNativeLanguageFluency(lang.fluency || ""));
        const cellPaddingX = (languagesStyle.tableCellPaddingX ?? 8) * typographyScale;
        const cellPaddingY = (languagesStyle.tableCellPaddingY ?? 6) * typographyScale;
        const cellStyle: CSSProperties = {
            paddingLeft: `${cellPaddingX}px`,
            paddingRight: `${cellPaddingX}px`,
            paddingTop: `${cellPaddingY}px`,
            paddingBottom: `${cellPaddingY}px`,
        };
        const nameAlign = languagesStyle.textAlign ?? "left";
        const levelStyle: CSSProperties = { fontSize: `${languagesStyle.fluencySize ?? 0.85}em` };
        const levelClass = languagesStyle.fluencyDisplay === "text"
            ? "font-semibold leading-tight tabular-nums"
            : "inline-block rounded-sm border border-current/20 px-1.5 py-0.5 font-semibold leading-tight tabular-nums";
        const skillLabels: Record<CefrSkill, string> = {
            listening: cvLabels.languageListening,
            reading: cvLabels.languageReading,
            spokenInteraction: cvLabels.languageSpokenInteraction,
            spokenProduction: cvLabels.languageSpokenProduction,
            writing: cvLabels.languageWriting,
        };
        const groupLabels: Record<CefrSkillGroup, string> = {
            understanding: cvLabels.languageUnderstanding,
            speaking: cvLabels.languageSpeaking,
            writing: cvLabels.languageWriting,
        };
        // A thin rule opens each skill group, echoing the grouped header.
        const groupStart = new Set<CefrSkill>(CEFR_SKILL_GROUPS.map(({ skills }) => skills[0]));
        const renderLevel = (level: string) => level
            ? <span className={levelClass} style={levelStyle}>{level}</span>
            : <span className="opacity-40">–</span>;

        return (
            <div data-testid="resume-entry" style={getEntryWrapperStyle("languages")}>
                {nativeLanguages.length > 0 && (
                    <p
                        data-testid="resume-languages-mother-tongues"
                        className="text-sm"
                        style={{ textAlign: nameAlign, marginBottom: otherLanguages.length > 0 ? `${cellPaddingY + 4}px` : undefined }}
                    >
                        <span className="opacity-70">{cvLabels.languageMotherTongues}: </span>
                        <span className="font-semibold">
                            {nativeLanguages.map((lang, index) => lang.language || `${languagesLabel} ${index + 1}`).join(", ")}
                        </span>
                    </p>
                )}
                {otherLanguages.length > 0 && (
                    <div data-testid="resume-languages-cefr" className="overflow-hidden rounded-sm border border-current/10 text-sm">
                        <table className="w-full table-fixed border-collapse">
                            <colgroup>
                                <col style={{ width: "25%" }} />
                                {CEFR_SKILLS.map((skill) => <col key={skill} style={{ width: "15%" }} />)}
                            </colgroup>
                            <thead className="bg-current/5 text-[0.7em] font-semibold leading-tight">
                                <tr>
                                    <th rowSpan={2} className="border-b border-current/10 align-bottom font-semibold uppercase opacity-70" style={{ ...cellStyle, textAlign: nameAlign }}>
                                        {cvLabels.languageName}
                                    </th>
                                    {CEFR_SKILL_GROUPS.map(({ group, skills }) => (
                                        <th
                                            key={group}
                                            colSpan={skills.length}
                                            className="border-l border-current/10 font-semibold uppercase opacity-70"
                                            style={{ ...cellStyle, paddingBottom: 0, textAlign: "center" }}
                                        >
                                            {groupLabels[group]}
                                        </th>
                                    ))}
                                </tr>
                                <tr className="border-b border-current/10">
                                    {CEFR_SKILLS.map((skill) => (
                                        <th
                                            key={skill}
                                            className={`break-words font-normal opacity-60 [hyphens:auto] ${groupStart.has(skill) ? "border-l border-current/10" : ""}`}
                                            style={{ ...cellStyle, textAlign: "center" }}
                                        >
                                            {/* The Writing group has a single skill; its heading already names it. */}
                                            {skill === "writing" ? "" : skillLabels[skill]}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {otherLanguages.map((lang: any, index: number) => {
                                    const levels = lang.cefr || {};
                                    const detailed = Boolean(lang.cefrDetailed) && assessedCefrSkills(levels).length > 0;
                                    const assessmentNode = renderLanguageAssessment(lang);
                                    const hasFooter = Boolean(assessmentNode || lang.description);
                                    const rowBorderClass = index === otherLanguages.length - 1 ? "" : "border-b border-current/10";
                                    return (
                                        <Fragment key={lang.id || index}>
                                            <tr data-testid="resume-language-cefr-row" className={hasFooter ? "" : rowBorderClass}>
                                                <td className="break-words align-middle font-semibold" style={{ ...cellStyle, textAlign: nameAlign }}>
                                                    {lang.language || `${languagesLabel} ${index + 1}`}
                                                </td>
                                                {detailed ? CEFR_SKILLS.map((skill) => (
                                                    <td
                                                        key={skill}
                                                        className={`align-middle ${groupStart.has(skill) ? "border-l border-current/10" : ""}`}
                                                        style={{ ...cellStyle, textAlign: "center" }}
                                                    >
                                                        {renderLevel(isCefrLevel(levels[skill] || "") ? levels[skill] : "")}
                                                    </td>
                                                )) : (
                                                    <td colSpan={CEFR_SKILLS.length} className="border-l border-current/10 align-middle" style={{ ...cellStyle, textAlign: "center" }}>
                                                        {renderLevel(lang.fluency || "")}
                                                    </td>
                                                )}
                                            </tr>
                                            {hasFooter && (
                                                <tr className={rowBorderClass}>
                                                    <td colSpan={CEFR_SKILLS.length + 1} className="resume-md opacity-90" style={{ ...cellStyle, paddingTop: 0, textAlign: nameAlign }}>
                                                        {assessmentNode && <div className="text-[0.9em] opacity-80">{assessmentNode}</div>}
                                                        {lang.description && (
                                                            <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{lang.description}</ReactMarkdown>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    const renderSkillChip = (skill: any, index: number) => {
        const display = skill.display || "both";
        const SkillIcon = getSkillIcon(skill.name || "", skill.icon);
        const showIcon = (display === "icon" || display === "both") && SkillIcon !== null;
        // An icon-only chip without a recognisable icon falls back to its name.
        const showName = display === "name" || display === "both" || !showIcon;
        const skillIconColorMode = settings.colors.skillIconColor;
        const brandHex = skillIconColorMode === "brand"
            ? getBrandIconHex(skill.name || "", skill.icon)
            : null;
        const iconColor = skillIconColorMode === "custom"
            ? (settings.colors.skillIconCustomColor || settings.colors.accent)
            : (brandHex ?? settings.colors.accent);
        const rank = skillLevelRank(skill.level || "");
        return (
            <span
                key={`${skill.id || "skill"}-${index}`}
                data-testid="resume-skill"
                className="inline-flex items-center gap-1.5 rounded-md border border-current/15 px-2 py-1 text-[0.9em] leading-none"
            >
                {showIcon && SkillIcon && <SkillIcon className="h-[1.1em] w-[1.1em] shrink-0" style={{ color: iconColor }} />}
                {showName && skill.name && <span className="font-medium">{skill.name}</span>}
                {rank > 0 && (
                    <span className="inline-flex items-center gap-[2px]">
                        {SKILL_LEVELS.map((_, i) => (
                            <span
                                key={i}
                                className="rounded-full"
                                style={{
                                    height: "0.42em",
                                    width: "0.42em",
                                    backgroundColor: i < rank ? settings.colors.accent : "currentColor",
                                    opacity: i < rank ? 1 : 0.25,
                                }}
                            />
                        ))}
                    </span>
                )}
            </span>
        );
    };

    // Renders one skill group's chips (no entry wrapper). Shared by the legacy
    // single-block renderer and the per-group entry nodes so hover/click nav can
    // target an individual group.
    const renderSkillGroupBody = (group: SkillGroup) =>
        group.name.trim() ? (
            <div
                data-testid="resume-skill-group"
                className="flex flex-wrap items-center gap-2"
            >
                <span className="text-[0.9em] font-semibold leading-none">
                    {group.name}:
                </span>
                {group.skills.map(renderSkillChip)}
            </div>
        ) : (
            <div data-testid="resume-skill-group" className="flex flex-wrap gap-2">
                {group.skills.map(renderSkillChip)}
            </div>
        );

    const renderSkills = (skillGroups: SkillGroup[]) => {
        const rendered = skillGroups.filter((group) => group.skills.length > 0);
        return (
            <div data-testid="resume-entry" style={getEntryWrapperStyle(getConfiguredSectionKey("skills"))}>
                <div className="flex flex-col gap-2">
                    {rendered.map((group) => (
                        <Fragment key={group.id}>{renderSkillGroupBody(group)}</Fragment>
                    ))}
                </div>
            </div>
        );
    };

    const renderProfileHeader = () => {
        const scaledProfileSectionBorder: BoxBorderSettings = {
            ...profileSectionBorder,
            width: (profileSectionBorder.width ?? 0) * typographyScale,
            radius: (profileSectionBorder.radius ?? 0) * typographyScale,
            dashLength: (profileSectionBorder.dashLength ?? 6) * typographyScale,
            dashGap: (profileSectionBorder.dashGap ?? 4) * typographyScale,
        };
        const profileHeaderStyle: CSSProperties = {
            ...(profileSectionHasCustomBorder ? buildBoxBorderStyles(scaledProfileSectionBorder, profileSectionBorderColor) : {}),
            boxSizing: "border-box",
        };
        const profilePaddingTop = (settings.personalDetails.paddingTop ?? 0) * typographyScale;
        const profilePaddingRight = (settings.personalDetails.paddingRight ?? 0) * typographyScale;
        const profilePaddingBottom = (settings.personalDetails.paddingBottom ?? 0) * typographyScale;
        const profilePaddingLeft = (settings.personalDetails.paddingLeft ?? 0) * typographyScale;
        const profileMarginTop = (settings.personalDetails.marginTop ?? 0) * typographyScale;
        const profileMarginRight = (settings.personalDetails.marginRight ?? 0) * typographyScale;
        const profileMarginBottom = (settings.personalDetails.marginBottom ?? 0) * typographyScale;
        const profileMarginLeft = (settings.personalDetails.marginLeft ?? 0) * typographyScale;

        if (settings.colors.variant === "advanced") {
            profileHeaderStyle.backgroundColor = settings.colors.background;
            profileHeaderStyle.marginTop = `calc(-${settings.spacing.marginV}mm + ${profileMarginTop}px)`;
            profileHeaderStyle.marginRight = `calc(-${settings.spacing.marginH}mm + ${profileMarginRight}px)`;
            profileHeaderStyle.marginBottom = `${profileMarginBottom}px`;
            profileHeaderStyle.marginLeft = `calc(-${settings.spacing.marginH}mm + ${profileMarginLeft}px)`;
            profileHeaderStyle.paddingTop = `calc(${settings.spacing.marginV}mm + ${profilePaddingTop}px)`;
            profileHeaderStyle.paddingRight = `calc(${settings.spacing.marginH}mm + ${profilePaddingRight}px)`;
            profileHeaderStyle.paddingBottom = `calc(${settings.spacing.marginV}mm + ${profilePaddingBottom}px)`;
            profileHeaderStyle.paddingLeft = `calc(${settings.spacing.marginH}mm + ${profilePaddingLeft}px)`;
        } else {
            profileHeaderStyle.marginTop = `${profileMarginTop}px`;
            profileHeaderStyle.marginRight = `${profileMarginRight}px`;
            profileHeaderStyle.marginBottom = `${profileMarginBottom}px`;
            profileHeaderStyle.marginLeft = `${profileMarginLeft}px`;
            profileHeaderStyle.paddingTop = `${profilePaddingTop}px`;
            profileHeaderStyle.paddingRight = `${profilePaddingRight}px`;
            profileHeaderStyle.paddingBottom = `${profilePaddingBottom}px`;
            profileHeaderStyle.paddingLeft = `${profilePaddingLeft}px`;
        }

        const headerContent = (
            <div className={`flex min-w-0 flex-1 flex-col ${contentAlignClass}`}>
                <InlineField
                    as="h1"
                    mode="plain"
                    value={name}
                    onCommit={(v) => updateBasics({ name: v })}
                    staticRender={name || cvLabels.yourName}
                    className={`tracking-tight ${headline ? "mb-1" : "mb-2"}`}
                    styleTarget={nameSizeTarget}
                    dataAttrs={{ "data-testid": "resume-preview-name", "data-nav-section": "basics", "data-nav-kind": "heading" }}
                />
                {(headline || inlineEditable) && (
                    <InlineField
                        as="p"
                        mode="plain"
                        value={headline}
                        onCommit={(v) => updateBasics({ headline: v })}
                        className="job-title text-sm opacity-80 mb-2"
                        dataAttrs={{ "data-nav-section": "basics", "data-nav-kind": "heading" }}
                    />
                )}
                {renderContactItems()}
            </div>
        );

        const photoNode = renderProfilePhoto();
        const bodyNode = !photoNode ? (
            headerContent
        ) : personalDetailsLayout === "imageTop" ? (
            <div className={`flex flex-col gap-5 ${contentAlignClass}`}>
                {photoNode}
                {headerContent}
            </div>
        ) : personalDetailsLayout === "imageLeft" ? (
            <div className="flex items-start gap-6">
                {photoNode}
                {headerContent}
            </div>
        ) : (
            <div className="flex items-start gap-6">
                {headerContent}
                {photoNode}
            </div>
        );

        const useBaselineFallback =
            settings.headings.style === "baseline" && (profileSectionBorder.width ?? 0) === 0;

        return (
            <header
                data-testid="resume-preview-header"
                data-profile-layout={personalDetailsLayout}
                className={useBaselineFallback ? "border-b-2" : ""}
                style={{
                    ...(useBaselineFallback ? { borderColor: headingLineColor } : {}),
                    ...profileHeaderStyle,
                }}
            >
                {bodyNode}
            </header>
        );
    };

    const zoomPercent = Math.round(zoom * 100);
    const visibleContentKeys = getVisibleContentKeys(resume);
    const configuredPreviewKeys = visibleContentKeys.reduce<Record<string, string>>((acc, key) => {
        const base = getPreviewSectionBaseId(key);
        if ((base === "experience" || base === "education" || base === "courses" || base === "certificates" || base === "awards" || base === "publications" || base === "references" || base === "declaration" || base === "projects" || base === "organisations" || base === "interests") && !acc[base]) {
            acc[base] = key;
        }
        return acc;
    }, {});
    const configuredPreviewBases = new Set(visibleContentKeys.map((key) => getPreviewSectionBaseId(key)));
    // Legacy documents without contentSections render every populated section;
    // once sections are configured, only visible keys render.
    const hasConfiguredSections = (resume.settings?.contentSections || []).length > 0;
    const shouldRenderConfiguredSection = (base: PreviewSectionKey) =>
        !hasConfiguredSections || configuredPreviewBases.has(base);
    const getConfiguredSectionKey = (base: PreviewSectionKey) => configuredPreviewKeys[base] || base;

    const controlButtons = (
        <div className={`sticky top-0 z-50 flex justify-end pointer-events-none p-4 print:hidden ${fullscreen
            ? ""
            : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
            } transition-opacity`}
        >
            <div className="flex items-center gap-1.5 pointer-events-auto">
                {/* Zoom controls - hidden on mobile */}
                <div className="hidden lg:flex items-center gap-1.5">
                    {isZoomedOrPanned && (
                        <button
                            onClick={resetView}
                            className={`p-2.5 rounded-xl transition-all cursor-pointer ${fullscreen
                                ? "bg-surface-4 border border-edge text-strong/70 hover:text-strong hover:bg-edge"
                                : "bg-surface-4/90 backdrop-blur-md border border-edge text-faint hover:text-strong"
                                }`}
                            title={t("preview.resetZoom")}
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={zoomOut}
                        disabled={zoom <= ZOOM_MIN}
                        className={`p-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${fullscreen
                            ? "bg-surface-4 border border-edge text-strong/70 hover:text-strong hover:bg-edge"
                            : "bg-surface-4/90 backdrop-blur-md border border-edge text-faint hover:text-strong"
                            }`}
                        title={t("preview.zoomOut")}
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className={`text-xs tabular-nums min-w-[3ch] text-center select-none ${fullscreen ? "text-strong/50" : "text-faint"}`}>
                        {zoomPercent}%
                    </span>
                    <button
                        onClick={zoomIn}
                        disabled={zoom >= ZOOM_MAX}
                        className={`p-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${fullscreen
                            ? "bg-surface-4 border border-edge text-strong/70 hover:text-strong hover:bg-edge"
                            : "bg-surface-4/90 backdrop-blur-md border border-edge text-faint hover:text-strong"
                            }`}
                        title={t("preview.zoomIn")}
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                </div>
                {/* Fullscreen toggle */}
                <button
                    onClick={toggleFullscreen}
                    className={`p-2.5 rounded-xl transition-all cursor-pointer ${fullscreen
                        ? "bg-surface-4 border border-edge text-strong/70 hover:text-strong hover:bg-edge"
                        : "bg-surface-4/90 backdrop-blur-md border border-edge text-faint hover:text-strong"
                        }`}
                    title={fullscreen ? t("preview.exitFullscreen") : t("preview.fullscreen")}
                >
                    {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );

    // ─── Build the list of resume blocks as React elements ───
    // Each block is a logical unit that should not be split across pages.
    const resumeBlocks: PreviewBlock[] = [];
    const pushBlock = (block: PreviewBlock) => {
        resumeBlocks.push(block);
    };

    // Experience entry body: the markdown description is double-click editable
    // (TipTap) in the live preview; falls back to highlights when empty. Shared
    // by the single-column and structured render paths so both stay in sync.
    const experienceBody = (exp: any) => {
        if (exp.description) {
            return (
                <InlineField
                    mode="rich"
                    value={exp.description}
                    onCommit={(md) => patchExperience(exp.id, { description: md })}
                    staticRender={(
                        <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{exp.description}</ReactMarkdown>
                    )}
                />
            );
        }
        if (exp.highlights && exp.highlights.length > 0) return (
            <ul>
                {exp.highlights.map((h: string, j: number) => <li key={j}>{h}</li>)}
            </ul>
        );
        return null;
    };

    // Editable experience job title node (used as renderEntry's `title` slot).
    const experienceTitle = (exp: any) => (
        <InlineField
            as="span"
            mode="plain"
            value={exp.position || ""}
            onCommit={(v) => patchExperience(exp.id, { position: v })}
            staticRender={exp.position || cvLabels.position}
            styleTarget={entryTitleSizeTarget}
        />
    );

    // Editable experience subtitle (company); keeps the link/icon in the static
    // view, swaps to a plain text field while editing.
    const experienceSubtitle = (exp: any) => (
        <InlineField
            as="span"
            mode="plain"
            value={exp.company || ""}
            onCommit={(v) => patchExperience(exp.id, { company: v })}
            staticRender={renderEntrySubtitle(
                exp.company || "",
                exp.url,
                exp.urlIcon,
                getConfiguredSectionKey("experience"),
            )}
            styleTarget={entrySubtitleSizeTarget}
        />
    );

    // Editable experience location (only rendered when present, so the entry
    // layout heuristic that keys off date/location is preserved).
    const experienceLocation = (exp: any) => (
        <InlineField
            mode="plain"
            value={exp.location || ""}
            onCommit={(v) => patchExperience(exp.id, { location: v })}
        />
    );

    // Individually selectable start / end dates. Each field shows the formatted
    // value but edits the raw stored string (e.g. "2020-03"). The end field and
    // separator only render when an end exists, so ongoing roles (and exports)
    // stay clean. Only shown when a start date exists — see the layout note on
    // experienceLocation.
    // Inline text (not flex) so the date column's text-align still applies
    // once a long range wraps.
    const experienceDates = (exp: any) => (
        <span>
            <InlineField
                as="span"
                mode="plain"
                value={exp.start || ""}
                onCommit={(v) => patchExperience(exp.id, { start: v })}
                staticRender={exp.start ? formatResumeDate(exp.start) : undefined}
            />
            {exp.end && (
                <>
                    {" – "}
                    <InlineField
                        as="span"
                        mode="plain"
                        value={exp.end}
                        onCommit={(v) => patchExperience(exp.id, { end: v })}
                        staticRender={formatResumeDate(exp.end)}
                    />
                </>
            )}
        </span>
    );

    // Degree and field of study together ("MSc, Industrial Design
    // Engineering"); either alone when only one is filled in.
    const educationTitle = (edu: any) =>
        [edu.studyType, edu.area].filter(Boolean).join(", ") || cvLabels.degree;

    // Block 0: Header
    pushBlock({
        key: "header",
        kind: "header",
        node: renderProfileHeader(),
    });

    // Block 1: Summary
    const summaryBlockNode = renderSummarySection("standalone");
    if (summaryBlockNode) {
        pushBlock({
            key: "summary",
            kind: "summary",
            node: summaryBlockNode,
        });
    }

    // Experience — each item is its own block for smart breaking
    if (shouldRenderConfiguredSection("experience") && content.experience && content.experience.length > 0) {
        // Section heading as its own block
        pushBlock({
            key: "exp-heading",
            kind: "section-heading",
            section: "experience",
            node: renderSectionHeading("experience", cvLabels.experience),
        });
        content.experience.forEach((exp: any, i: number) => {
            pushBlock({
                key: `exp-${exp.id || i}`,
                kind: "entry",
                section: "experience",
                node: renderEntry(
                    experienceTitle(exp),
                    experienceSubtitle(exp),
                    exp.start ? experienceDates(exp) : null,
                    exp.location ? experienceLocation(exp) : null,
                    experienceBody(exp),
                    undefined,
                    undefined,
                    exp.skills,
                    getConfiguredSectionKey("experience"),
                ),
            });
        });
    }

    // Education
    if (shouldRenderConfiguredSection("education") && content.education && content.education.length > 0) {
        pushBlock({
            key: "edu-heading",
            kind: "section-heading",
            section: "education",
            node: renderSectionHeading("education", cvLabels.education),
        });
        content.education.forEach((edu: any, i: number) => {
            pushBlock({
                key: `edu-${edu.id || i}`,
                kind: "entry",
                section: "education",
                node: renderEntry(
                    educationTitle(edu),
                    renderEntrySubtitle(edu.institution || "", edu.url, edu.urlIcon, getConfiguredSectionKey("education")),
                    edu.start ? formatResumeDateRange(edu.start, edu.end) : null,
                    edu.location,
                    (edu.description || edu.score) ? (
                        <>
                            {edu.description && (
                                <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{edu.description}</ReactMarkdown>
                            )}
                            {edu.score && <div className="text-xs opacity-60 mt-0.5">{formatCvText(cvLabels.gpaScore, { score: edu.score })}</div>}
                        </>
                    ) : null,
                    undefined,
                    undefined,
                    edu.skills,
                    getConfiguredSectionKey("education"),
                ),
            });
        });
    }

    // Courses
    if (shouldRenderConfiguredSection("courses") && content.courses && content.courses.length > 0) {
        pushBlock({
            key: "courses-heading",
            kind: "section-heading",
            section: "courses",
            node: renderSectionHeading("courses", coursesLabel),
        });
        content.courses.forEach((course: any, i: number) => {
            pushBlock({
                key: `course-${course.id || i}`,
                kind: "entry",
                section: "courses",
                node: renderEntry(
                    course.name || coursesLabel,
                    renderEntrySubtitle(course.institution || "", course.url, course.urlIcon, getConfiguredSectionKey("courses")),
                    course.start ? formatResumeDateRange(course.start, course.end) : null,
                    course.location || null,
                    course.description ? (
                        <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{course.description}</ReactMarkdown>
                    ) : null,
                    undefined,
                    undefined,
                    course.skills,
                    getConfiguredSectionKey("courses"),
                ),
            });
        });
    }

    // Certificates
    if (shouldRenderConfiguredSection("certificates") && content.certificates && content.certificates.length > 0) {
        pushBlock({
            key: "cert-heading",
            kind: "section-heading",
            section: "certificates",
            node: renderSectionHeading("certificates", cvLabels.certificates),
        });
        content.certificates.forEach((cert: any, i: number) => {
            pushBlock({
                key: `cert-${cert.id || i}`,
                kind: "entry",
                section: "certificates",
                node: renderEntry(
                    cert.name || cvLabels.certificate,
                    cert.issuer ? renderEntrySubtitle(cert.issuer, cert.issuerUrl || cert.url, cert.issuerUrlIcon || cert.urlIcon, getConfiguredSectionKey("certificates")) : null,
                    cert.date ? formatResumeDate(cert.date) : null,
                    null, // location
                    cert.description ? (
                        <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{cert.description}</ReactMarkdown>
                    ) : null,
                    undefined,
                    undefined,
                    cert.skills,
                    getConfiguredSectionKey("certificates"),
                ),
            });
        });
    }

    // Awards
    if (shouldRenderConfiguredSection("awards") && content.awards && content.awards.length > 0) {
        pushBlock({
            key: "awards-heading",
            kind: "section-heading",
            section: "awards",
            node: renderSectionHeading("awards", awardsLabel),
        });
        content.awards.forEach((award: any, i: number) => {
            pushBlock({
                key: `award-${award.id || i}`,
                kind: "entry",
                section: "awards",
                node: renderEntry(
                    award.name || awardsLabel,
                    award.issuer ? renderEntrySubtitle(award.issuer, award.url, award.urlIcon, getConfiguredSectionKey("awards")) : null,
                    award.date ? formatResumeDate(award.date) : null,
                    null, // location
                    award.description ? (
                        <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{award.description}</ReactMarkdown>
                    ) : null,
                    undefined,
                    undefined,
                    award.skills,
                    getConfiguredSectionKey("awards"),
                ),
            });
        });
    }

    // Publications
    if (shouldRenderConfiguredSection("publications") && content.publications && content.publications.length > 0) {
        pushBlock({
            key: "publications-heading",
            kind: "section-heading",
            section: "publications",
            node: renderSectionHeading("publications", publicationsLabel),
        });
        content.publications.forEach((publication: any, i: number) => {
            pushBlock({
                key: `publication-${publication.id || i}`,
                kind: "entry",
                section: "publications",
                node: renderEntry(
                    publication.name || publicationsLabel,
                    publication.publisher ? renderEntrySubtitle(publication.publisher, publication.url, publication.urlIcon, getConfiguredSectionKey("publications")) : null,
                    publication.date ? formatResumeDate(publication.date) : null,
                    null, // location
                    publication.description ? (
                        <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{publication.description}</ReactMarkdown>
                    ) : null,
                    undefined,
                    undefined,
                    publication.skills,
                    getConfiguredSectionKey("publications"),
                ),
            });
        });
    }

    // References
    if (shouldRenderConfiguredSection("references") && content.references && content.references.length > 0) {
        pushBlock({
            key: "references-heading",
            kind: "section-heading",
            section: "references",
            node: renderSectionHeading("references", referencesLabel),
        });
        content.references.forEach((reference: any, i: number) => {
            pushBlock({
                key: `reference-${reference.id || i}`,
                kind: "entry",
                section: "references",
                node: renderEntry(
                    reference.name || referencesLabel,
                    renderEntrySubtitle([reference.position, reference.organisation].filter(Boolean).join(" · "), reference.url, reference.urlIcon, getConfiguredSectionKey("references")),
                    null, // date
                    null, // location
                    (reference.email || reference.phone || reference.description) ? (
                        <div className="flex flex-col gap-0.5">
                            {reference.email && <a href={`mailto:${reference.email}`} className="opacity-80 hover:opacity-100">{reference.email}</a>}
                            {reference.phone && <a href={`tel:${reference.phone}`} className="opacity-80 hover:opacity-100">{reference.phone}</a>}
                            {reference.description && (
                                <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{reference.description}</ReactMarkdown>
                            )}
                        </div>
                    ) : null,
                    undefined,
                    undefined,
                    undefined,
                    getConfiguredSectionKey("references"),
                ),
            });
        });
    }

    // Declaration
    if (shouldRenderConfiguredSection("declaration") && content.declaration && content.declaration.length > 0) {
        pushBlock({
            key: "declaration-heading",
            kind: "section-heading",
            section: "declaration",
            node: renderSectionHeading("declaration", declarationLabel),
        });
        content.declaration.forEach((declaration: any, i: number) => {
            pushBlock({
                key: `declaration-${declaration.id || i}`,
                kind: "entry",
                section: "declaration",
                node: renderDeclarationEntry(declaration, `declaration-entry-${declaration.id || i}`),
            });
        });
    }

    // Projects
    if (shouldRenderConfiguredSection("projects") && content.projects && content.projects.length > 0) {
        pushBlock({
            key: "proj-heading",
            kind: "section-heading",
            section: "projects",
            node: renderSectionHeading("projects", cvLabels.projects),
        });
        content.projects.forEach((proj: any, i: number) => {
            const hasRepos = Array.isArray(proj.repos) && proj.repos.length > 0;
            const hasDescription = Boolean(proj.description);
            pushBlock({
                key: `proj-${proj.id || i}`,
                kind: "entry",
                section: "projects",
                node: renderEntry(
                    renderProjectTitle(proj),
                    renderEntrySubtitle(proj.subtitle || "", proj.url, proj.urlIcon, getConfiguredSectionKey("projects")),
                    proj.start ? formatResumeDateRange(proj.start, proj.end) : null,
                    null, // location
                    (hasDescription || hasRepos) ? (
                        <>
                            {hasRepos && <RepoBadgeList repos={proj.repos} settings={projectsStyle.repoBadge as any} accentColor={projectsStyle.colors.accent} textColor={projectsStyle.colors.text} />}
                            {hasDescription && (
                                <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{proj.description}</ReactMarkdown>
                            )}
                        </>
                    ) : null,
                    undefined,
                    undefined,
                    proj.skills,
                    getConfiguredSectionKey("projects"),
                ),
            });
        });
    }

    // Organisations
    if (shouldRenderConfiguredSection("organisations") && content.organisations && content.organisations.length > 0) {
        pushBlock({
            key: "organisations-heading",
            kind: "section-heading",
            section: "organisations",
            node: renderSectionHeading("organisations", organisationsLabel),
        });
        content.organisations.forEach((organisation: any, i: number) => {
            pushBlock({
                key: `organisation-${organisation.id || i}`,
                kind: "entry",
                section: "organisations",
                node: renderEntry(
                    organisation.name || organisationsLabel,
                    renderEntrySubtitle(organisation.role || "", organisation.url, organisation.urlIcon, getConfiguredSectionKey("organisations")),
                    organisation.start ? formatResumeDateRange(organisation.start, organisation.end) : null,
                    organisation.location || null,
                    organisation.description ? (
                        <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{organisation.description}</ReactMarkdown>
                    ) : null,
                    undefined,
                    undefined,
                    organisation.skills,
                    getConfiguredSectionKey("organisations"),
                ),
            });
        });
    }

    // Interests
    if (shouldRenderConfiguredSection("interests") && content.interests && content.interests.length > 0) {
        pushBlock({
            key: "interests-heading",
            kind: "section-heading",
            section: "interests",
            node: renderSectionHeading("interests", interestsLabel),
        });
        content.interests.forEach((interest: any, i: number) => {
            pushBlock({
                key: `interest-${interest.id || i}`,
                kind: "entry",
                section: "interests",
                node: renderEntry(
                    interest.name || interestLabel,
                    null,
                    null,
                    null,
                    interest.description ? (
                        <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{interest.description}</ReactMarkdown>
                    ) : null,
                    undefined,
                    undefined,
                    undefined,
                    getConfiguredSectionKey("interests"),
                ),
            });
        });
    }

    if (shouldRenderConfiguredSection("languages") && content.languages && content.languages.length > 0) {
        pushBlock({
            key: "languages-heading",
            kind: "section-heading",
            section: "languages",
            node: renderSectionHeading("languages", languagesLabel),
        });
        if (languageLayout === "table") {
            pushBlock({
                key: "languages-table",
                kind: "entry",
                section: "languages",
                node: renderLanguageTable(content.languages),
            });
        } else if (languageLayout === "cefr") {
            pushBlock({
                key: "languages-cefr",
                kind: "entry",
                section: "languages",
                node: renderLanguageCefrGrid(content.languages),
            });
        } else if (languageColumns > 1) {
            pushBlock({
                key: "languages-grid",
                kind: "entry",
                section: "languages",
                node: renderLanguageGrid(content.languages),
            });
        } else {
            content.languages.forEach((lang: any, i: number) => {
                pushBlock({
                    key: `language-${lang.id || i}`,
                    kind: "entry",
                    section: "languages",
                    node: renderLanguageEntry(lang, i, languageEntrySpacingOverride),
                });
            });
        }
    }

    if (shouldRenderConfiguredSection("skills") && allSkillsVisible.length > 0) {
        pushBlock({
            key: "skills-heading",
            kind: "section-heading",
            section: "skills",
            node: renderSectionHeading("skills", skillsLabel),
        });
        pushBlock({
            key: "skills-list",
            kind: "entry",
            section: "skills",
            node: renderSkills(content.skillGroups),
        });
    }

    // Empty state block
    const emptyStateNode = (
        <div className="flex-1 flex flex-col items-center justify-center text-mid print:hidden">
            <p>{cvLabels.startTyping}</p>
        </div>
    );

    const profileSummaryNode = renderSummarySection("profile");
    const profileSectionNode = (
        <section data-preview-section="profile">
            {renderProfileHeader()}
            {profileSummaryNode}
        </section>
    );

    const previewSections: PreviewSection[] = [];

    if (shouldRenderConfiguredSection("experience") && content.experience && content.experience.length > 0) {
        previewSections.push({
            key: getConfiguredSectionKey("experience"),
            base: "experience",
            headingNode: renderSectionHeading("experience", cvLabels.experience),
            entryNodes: content.experience.map((exp: any, i: number) => (
                <div key={`layout-exp-${exp.id || i}`}>
                    {renderEntry(
                        experienceTitle(exp),
                        experienceSubtitle(exp),
                        exp.start ? experienceDates(exp) : null,
                        exp.location ? experienceLocation(exp) : null,
                        experienceBody(exp),
                        undefined,
                        undefined,
                        exp.skills,
                        getConfiguredSectionKey("experience"),
                    )}
                </div>
            )),
        });
    }

    if (shouldRenderConfiguredSection("education") && content.education && content.education.length > 0) {
        previewSections.push({
            key: getConfiguredSectionKey("education"),
            base: "education",
            headingNode: renderSectionHeading("education", cvLabels.education),
            entryNodes: content.education.map((edu: any, i: number) => (
                <div key={`layout-edu-${edu.id || i}`}>
                    {renderEntry(
                        educationTitle(edu),
                        renderEntrySubtitle(edu.institution || "", edu.url, edu.urlIcon, getConfiguredSectionKey("education")),
                        edu.start ? formatResumeDateRange(edu.start, edu.end) : null,
                        edu.location,
                        (edu.description || edu.score) ? (
                            <>
                                {edu.description && (
                                    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{edu.description}</ReactMarkdown>
                                )}
                                {edu.score && <div className="text-xs opacity-60 mt-0.5">{formatCvText(cvLabels.gpaScore, { score: edu.score })}</div>}
                            </>
                        ) : null,
                        undefined,
                        undefined,
                        edu.skills,
                        getConfiguredSectionKey("education"),
                    )}
                </div>
            )),
        });
    }

    if (shouldRenderConfiguredSection("courses") && content.courses && content.courses.length > 0) {
        previewSections.push({
            key: getConfiguredSectionKey("courses"),
            base: "courses",
            headingNode: renderSectionHeading("courses", coursesLabel),
            entryNodes: content.courses.map((course: any, i: number) => (
                <div key={`layout-course-${course.id || i}`}>
                    {renderEntry(
                        course.name || coursesLabel,
                        renderEntrySubtitle(course.institution || "", course.url, course.urlIcon, getConfiguredSectionKey("courses")),
                        course.start ? formatResumeDateRange(course.start, course.end) : null,
                        course.location || null,
                        course.description ? (
                            <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{course.description}</ReactMarkdown>
                        ) : null,
                        undefined,
                        undefined,
                        course.skills,
                        getConfiguredSectionKey("courses"),
                    )}
                </div>
            )),
        });
    }

    if (shouldRenderConfiguredSection("certificates") && content.certificates && content.certificates.length > 0) {
        previewSections.push({
            key: getConfiguredSectionKey("certificates"),
            base: "certificates",
            headingNode: renderSectionHeading("certificates", cvLabels.certificates),
            entryNodes: content.certificates.map((cert: any, i: number) => (
                <div key={`layout-cert-${cert.id || i}`}>
                    {renderEntry(
                        cert.name || cvLabels.certificate,
                        cert.issuer ? renderEntrySubtitle(cert.issuer, cert.issuerUrl || cert.url, cert.issuerUrlIcon || cert.urlIcon, getConfiguredSectionKey("certificates")) : null,
                        cert.date ? formatResumeDate(cert.date) : null,
                        null, // location
                        cert.description ? (
                            <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{cert.description}</ReactMarkdown>
                        ) : null,
                        undefined,
                        undefined,
                        cert.skills,
                        getConfiguredSectionKey("certificates"),
                    )}
                </div>
            )),
        });
    }

    if (shouldRenderConfiguredSection("awards") && content.awards && content.awards.length > 0) {
        previewSections.push({
            key: getConfiguredSectionKey("awards"),
            base: "awards",
            headingNode: renderSectionHeading("awards", awardsLabel),
            entryNodes: content.awards.map((award: any, i: number) => (
                <div key={`layout-award-${award.id || i}`}>
                    {renderEntry(
                        award.name || awardsLabel,
                        award.issuer ? renderEntrySubtitle(award.issuer, award.url, award.urlIcon, getConfiguredSectionKey("awards")) : null,
                        award.date ? formatResumeDate(award.date) : null,
                        null, // location
                        award.description ? (
                            <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{award.description}</ReactMarkdown>
                        ) : null,
                        undefined,
                        undefined,
                        award.skills,
                        getConfiguredSectionKey("awards"),
                    )}
                </div>
            )),
        });
    }

    if (shouldRenderConfiguredSection("publications") && content.publications && content.publications.length > 0) {
        previewSections.push({
            key: getConfiguredSectionKey("publications"),
            base: "publications",
            headingNode: renderSectionHeading("publications", publicationsLabel),
            entryNodes: content.publications.map((publication: any, i: number) => (
                <div key={`layout-publication-${publication.id || i}`}>
                    {renderEntry(
                        publication.name || publicationsLabel,
                        publication.publisher ? renderEntrySubtitle(publication.publisher, publication.url, publication.urlIcon, getConfiguredSectionKey("publications")) : null,
                        publication.date ? formatResumeDate(publication.date) : null,
                        null, // location
                        publication.description ? (
                            <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{publication.description}</ReactMarkdown>
                        ) : null,
                        undefined,
                        undefined,
                        publication.skills,
                        getConfiguredSectionKey("publications"),
                    )}
                </div>
            )),
        });
    }

    if (shouldRenderConfiguredSection("references") && content.references && content.references.length > 0) {
        previewSections.push({
            key: getConfiguredSectionKey("references"),
            base: "references",
            headingNode: renderSectionHeading("references", referencesLabel),
            entryNodes: content.references.map((reference: any, i: number) => (
                <div key={`layout-reference-${reference.id || i}`}>
                    {renderEntry(
                        reference.name || referencesLabel,
                        renderEntrySubtitle([reference.position, reference.organisation].filter(Boolean).join(" · "), reference.url, reference.urlIcon, getConfiguredSectionKey("references")),
                        null, // date
                        null, // location
                        (reference.email || reference.phone || reference.description) ? (
                            <div className="flex flex-col gap-0.5">
                                {reference.email && <a href={`mailto:${reference.email}`} className="opacity-80 hover:opacity-100">{reference.email}</a>}
                                {reference.phone && <a href={`tel:${reference.phone}`} className="opacity-80 hover:opacity-100">{reference.phone}</a>}
                                {reference.description && (
                                    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{reference.description}</ReactMarkdown>
                                )}
                            </div>
                        ) : null,
                        undefined,
                        undefined,
                        undefined,
                        getConfiguredSectionKey("references"),
                    )}
                </div>
            )),
        });
    }

    if (shouldRenderConfiguredSection("declaration") && content.declaration && content.declaration.length > 0) {
        previewSections.push({
            key: getConfiguredSectionKey("declaration"),
            base: "declaration",
            headingNode: renderSectionHeading("declaration", declarationLabel),
            entryNodes: content.declaration.map((declaration: any, i: number) =>
                renderDeclarationEntry(declaration, `layout-declaration-${declaration.id || i}`)
            ),
        });
    }

    if (shouldRenderConfiguredSection("projects") && content.projects && content.projects.length > 0) {
        previewSections.push({
            key: getConfiguredSectionKey("projects"),
            base: "projects",
            headingNode: renderSectionHeading("projects", cvLabels.projects),
            entryNodes: content.projects.map((proj: any, i: number) => {
                const hasRepos = Array.isArray(proj.repos) && proj.repos.length > 0;
                const hasDescription = Boolean(proj.description);
                return (
                    <div key={`layout-proj-${proj.id || i}`}>
                        {renderEntry(
                            renderProjectTitle(proj),
                            renderEntrySubtitle(proj.subtitle || "", proj.url, proj.urlIcon, getConfiguredSectionKey("projects")),
                            proj.start ? formatResumeDateRange(proj.start, proj.end) : null,
                            null, // location
                            (hasDescription || hasRepos) ? (
                                <>
                                    {hasRepos && <RepoBadgeList repos={proj.repos} settings={projectsStyle.repoBadge as any} accentColor={projectsStyle.colors.accent} textColor={projectsStyle.colors.text} />}
                                    {hasDescription && (
                                        <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{proj.description}</ReactMarkdown>
                                    )}
                                </>
                            ) : null,
                            undefined,
                            undefined,
                            proj.skills,
                            getConfiguredSectionKey("projects"),
                        )}
                    </div>
                );
            }),
        });
    }

    if (shouldRenderConfiguredSection("organisations") && content.organisations && content.organisations.length > 0) {
        previewSections.push({
            key: getConfiguredSectionKey("organisations"),
            base: "organisations",
            headingNode: renderSectionHeading("organisations", organisationsLabel),
            entryNodes: content.organisations.map((organisation: any, i: number) => (
                <div key={`layout-organisation-${organisation.id || i}`}>
                    {renderEntry(
                        organisation.name || organisationsLabel,
                        renderEntrySubtitle(organisation.role || "", organisation.url, organisation.urlIcon, getConfiguredSectionKey("organisations")),
                        organisation.start ? formatResumeDateRange(organisation.start, organisation.end) : null,
                        organisation.location || null,
                        organisation.description ? (
                            <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{organisation.description}</ReactMarkdown>
                        ) : null,
                        undefined,
                        undefined,
                        organisation.skills,
                        getConfiguredSectionKey("organisations"),
                    )}
                </div>
            )),
        });
    }

    if (shouldRenderConfiguredSection("interests") && content.interests && content.interests.length > 0) {
        previewSections.push({
            key: getConfiguredSectionKey("interests"),
            base: "interests",
            headingNode: renderSectionHeading("interests", interestsLabel),
            entryNodes: content.interests.map((interest: any, i: number) => (
                <div key={`layout-interest-${interest.id || i}`}>
                    {renderEntry(
                        interest.name || interestLabel,
                        null,
                        null,
                        null,
                        interest.description ? (
                            <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{interest.description}</ReactMarkdown>
                        ) : null,
                        undefined,
                        undefined,
                        undefined,
                        getConfiguredSectionKey("interests"),
                    )}
                </div>
            )),
        });
    }

    if (shouldRenderConfiguredSection("languages") && content.languages && content.languages.length > 0) {
        previewSections.push({
            key: getConfiguredSectionKey("languages"),
            base: "languages",
            headingNode: renderSectionHeading("languages", languagesLabel),
            entryNodes: languageLayout === "table"
                ? [<div key="layout-languages-table">{renderLanguageTable(content.languages)}</div>]
                : languageLayout === "cefr"
                ? [<div key="layout-languages-cefr">{renderLanguageCefrGrid(content.languages)}</div>]
                : languageColumns > 1
                    ? [<div key="layout-languages-grid">{renderLanguageGrid(content.languages)}</div>]
                    : content.languages.map((lang: any, i: number) => (
                        <div key={`layout-language-${lang.id || i}`}>
                            {renderLanguageEntry(lang, i, languageEntrySpacingOverride)}
                        </div>
                    )),
        });
    }

    if (shouldRenderConfiguredSection("skills") && allSkillsVisible.length > 0) {
        previewSections.push({
            key: getConfiguredSectionKey("skills"),
            base: "skills",
            headingNode: renderSectionHeading("skills", skillsLabel),
            // One entry per skill group so each group gets its own hover outline
            // and click-to-edit target, matching every other section.
            entryNodes: content.skillGroups
                .filter((group) => group.skills.length > 0)
                .map((group) => (
                    <div key={group.id} data-testid="resume-entry" style={getEntryWrapperStyle(getConfiguredSectionKey("skills"))}>
                        {renderSkillGroupBody(group)}
                    </div>
                )),
        });
    }

    // User-defined ("custom") sections. Keyed by the full `custom:<id>` (used as
    // both key and base) so multiple instances never collide in the flow
    // resolver's by-base map. Each renders per its layout mode.
    const visibleCustomKeys = new Set(
        visibleContentKeys.filter((key) => getPreviewSectionBaseId(key) === "custom"),
    );
    for (const custom of resume.customSections ?? []) {
        const key = `custom:${custom.id}`;
        if (!visibleCustomKeys.has(key)) continue;
        const headingNode = renderSectionHeading(key as PreviewSectionKey, custom.title || cvLabels.customSection);

        let entryNodes: React.ReactNode[] = [];
        if (custom.layout === "text") {
            entryNodes = custom.text.trim()
                ? [
                    <div key={`${key}-text`} data-testid="resume-entry" style={getEntryWrapperStyle(key)}>
                        <div className="opacity-90 text-sm leading-relaxed resume-md">
                            <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{custom.text}</ReactMarkdown>
                        </div>
                    </div>,
                ]
                : [];
        } else if (custom.layout === "tags") {
            const tags = (custom.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
            entryNodes = tags.length
                ? [
                    <div key={`${key}-tags`} data-testid="resume-entry" style={getEntryWrapperStyle(key)}>
                        <div className="flex flex-wrap gap-2">
                            {tags.map((tag, i) => (
                                <span
                                    key={`${tag}-${i}`}
                                    data-testid="resume-skill"
                                    className="inline-flex items-center gap-1.5 rounded-md border border-current/15 px-2 py-1 text-[0.9em] leading-none"
                                >
                                    <span className="font-medium">{tag}</span>
                                </span>
                            ))}
                        </div>
                    </div>,
                ]
                : [];
        } else {
            entryNodes = visibleEntries(custom.entries ?? []).map((entry, i: number) => (
                <div key={`custom-entry-${entry.id || i}`}>
                    {renderEntry(
                        entry.title || "",
                        renderEntrySubtitle(entry.subtitle || "", entry.url, entry.urlIcon, key),
                        entry.start ? formatResumeDateRange(entry.start, entry.end) : null,
                        entry.location || null,
                        entry.description ? (
                            <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{entry.description}</ReactMarkdown>
                        ) : null,
                        undefined,
                        undefined,
                        entry.skills,
                        key,
                    )}
                </div>
            ));
        }

        if (entryNodes.length === 0) continue;
        previewSections.push({ key, base: key as PreviewSectionKey, headingNode, entryNodes });
    }

    const hasContent = Boolean(name || primaryEmail || phone || summary || previewSections.length > 0);
    const orderedFlowItems = resolvePreviewFlowOrder(settings.layout.sectionOrder, previewSections);
    const orderedRenderableItems = resolvePreviewRenderableItems(orderedFlowItems);
    const fixedBlockCount = summary ? 2 : 1;
    resumeBlocks.length = fixedBlockCount;

    orderedRenderableItems.forEach((item) => {
        if (item.kind === "separator") {
            pushBlock({
                key: item.key,
                kind: "separator",
                node: renderLayoutSeparator(item.key),
            });
            return;
        }

        if (item.kind === "vertical-separator") {
            pushBlock({
                key: item.key,
                kind: "vertical-separator",
                node: renderLayoutVerticalSeparator(item.key),
            });
            return;
        }

        if (item.kind === "section-pair") {
            if (!item.leftSection || !item.rightSection) return;

            pushBlock({
                key: item.key,
                kind: "section-pair",
                node: renderPairedSections(item.key, item.leftSection, item.rightSection),
            });
            return;
        }

        if (item.kind === "page-break") {
            pushBlock({
                key: item.key,
                kind: "page-break",
                node: null,
            });
            return;
        }

        const section = item.section;
        if (!section) return;

        pushBlock({
            key: `${section.key}-heading`,
            kind: "section-heading",
            section: section.base,
            navSection: section.key,
            node: section.headingNode,
        });

        section.entryNodes.forEach((entryNode, index) => {
            pushBlock({
                key: `${section.key}-entry-${index}`,
                kind: "entry",
                section: section.base,
                navSection: section.key,
                navEntryIndex: index,
                node: entryNode,
            });
        });
    });

    if (!hasContent) {
        pushBlock({
            key: "empty",
            kind: "empty",
            node: emptyStateNode,
        });
    }

    const orderedStructuredItems = orderedRenderableItems;
    const profilePlacement: LayoutSectionPlacement = "full";
    let structuredContentIndex = 0;
    const structuredSectionPlacements = orderedFlowItems.reduce<Record<string, LayoutSectionPlacement>>((acc, item) => {
        if (item.kind !== "section" || !item.section) {
            return acc;
        }

        const section = item.section;
        acc[section.key] = normalizeLayoutPlacement(
            settings.layout.sectionPlacement?.[section.key] || settings.layout.sectionPlacement?.[section.base],
            structuredContentIndex,
            settings.layout.columns === "mix" ? "mix" : "two",
        );
        structuredContentIndex += 1;
        return acc;
    }, {});
    const useStructuredPreview = isStructuredLayout && hasContent;

    // Rebuild a positioned item's node from current render data. State stores
    // only the serializable descriptor (see LayoutItemRender); nodes are derived
    // here so edits that don't change geometry still update the displayed page.
    const renderLayoutItemNode = (render: LayoutItemRender): React.ReactNode => {
        switch (render.type) {
            case "profile":
                return profileSectionNode;
            case "vseparator":
                return renderLayoutVerticalSeparator(render.itemKey);
            case "separator":
                return renderLayoutSeparator(render.itemKey);
            case "paired": {
                const item = orderedStructuredItems.find(
                    (candidate) => candidate.kind === "section-pair" && candidate.key === render.itemKey,
                );
                if (!item || !item.leftSection || !item.rightSection) return null;
                return renderPairedSections(item.key, item.leftSection, item.rightSection);
            }
            case "chunk": {
                const section = previewSections.find((candidate) => candidate.key === render.sectionKey);
                if (!section) return null;
                return (
                    <section>
                        {render.includeHeading && (
                            <div data-nav-section={section.key} data-nav-kind="heading" style={{ display: "flow-root" }}>
                                {section.headingNode}
                            </div>
                        )}
                        {render.entryIndices.map((entryIndex) => (
                            <div
                                key={`${section.key}:entry-fragment:${entryIndex}`}
                                data-nav-section={section.key}
                                data-nav-entry-index={entryIndex}
                                data-nav-kind="entry"
                                style={{ display: "flow-root" }}
                            >
                                {section.entryNodes[entryIndex]}
                            </div>
                        ))}
                    </section>
                );
            }
        }
    };

    const blockKeyString = resumeBlocks.map((block) => `${block.kind}:${block.section ?? ""}:${block.key}`).join("|");
    const resumeLayoutSignature = useMemo(() => JSON.stringify({
        paperSize,
        pageBorderWidth,
        basics: resume.basics,
        experience: content.experience,
        education: content.education,
        certificates: content.certificates,
        projects: content.projects,
        interests: content.interests,
        languages: content.languages,
        settings: resume.settings,
        blockKeyString,
    }), [paperSize, pageBorderWidth, resume.basics, content.experience, content.education,
        content.certificates, content.projects, content.interests, content.languages, resume.settings, blockKeyString]);

    // ─── Measure blocks and chunk into pages ───
    useLayoutEffect(() => {
        const container = measureRef.current;
        if (!container) return;

        let raf = 0;
        const runMeasure = () => {
            const children = Array.from(container.querySelectorAll<HTMLElement>('[data-page-block]'));
            if (children.length === 0) return;

            // Single source of truth for per-page usable height; derived from
            // settings to avoid getComputedStyle timing risk during the rAF.
            const geometry = derivePageGeometry({
                pageContentHeight,
                marginVerticalPx,
                footerHeightPx,
            });
            const usableHeight = Math.max(0, geometry.usableContentHeightPx - PAGINATION_OVERFLOW_GUARD_PX);

            const blockHeights = getMeasuredBlockFootprints(children, container, geometry.bottomPaddingPx);
            const chunks = chunkPreviewBlocks(resumeBlocks, blockHeights, usableHeight);

            setPageChunks(prev => {
                // Avoid re-render if chunks haven't changed
                const prevStr = JSON.stringify(prev);
                const newStr = JSON.stringify(chunks);
                return prevStr === newStr ? prev : chunks;
            });
        };
        const measure = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(runMeasure);
        };

        measure();
        const stopObserving = observePaginationMeasurements(container, "[data-page-block]", measure);

        return () => {
            stopObserving();
            cancelAnimationFrame(raf);
        };
    }, [pageContentHeight, pageContentWidth, resumeLayoutSignature, footerHeightPx, marginVerticalPx, fullscreen]);

    useLayoutEffect(() => {
        if (!useStructuredPreview) {
            return;
        }

        const container = multiMeasureRef.current;
        if (!container) return;

        let raf = 0;
        const runMeasure = () => {
            const heightMap: Record<string, number> = {};
            const measured = Array.from(container.querySelectorAll<HTMLElement>("[data-layout-measure]"));
            measured.forEach((node) => {
                const measureId = node.dataset.layoutMeasure;
                if (!measureId) return;
                heightMap[measureId] = node.offsetHeight;
            });

            const pages: PositionedLayoutItem[][] = [[]];
            // Columns paginate independently: a tall right column spilling to the
            // next page must not drag later left-column sections along with it.
            const leftCursor = { page: 0, y: 0 };
            const rightCursor = { page: 0, y: 0 };

            const ensurePage = (index: number) => {
                for (let i = pages.length; i <= index; i += 1) {
                    pages.push([]);
                }
            };

            // Full-width items sit below both columns, on the furthest page
            // either column has reached.
            const fullPlacementStart = () => {
                const page = Math.max(leftCursor.page, rightCursor.page);
                const y = Math.max(
                    leftCursor.page === page ? leftCursor.y : 0,
                    rightCursor.page === page ? rightCursor.y : 0,
                );
                return { page, y };
            };

            const forceNewPage = () => {
                const current = fullPlacementStart();
                const target = (pages[current.page]?.length ?? 0) === 0 ? current.page : current.page + 1;
                ensurePage(target);
                leftCursor.page = target;
                leftCursor.y = 0;
                rightCursor.page = target;
                rightCursor.y = 0;
            };

            const placeItem = (
                key: string,
                render: LayoutItemRender,
                placement: LayoutSectionPlacement,
                width: number,
                height: number,
                gapAfter: number,
            ) => {
                if (placement === "full") {
                    let { page, y } = fullPlacementStart();
                    if (y > 0 && y + height > paginationContentHeight) {
                        page += 1;
                        y = 0;
                    }
                    ensurePage(page);
                    pages[page].push({ key, render, x: 0, y, width });
                    const nextY = y + height + gapAfter;
                    leftCursor.page = page;
                    leftCursor.y = nextY;
                    rightCursor.page = page;
                    rightCursor.y = nextY;
                    return;
                }

                const cursor = placement === "left" ? leftCursor : rightCursor;
                let { page, y } = cursor;
                if (y > 0 && y + height > paginationContentHeight) {
                    page += 1;
                    y = 0;
                }
                ensurePage(page);
                pages[page].push({
                    key,
                    render,
                    x: placement === "left" ? 0 : leftColumnWidth + columnGap,
                    y,
                    width,
                });
                cursor.page = page;
                cursor.y = y + height + gapAfter;
            };

            if (hasContent) {
                const profileWidth = profilePlacement === "full"
                    ? layoutContentWidth
                    : (profilePlacement === "left" ? leftColumnWidth : rightColumnWidth);
                const profileHeight = heightMap["basic:profile"] ?? 0;
                placeItem("basic-profile", { type: "profile" }, profilePlacement, profileWidth, profileHeight, layoutSectionGap);

                orderedStructuredItems.forEach((item) => {
                    if (item.kind === "page-break") {
                        forceNewPage();
                        return;
                    }

                    if (item.kind === "section-pair") {
                        if (!item.leftSection || !item.rightSection) return;
                        const pairHeight = heightMap[item.key] ?? 0;
                        placeItem(
                            item.key,
                            { type: "paired", itemKey: item.key },
                            "full",
                            layoutContentWidth,
                            pairHeight,
                            layoutSectionGap,
                        );
                        return;
                    }

                    if (item.kind === "vertical-separator") {
                        const separatorHeight = heightMap[item.key] ?? 0;
                        placeItem(
                            item.key,
                            { type: "vseparator", itemKey: item.key },
                            "full",
                            layoutContentWidth,
                            separatorHeight,
                            layoutSectionGap,
                        );
                        return;
                    }

                    if (item.kind === "separator") {
                        const separatorHeight = heightMap[item.key] ?? 0;
                        placeItem(
                            item.key,
                            { type: "separator", itemKey: item.key },
                            "full",
                            layoutContentWidth,
                            separatorHeight,
                            layoutSectionGap,
                        );
                        return;
                    }

                    const section = item.section;
                    if (!section) return;

                    const placement = structuredSectionPlacements[section.key];
                    const sectionWidth = placement === "full"
                        ? layoutContentWidth
                        : (placement === "left" ? leftColumnWidth : rightColumnWidth);
                    const headingHeight = heightMap[`${section.key}:heading`] ?? 0;
                    const entryHeights = section.entryNodes.map((_, index) => heightMap[`${section.key}:entry:${index}`] ?? 0);
                    // Chunk against the space actually left in the target column so a
                    // tall section fills the current page before spilling to the next
                    // one instead of jumping to a fresh page wholesale.
                    const startOffset = placement === "full"
                        ? fullPlacementStart().y
                        : (placement === "left" ? leftCursor.y : rightCursor.y);
                    const chunks = chunkSectionEntries(headingHeight, entryHeights, paginationContentHeight, startOffset);

                    chunks.forEach((chunk, chunkIndex) => {
                        const chunkHeight =
                            (chunk.includeHeading ? headingHeight : 0) +
                            chunk.entryIndices.reduce((sum, entryIndex) => sum + (entryHeights[entryIndex] ?? 0), 0);

                        placeItem(
                            `${section.key}:chunk:${chunkIndex}`,
                            {
                                type: "chunk",
                                sectionKey: section.key,
                                includeHeading: chunk.includeHeading,
                                entryIndices: chunk.entryIndices,
                            },
                            placement,
                            sectionWidth,
                            chunkHeight,
                            chunkIndex === chunks.length - 1 ? layoutSectionGap : 0,
                        );
                    });
                });
            }

            const nextPages = pages.filter((page) => page.length > 0);
            const resolvedPages = nextPages.length > 0 ? nextPages : [[]];
            setMultiPageLayouts((prev) => (
                arePositionedLayoutsEqual(prev, resolvedPages) ? prev : resolvedPages
            ));
        };
        const measure = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(runMeasure);
        };

        measure();
        const stopObserving = observePaginationMeasurements(container, "[data-layout-measure]", measure);

        return () => {
            stopObserving();
            cancelAnimationFrame(raf);
        };
    }, [
        hasContent,
        useStructuredPreview,
        paginationContentHeight,
        layoutContentWidth,
        leftColumnWidth,
        rightColumnWidth,
        columnGap,
        layoutSectionGap,
        profilePlacement,
        profileSectionNode,
        orderedStructuredItems,
        structuredSectionPlacements,
        resumeLayoutSignature,
        fullscreen,
    ]);

    useEffect(() => {
        if (!isInteractiveDesignPreview) {
            return;
        }

        const nextPageCount = useStructuredPreview
            ? Math.max(multiPageLayouts.length, 1)
            : Math.max(pageChunks.length, 1);

        setPreviewPageCount(nextPageCount);
    }, [isInteractiveDesignPreview, multiPageLayouts.length, pageChunks.length, setPreviewPageCount, useStructuredPreview]);

    useEffect(() => {
        const pageCount = Math.max(
            useStructuredPreview ? multiPageLayouts.length : pageChunks.length,
            1,
        );
        contentSizeRef.current = {
            width: paper.width * scale,
            height: paper.height * scale * pageCount + PREVIEW_PAGE_GAP_PX * (pageCount - 1),
        };
        const bounds = computePanBounds(viewportRef.current, contentSizeRef.current);
        const clamped = clampPan(panRef.current, bounds);
        if (clamped.x !== panRef.current.x || clamped.y !== panRef.current.y) {
            panRef.current = clamped;
            setPan(clamped);
        }
    }, [paper.width, paper.height, scale, pageChunks.length, multiPageLayouts.length, useStructuredPreview]);

    const parseFooterText = (text: string, pageIndex: number, totalPages: number) => {
        if (!text) return "";
        return text
            .replace(/\{\{name\}\}/gi, resume.basics?.name || "")
            .replace(/\{\{phone\}\}/gi, resume.basics?.phone || "")
            .replace(/\{\{email\}\}/gi, primaryEmail)
            .replace(/\{\{page\}\}/gi, String(pageIndex + 1))
            .replace(/\{\{pages\}\}/gi, String(totalPages));
    };

    const resolveSimpleFooterColumns = (pageIndex: number, totalPages: number) => {
        const fields = [
            footerSettings.showName ? (resume.basics?.name || "") : null,
            footerSettings.showPhone ? (resume.basics?.phone || "") : null,
            footerSettings.showEmail ? primaryEmail : null,
            footerSettings.showPageNumbers ? `${pageIndex + 1} / ${totalPages}` : null,
        ].filter((value): value is string => value !== null);

        if (fields.length === 0) {
            return null;
        }

        if (fields.length === 1) {
            return { left: fields[0], middle: "", right: "" };
        }

        if (fields.length === 2) {
            return { left: fields[0], middle: "", right: fields[1] };
        }

        return {
            left: fields[0],
            middle: fields.slice(1, -1).filter(Boolean).join(" • "),
            right: fields[fields.length - 1] || "",
        };
    };

    const renderFooter = (pageIndex: number, totalPages: number) => {
        const footerColumns = footerSettings.show
            ? {
                left: parseFooterText(footerSettings.left, pageIndex, totalPages),
                middle: parseFooterText(footerSettings.middle, pageIndex, totalPages),
                right: parseFooterText(footerSettings.right, pageIndex, totalPages),
            }
            : resolveSimpleFooterColumns(pageIndex, totalPages);

        if (!footerColumns) return null;

        return (
            <div
                className="absolute bottom-0 left-0 w-full flex items-end gap-4"
                style={{
                    height: footerHeightPx + marginVerticalPx,
                    padding: `0 ${marginHorizontalPx}px ${marginVerticalPx}px ${marginHorizontalPx}px`,
                    fontSize: `${settings.typography.fontSize}pt`,
                    lineHeight: settings.typography.lineHeight,
                    color: settings.colors.text,
                    fontFamily: settings.typography.fontFamily,
                    opacity: 0.6,
                    pointerEvents: "none",
                    boxSizing: "border-box",
                }}
            >
                <div className="flex-1 min-w-0 text-left whitespace-pre-wrap break-words">{footerColumns.left}</div>
                <div className="flex-1 min-w-0 text-center whitespace-pre-wrap break-words">{footerColumns.middle}</div>
                <div className="flex-1 min-w-0 text-right whitespace-pre-wrap break-words">{footerColumns.right}</div>
            </div>
        );
    };

    const renderDesignOverlayLayer = (pageIndex: number) => {
        const pageElements = designElements
            .filter((element: DesignElement) => element.pageIndex === pageIndex)
            .sort((left: DesignElement, right: DesignElement) => left.zIndex - right.zIndex);

        if (pageElements.length === 0) {
            return null;
        }

        return (
            <div className="pointer-events-none absolute inset-0 z-20" data-no-drag>
                {pageElements.map((element: DesignElement) => (
                    <DesignOverlayElementView
                        key={element.id}
                        element={element}
                        accentColor={settings.colors.accent}
                        pageWidth={pageContentWidth}
                        pageHeight={pageContentHeight}
                        pageScale={scale}
                        isSelected={isInteractiveDesignPreview && selectedDesignElementId === element.id}
                        interactive={isInteractiveDesignPreview}
                        onSelect={() => {
                            if (!isInteractiveDesignPreview) return;
                            setActiveDesignPage(pageIndex);
                            selectDesignElement(element.id);
                        }}
                        onCommit={(id, updates) => {
                            if (!isInteractiveDesignPreview) return;
                            updateDesignElement(id, updates);
                        }}
                        onUpdateStyle={(id, updates) => {
                            if (!isInteractiveDesignPreview) return;
                            updateDesignElementStyle(id, updates);
                        }}
                        onDuplicate={(id) => {
                            if (!isInteractiveDesignPreview) return;
                            duplicateDesignElement(id);
                        }}
                        onMoveLayer={(id, direction) => {
                            if (!isInteractiveDesignPreview) return;
                            moveDesignElementLayer(id, direction);
                        }}
                        onDelete={(id) => {
                            if (!isInteractiveDesignPreview) return;
                            removeDesignElement(id);
                        }}
                    />
                ))}
            </div>
        );
    };

    const previewContent = (
      <InlineEditProvider>
       <InlineInteractiveContext.Provider value={inlineEditable}>
        <div className={`${scopeClass} relative`}>
            <style>{scopedStyles}</style>
            {inlineEditable && <InlineToolbar />}

            {navMenu && !thumbnailMode && (
                <PreviewNavMenu
                    x={navMenu.x}
                    y={navMenu.y}
                    kind={navMenu.kind}
                    onGo={() => { requestEditorNav(navMenu.section, navMenu.entryIndex); setNavMenu(null); }}
                    onCustomize={navMenu.section === "basics"
                        ? undefined
                        : () => {
                            requestCustomizeSection(navMenu.section);
                            setNavMenu(null);
                        }}
                    onClose={() => setNavMenu(null)}
                />
            )}

            {/* Hidden off-screen measuring container — renders all blocks at full paper width to measure heights */}
            {!useStructuredPreview ? (
                <div
                    ref={measureRef}
                    data-testid="resume-preview-measure"
                    aria-hidden="true"
                    className="resume-document flex flex-col"
                    style={{
                        position: 'absolute',
                        left: -9999,
                        top: 0,
                        width: pageContentWidth,
                        visibility: 'hidden',
                        pointerEvents: 'none',
                        boxSizing: 'border-box',
                    }}
                >
                  <InlineInteractiveContext.Provider value={false}>
                    {resumeBlocks.map((block, idx) => (
                        <div
                            key={block.key}
                            data-page-block={idx}
                            data-page-block-key={block.key}
                            data-page-block-kind={block.kind}
                            data-page-block-section={block.section ?? ""}
                            style={{ display: 'flow-root' }}
                        >
                            {block.node}
                        </div>
                    ))}
                  </InlineInteractiveContext.Provider>
                </div>
            ) : (
                <div
                    ref={multiMeasureRef}
                    data-testid="resume-preview-structured-measure"
                    aria-hidden="true"
                    className="resume-document"
                    style={{
                        position: 'absolute',
                        left: -9999,
                        top: 0,
                        width: pageContentWidth,
                        visibility: 'hidden',
                        pointerEvents: 'none',
                        boxSizing: 'border-box',
                    }}
                >
                  <InlineInteractiveContext.Provider value={false}>
                    <div
                        data-layout-measure="basic:profile"
                        style={{
                            width: profilePlacement === "full"
                                ? layoutContentWidth
                                : (profilePlacement === "left" ? leftColumnWidth : rightColumnWidth),
                        }}
                    >
                        {profileSectionNode}
                    </div>
                    {orderedStructuredItems.map((item) => {
                        if (item.kind === "page-break") {
                            return null;
                        }

                        if (item.kind === "section-pair") {
                            if (!item.leftSection || !item.rightSection) return null;
                            return (
                                <div key={`measure-${item.key}`} data-layout-measure={item.key} style={{ width: layoutContentWidth }}>
                                    {renderPairedSections(item.key, item.leftSection, item.rightSection)}
                                </div>
                            );
                        }

                        if (item.kind === "vertical-separator") {
                            return (
                                <div key={`measure-${item.key}`} data-layout-measure={item.key} style={{ width: layoutContentWidth }}>
                                    {renderLayoutVerticalSeparator(item.key)}
                                </div>
                            );
                        }

                        if (item.kind === "separator") {
                            return (
                                <div key={`measure-${item.key}`} data-layout-measure={item.key} style={{ width: layoutContentWidth }}>
                                    {renderLayoutSeparator(item.key)}
                                </div>
                            );
                        }

                        const section = item.section;
                        if (!section) return null;

                        const placement = structuredSectionPlacements[section.key];
                        const sectionWidth = placement === "full"
                            ? layoutContentWidth
                            : (placement === "left" ? leftColumnWidth : rightColumnWidth);
                        return (
                            <div key={`measure-${section.key}`}>
                                <div data-layout-measure={`${section.key}:heading`} style={{ width: sectionWidth }}>
                                    {section.headingNode}
                                </div>
                                {section.entryNodes.map((entryNode, index) => (
                                    <div key={`${section.key}:measure-entry:${index}`} data-layout-measure={`${section.key}:entry:${index}`} style={{ width: sectionWidth, display: "flow-root" }}>
                                        {entryNode}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                  </InlineInteractiveContext.Provider>
                </div>
            )}

            {/* Scroll wrapper */}
            <div
                className={`flex flex-col items-center print-exact-scroll-wrapper ${thumbnailMode ? "p-0 gap-0" : "py-6 gap-8"}`}
                onPointerDown={(event) => {
                    if (!isInteractiveDesignPreview || !selectedDesignElementId) return;
                    const target = event.target as HTMLElement;
                    if (target.closest("[data-design-element], [data-design-toolbar], .enginecv-design-moveable")) return;
                    clearDesignSelection();
                }}
                style={{
                    minHeight: "100%",
                    transform: thumbnailMode ? undefined : `translate(${pan.x}px, ${pan.y}px)`,
                    willChange: 'transform',
                    contain: 'layout style',
                }}
            >
                {!useStructuredPreview ? pageChunks.map((blockIndices, pageIdx) => (
                    <div
                        key={pageIdx}
                        data-testid={`resume-preview-page-${pageIdx + 1}`}
                        data-preview-page={pageIdx + 1}
                        className="resume-page bg-white text-black shadow-2xl shrink-0 print-exact-page-wrapper"
                        style={{
                            width: paper.width,
                            height: paper.height,
                            zoom: scale,
                            border: pageBorderWidth > 0 ? `${pageBorderWidth}px solid ${settings.colors.accent}` : 'none',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                            contain: 'strict',
                        }}
                    >
                        <div
                            className="w-full flex flex-col resume-document"
                            style={{
                                minHeight: pageContentHeight,
                                height: '100%',
                                boxSizing: 'border-box',
                                position: "relative",
                            }}
                        >
                            {blockIndices.map((idx) => {
                                const block = resumeBlocks[idx];
                                if (!block) return null;

                                return (
                                    <div
                                        key={block.key}
                                        data-page-block-key={block.key}
                                        data-page-block-kind={block.kind}
                                        data-page-block-section={block.section ?? ""}
                                        data-nav-section={block.navSection}
                                        data-nav-entry-index={block.navEntryIndex}
                                        data-nav-kind={block.navSection ? (block.kind === "section-heading" ? "heading" : "entry") : undefined}
                                        style={{ display: 'flow-root' }}
                                    >
                                        {block.node}
                                    </div>
                                );
                            })}
                            {renderFooter(pageIdx, pageChunks.length)}
                            {renderDesignOverlayLayer(pageIdx)}
                        </div>
                    </div>
                )) : multiPageLayouts.map((pageItems, pageIdx) => (
                    <div
                        key={pageIdx}
                        data-testid={`resume-preview-page-${pageIdx + 1}`}
                        data-preview-page={pageIdx + 1}
                        className="resume-page bg-white text-black shadow-2xl shrink-0 print-exact-page-wrapper"
                        style={{
                            width: paper.width,
                            height: paper.height,
                            zoom: scale,
                            border: pageBorderWidth > 0 ? `${pageBorderWidth}px solid ${settings.colors.accent}` : 'none',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                            contain: 'strict',
                        }}
                    >
                        <div
                            className="resume-document"
                            style={{
                                minHeight: pageContentHeight,
                                height: '100%',
                                boxSizing: 'border-box',
                                position: "relative",
                            }}
                        >
                            <div className="relative w-full h-full">
                                {pageItems.map((item) => (
                                    <div
                                        key={item.key}
                                        data-preview-layout-item={item.key}
                                        style={{
                                            position: 'absolute',
                                            left: item.x,
                                            top: item.y,
                                            width: item.width,
                                        }}
                                    >
                                        {renderLayoutItemNode(item.render)}
                                    </div>
                                ))}
                                {renderDesignOverlayLayer(pageIdx)}
                            </div>
                            {renderFooter(pageIdx, multiPageLayouts.length)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
       </InlineInteractiveContext.Provider>
      </InlineEditProvider>
    );

    // Fullscreen: fixed overlay covering the entire viewport
    if (fullscreen) {
        return (
            <>
                {/* Keep the inline container so the panel layout doesn't collapse */}
                <div className="w-full h-full" />

                {/* Fullscreen overlay */}
                <div
                    ref={containerRef}
                    className="fixed inset-0 z-[100] bg-surface-2 overflow-auto print:hidden"
                    onClick={(e) => {
                        // Click on backdrop (not on the page) exits fullscreen, but not after dragging
                        if (e.target === e.currentTarget && !didDrag.current) setFullscreen(false);
                    }}
                >
                    {controlButtons}
                    {previewContent}
                </div>
            </>
        );
    }

    if (thumbnailMode) {
        return (
            <div
                ref={containerRef}
                className="w-full h-full overflow-hidden relative pointer-events-none select-none print:overflow-visible print:block"
                data-thumbnail-mode="true"
                inert
                aria-hidden="true"
            >
                {previewContent}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="w-full h-full overflow-auto group relative print:overflow-visible print:block"
        >
            {controlButtons}
            {previewContent}
        </div>
    );
}
