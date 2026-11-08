import { useResumeStore } from "@/lib/store";
import { createId } from "@/lib/id";
import { useTranslation } from "@/lib/i18n";
import { CV_LANGUAGE_OPTIONS, formatCvDate, getDefaultCvDateFormat } from "@/lib/cv-language";
import { Type, Layout, Palette, AlignLeft, AlignCenter, AlignRight, ChevronDown, ChevronLeft, ChevronRight, Check, Plus, Link, Italic, Underline, Strikethrough, Heading, RotateCcw, Globe, Search, GripVertical, Briefcase, GraduationCap, Award, FolderGit2, Code2, Minus, Maximize2, Circle, Type as TypeIcon, Image as ImageIcon, Square, Users, Contact, PenLine, Puzzle, Heart, BookOpen, Trash2, List, LayoutTemplate, Undo2 } from "lucide-react";
import { TemplateBrowserDialog } from "./TemplateBrowserDialog";
import { arrayMove, SortableList } from "@/components/ui/sortable";
import { TemplatePreviewCard } from "@/components/templates/TemplatePreviewCard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getBuiltinTemplates } from "@/lib/templates/enginecv-templates";
import { FONT_ROLES, PRESET_FONTS, type FontRole, type RoleFonts, roleRef, parseRoleRef, getRoleFonts } from "@/lib/fonts";
import { getVisibleContentKeys } from "@/lib/preview/visibility";
import { hasSectionStyleOverride, resolveSectionSettings } from "@/lib/customization";
import type { ResumeSettings, SectionStyleKey } from "@/lib/schema";
import type { LucideIcon } from "lucide-react";
import { createContext, useContext, useId, useState, useRef, useEffect, useMemo, type ChangeEvent, type ReactNode } from "react";
import {
    CUSTOMIZE_GROUPS,
    CUSTOMIZE_SECTION_BY_ID,
    isCustomizeSectionKey,
    type CustomizeScope,
    type CustomizeSectionKey,
} from "./customize-section-registry";
import {
    DEFAULT_DESIGN_BORDER,
    DEFAULT_DESIGN_SETTINGS,
    DEFAULT_DESIGN_STYLE,
    DESIGN_OBJECT_FITS,
    type DesignElement,
    type DesignElementType,
    type DesignObjectFit,
} from "@/lib/design";

// ---------------------------------------------------
// Reusable TextStyleToolbar (weight/italic/underline/strikethrough + capitalization)
// ---------------------------------------------------

interface TextStyleToolbarProps {
    fontWeight: DesignElement["style"]["fontWeight"];
    fontStyle: DesignElement["style"]["fontStyle"];
    textDecoration: DesignElement["style"]["textDecoration"];
    textTransform?: DesignElement["style"]["textTransform"];
    showTextTransform?: boolean;
    showWeightPicker?: boolean;
    onChange: (
        updates: Partial<Pick<DesignElement["style"], "fontWeight" | "fontStyle" | "textDecoration" | "textTransform">>
    ) => void;
}

const CAPS_OPTIONS = [
    { value: "none", label: "Aa" },
    { value: "uppercase", label: "AA" },
    { value: "capitalize", label: "Aa" },
    { value: "lowercase", label: "aa" },
] as const;

const FONT_WEIGHT_OPTIONS = [
    { value: "100", labelKey: "editor.fontThin", preview: "100" },
    { value: "200", labelKey: "editor.fontExtraLight", preview: "200" },
    { value: "300", labelKey: "editor.fontLight", preview: "300" },
    { value: "400", labelKey: "editor.fontRegular", preview: "400" },
    { value: "500", labelKey: "editor.fontMedium", preview: "500" },
    { value: "600", labelKey: "editor.fontSemiBold", preview: "600" },
    { value: "700", labelKey: "editor.fontBold", preview: "700" },
    { value: "800", labelKey: "editor.fontExtraBold", preview: "800" },
    { value: "900", labelKey: "editor.fontBlack", preview: "900" },
    { value: "1000", labelKey: "editor.fontUltra", preview: "1000" },
] as const;

const LEGACY_WEIGHT_TO_NUMERIC: Record<string, DesignElement["style"]["fontWeight"]> = {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
};

const PX_PER_IN = 96;
const MM_PER_IN = 25.4;
const PX_PER_PT = 96 / 72;

function formatDisplayNumber(value: number, decimals = 2) {
    const fixed = value.toFixed(decimals);
    return fixed.replace(/\.?0+$/, "");
}

function mmToPx(value: number) {
    return (value / MM_PER_IN) * PX_PER_IN;
}

function mmToIn(value: number) {
    return value / MM_PER_IN;
}

function ptToPx(value: number) {
    return value * PX_PER_PT;
}

function pxToPt(value: number) {
    return value / PX_PER_PT;
}

function formatPhysicalLengthFromMm(value: number, measurementSystem: "metric" | "imperial") {
    return measurementSystem === "imperial"
        ? `${formatDisplayNumber(mmToIn(value))}in`
        : `${formatDisplayNumber(value)}mm`;
}

function formatLengthWithPxFromMm(value: number, measurementSystem: "metric" | "imperial") {
    return `${formatDisplayNumber(mmToPx(value))}px • ${formatPhysicalLengthFromMm(value, measurementSystem)}`;
}

function formatLengthFromPx(value: number, measurementSystem: "metric" | "imperial") {
    const physicalValue = measurementSystem === "imperial"
        ? `${formatDisplayNumber(value / PX_PER_IN)}in`
        : `${formatDisplayNumber((value / PX_PER_IN) * MM_PER_IN)}mm`;

    return `${formatDisplayNumber(value)}px • ${physicalValue}`;
}

function formatPointSizeWithPx(value: number) {
    return `${formatDisplayNumber(value)}pt • ${formatDisplayNumber(ptToPx(value))}px`;
}

function FontWeightSelect({
    value,
    onChange,
}: {
    value: DesignElement["style"]["fontWeight"];
    onChange: (val: DesignElement["style"]["fontWeight"]) => void;
}) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("pointerdown", handleClickOutside);
        return () => document.removeEventListener("pointerdown", handleClickOutside);
    }, []);

    const normalizedValue = LEGACY_WEIGHT_TO_NUMERIC[value] || value;
    const selected = FONT_WEIGHT_OPTIONS.find((opt) => opt.value === normalizedValue) || FONT_WEIGHT_OPTIONS[3];

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="touch-manipulation h-8 min-w-[90px] bg-surface-1 border border-edge rounded-lg px-2.5 text-xs text-strong/90 hover:text-strong hover:border-faint transition-colors flex items-center justify-between gap-2"
            >
                <span className="truncate">{t(selected.labelKey)}</span>
                <ChevronDown className="w-3.5 h-3.5 text-faint shrink-0" />
            </button>

            {isOpen && (
                <div className="absolute left-0 top-full mt-2 z-50 w-44 bg-surface-4 border border-edge rounded-xl shadow-xl overflow-hidden py-1 max-h-80 overflow-y-auto">
                    {FONT_WEIGHT_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-edge flex items-center justify-between transition-colors gap-2"
                        >
                            <span className={`truncate flex-1 min-w-0 ${normalizedValue === opt.value ? "text-accent font-medium" : "text-strong"}`}>
                                {t(opt.labelKey)}
                            </span>
                            {normalizedValue === opt.value ? (
                                <Check className="w-4 h-4 text-accent shrink-0" />
                            ) : (
                                <span className="text-[11px] text-faint shrink-0">{opt.preview}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function TextStyleToolbar({ fontWeight, fontStyle, textDecoration, textTransform, showTextTransform, showWeightPicker = true, onChange }: TextStyleToolbarProps) {
    const { t } = useTranslation();
    const btn = (active: boolean) =>
        `w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-medium transition-colors ${active
            ? "bg-edge border-accent text-strong"
            : "bg-surface-1 border-edge text-faint hover:text-strong hover:border-faint"
        }`;

    return (
        <div className="flex items-center gap-1.5">
            {showWeightPicker && (
                <>
                    <FontWeightSelect value={fontWeight} onChange={(next) => onChange({ fontWeight: next })} />
                    <div className="w-px h-5 bg-edge mx-0.5" />
                </>
            )}
            <button type="button" title={t("customize.italic")} onClick={() => onChange({ fontStyle: fontStyle === "italic" ? "normal" : "italic" })} className={btn(fontStyle === "italic")}>
                <Italic className="w-3.5 h-3.5" />
            </button>
            <button type="button" title={t("customize.underline")} onClick={() => onChange({ textDecoration: textDecoration === "underline" ? "none" : "underline" })} className={btn(textDecoration === "underline")}>
                <Underline className="w-3.5 h-3.5" />
            </button>
            <button type="button" title={t("customize.strikethrough")} onClick={() => onChange({ textDecoration: textDecoration === "line-through" ? "none" : "line-through" })} className={btn(textDecoration === "line-through")}>
                <Strikethrough className="w-3.5 h-3.5" />
            </button>
            {showTextTransform && (
                <>
                    <div className="w-px h-5 bg-edge mx-0.5" />
                    {CAPS_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            title={opt.value === "none" ? t("customize.normal") : opt.value === "uppercase" ? t("customize.textTransformUppercase") : opt.value === "capitalize" ? t("customize.capitalize") : t("customize.lowercase")}
                            onClick={() => onChange({ textTransform: opt.value })}
                            className={btn(textTransform === opt.value)}
                        >
                            <span className="text-[10px] font-bold leading-none">{opt.label}</span>
                        </button>
                    ))}
                </>
            )}
        </div>
    );
}

// ---------------------------------------------------
// FontSelect dropdown
// ---------------------------------------------------

const FONT_ROLE_LABEL_KEYS: Record<FontRole, string> = {
    primary: "customize.fontRolePrimary",
    secondary: "customize.fontRoleSecondary",
    mono: "customize.fontRoleMono",
};

function FontSelect({
    value,
    customFonts,
    showInherit,
    inheritLabel,
    roleFonts,
    onChange
}: {
    value: string,
    customFonts: Array<{ name: string, url: string }>,
    showInherit?: boolean,
    inheritLabel?: string,
    // When provided, the dropdown offers "use a global font role" options and
    // renders role-reference values ("var:<role>") with the role's font.
    roleFonts?: RoleFonts | null,
    onChange: (val: string) => void
}) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("pointerdown", handleClickOutside);
        return () => document.removeEventListener("pointerdown", handleClickOutside);
    }, []);

    const isInherited = value === "";
    const activeRole = parseRoleRef(value);
    const customFontNames = customFonts.map(f => f.name);
    const isCustom = customFontNames.includes(value);

    // The font used to visually preview the current selection in the trigger.
    const previewFamily = activeRole && roleFonts ? roleFonts[activeRole] : (isInherited ? undefined : value);
    const triggerLabel = isInherited
        ? (inheritLabel || t("customize.inherit"))
        : activeRole
            ? t(FONT_ROLE_LABEL_KEYS[activeRole])
            : value;

    return (
        <div className="relative mb-3" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="touch-manipulation w-full bg-surface-1 border border-edge rounded-xl px-3 py-2.5 text-sm text-strong focus:outline-none focus:border-faint transition-colors flex items-center justify-between"
                style={{ fontFamily: previewFamily }}
            >
                <span className="truncate pr-2 flex items-center gap-1.5">
                    {triggerLabel}
                    {isInherited && <RotateCcw className="w-3 h-3 text-faint shrink-0" />}
                    {activeRole && <Type className="w-3.5 h-3.5 text-accent shrink-0" />}
                    {isCustom && <Link className="w-3.5 h-3.5 text-accent shrink-0" />}
                </span>
                <ChevronDown className="w-4 h-4 text-faint shrink-0" />
            </button>

            {isOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-surface-4 border border-edge rounded-xl shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {showInherit && (
                        <>
                            <button
                                type="button"
                                onClick={() => { onChange(""); setIsOpen(false); }}
                                className="w-full text-left px-3 py-2 text-sm text-strong hover:bg-edge flex items-center justify-between transition-colors"
                            >
                                <span className="flex items-center gap-1.5 text-faint">
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    {inheritLabel || t("customize.inherit")}
                                </span>
                                {isInherited && <Check className="w-4 h-4 text-accent" />}
                            </button>
                            <div className="h-px bg-edge my-1 mx-2" />
                        </>
                    )}
                    {roleFonts && (
                        <>
                            <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">{t("customize.fontRoles")}</div>
                            {FONT_ROLES.map(role => (
                                <button
                                    key={role}
                                    type="button"
                                    onClick={() => { onChange(roleRef(role)); setIsOpen(false); }}
                                    className="w-full text-left px-3 py-2 text-sm text-strong hover:bg-edge flex items-center justify-between transition-colors"
                                    style={{ fontFamily: roleFonts[role] }}
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Type className="w-3.5 h-3.5 text-accent shrink-0" />
                                        {t(FONT_ROLE_LABEL_KEYS[role])}
                                        <span className="text-faint">· {roleFonts[role]}</span>
                                    </span>
                                    {activeRole === role && <Check className="w-4 h-4 text-accent" />}
                                </button>
                            ))}
                            <div className="h-px bg-edge my-1 mx-2" />
                        </>
                    )}
                    {PRESET_FONTS.map(font => (
                        <button
                            key={font}
                            type="button"
                            onClick={() => { onChange(font); setIsOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-strong hover:bg-edge flex items-center justify-between transition-colors"
                            style={{ fontFamily: font }}
                        >
                            <span>{font}</span>
                            {value === font && <Check className="w-4 h-4 text-accent" />}
                        </button>
                    ))}
                    {customFonts.length > 0 && (
                        <>
                            <div className="h-px bg-edge my-1 mx-2" />
                            {customFonts.map(font => (
                                <button
                                    key={font.name}
                                    type="button"
                                    onClick={() => { onChange(font.name); setIsOpen(false); }}
                                    className="w-full text-left px-3 py-2 text-sm text-strong hover:bg-edge flex items-center justify-between transition-colors"
                                    style={{ fontFamily: font.name }}
                                >
                                    <span className="flex items-center gap-1.5">
                                        {font.name}
                                        <Link className="w-3 h-3 text-accent shrink-0" />
                                    </span>
                                    {value === font.name && <Check className="w-4 h-4 text-accent" />}
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------
// Generic Select dropdown
// ---------------------------------------------------

function Select({
    value,
    options,
    onChange,
    testId,
    optionTestIdPrefix,
    searchable = false,
    compact = false,
}: {
    value: string,
    options: Array<{ value: string, label: string, preview?: string }>,
    onChange: (val: string) => void,
    testId?: string,
    optionTestIdPrefix?: string,
    searchable?: boolean,
    compact?: boolean,
}) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("pointerdown", handleClickOutside);
        return () => document.removeEventListener("pointerdown", handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.value === value)?.label || value;
    const filteredOptions = useMemo(() => {
        if (!searchable) {
            return options;
        }

        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            return options;
        }

        return options.filter((option) => option.label.toLowerCase().includes(query));
    }, [options, searchQuery, searchable]);

    return (
        <div className={`relative ${compact ? "" : "mb-3"}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => {
                    setIsOpen((previous) => {
                        const next = !previous;
                        if (next) {
                            setSearchQuery("");
                        }
                        return next;
                    });
                }}
                data-testid={testId}
                className={`touch-manipulation flex w-full items-center justify-between border text-strong transition-colors focus:outline-none focus:border-faint ${
                    compact
                        ? "h-8 rounded-md border-transparent bg-transparent px-2 py-1.5 text-xs hover:bg-surface-3"
                        : "rounded-xl border-edge bg-surface-1 px-3 py-2.5 text-xs sm:text-sm"
                }`}
            >
                <span className="truncate pr-2">{selectedLabel}</span>
                <ChevronDown className="w-4 h-4 text-faint shrink-0" />
            </button>

            {isOpen && (
                <div className={`absolute left-0 right-0 top-full z-50 max-h-60 overflow-y-auto border border-edge bg-surface-4 py-1 shadow-xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${
                    compact ? "mt-1 rounded-lg" : "mt-2 rounded-xl"
                }`}>
                    {searchable && (
                        <div className="px-2 pb-2">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder={t("customize.searchLanguages")}
                                className="w-full bg-surface-1 border border-edge rounded-lg px-3 py-2 text-sm text-strong placeholder:text-faint focus:outline-none focus:border-faint"
                            />
                        </div>
                    )}
                    {filteredOptions.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                                onChange(opt.value);
                                setSearchQuery("");
                                setIsOpen(false);
                            }}
                            data-testid={optionTestIdPrefix ? `${optionTestIdPrefix}-${opt.value}` : undefined}
                            className={`flex w-full items-center justify-between gap-2 text-left transition-colors hover:bg-edge ${
                                compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"
                            }`}
                        >
                            <span className={`truncate flex-1 min-w-0 ${value === opt.value ? 'text-accent font-medium' : 'text-strong'}`}>{opt.label}</span>
                            {opt.preview ? (
                                <span className="text-[11px] text-faint shrink-0">{opt.preview}</span>
                            ) : (
                                value === opt.value && <Check className="w-4 h-4 text-accent shrink-0" />
                            )}
                        </button>
                    ))}
                    {filteredOptions.length === 0 && (
                        <div className="px-3 py-2 text-sm text-faint">
                            {t("customize.noResults")}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------
// Proportions Slider
// ---------------------------------------------------

function ProportionsSlider({
    left,
    middle,
    right,
    onChange
}: {
    left: number;
    middle: number;
    right: number;
    onChange: (l: number, m: number, r: number) => void;
}) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<"thumb1" | "thumb2" | null>(null);

    useEffect(() => {
        if (!dragging) return;

        const handlePointerMove = (e: PointerEvent) => {
            if (!trackRef.current) return;
            const rect = trackRef.current.getBoundingClientRect();
            let p = ((e.clientX - rect.left) / rect.width) * 100;

            if (dragging === "thumb1") {
                p = Math.max(10, Math.min(p, 100 - right - 10));
                p = Math.round(p);
                if (p !== left) {
                    onChange(p, 100 - right - p, right);
                }
            } else if (dragging === "thumb2") {
                p = Math.max(left + 10, Math.min(p, 90));
                p = Math.round(p);
                if (p !== left + middle) {
                    onChange(left, p - left, 100 - p);
                }
            }
        };

        const handlePointerUp = () => setDragging(null);

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, [dragging, left, middle, right, onChange]);

    const p1 = left;
    const p2 = left + middle;

    return (
        <div 
            className="relative h-6 flex items-center select-none w-full group" 
            ref={trackRef}
            style={{ touchAction: 'none' }}
        >
            {/* Tracks */}
            <div className="absolute inset-y-0 left-0 h-1.5 my-auto bg-faint rounded-l-full transition-all duration-75" style={{ width: `${p1}%` }} />
            <div className="absolute inset-y-0 h-1.5 my-auto bg-accent transition-all duration-75" style={{ left: `${p1}%`, width: `${middle}%` }} />
            <div className="absolute inset-y-0 right-0 h-1.5 my-auto bg-faint rounded-r-full transition-all duration-75" style={{ width: `${right}%` }} />
            
            {/* Thumb 1 */}
            <div 
                className="absolute w-4 h-4 bg-white rounded-full shadow cursor-ew-resize top-1/2 -translate-y-1/2 -translate-x-1/2 hover:scale-110 active:scale-95 transition-transform z-10 opacity-0 group-hover:opacity-100 peer"
                style={{ left: `${p1}%`, touchAction: 'none', opacity: dragging === 'thumb1' ? 1 : undefined }}
                onPointerDown={(e) => { e.preventDefault(); setDragging("thumb1"); }}
            >
                <div className="absolute inset-[-8px] opacity-0" /> {/* Hitbox */}
            </div>
            
            {/* Thumb 2 */}
            <div 
                className="absolute w-4 h-4 bg-white rounded-full shadow cursor-ew-resize top-1/2 -translate-y-1/2 -translate-x-1/2 hover:scale-110 active:scale-95 transition-transform z-10 opacity-0 group-hover:opacity-100"
                style={{ left: `${p2}%`, touchAction: 'none', opacity: dragging === 'thumb2' ? 1 : undefined }}
                onPointerDown={(e) => { e.preventDefault(); setDragging("thumb2"); }}
            >
                <div className="absolute inset-[-8px] opacity-0" /> {/* Hitbox */}
            </div>
        </div>
    );
}

// ---------------------------------------------------
// Tick Slider
// ---------------------------------------------------

function TickSlider({
    value,
    min,
    max,
    step,
    onChange,
    ticks = 5,
}: {
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
    ticks?: number;
}) {
    const barRef = useRef<HTMLDivElement>(null);
    const handleDecrement = () => onChange(Math.max(min, value - step));
    const handleIncrement = () => onChange(Math.min(max, value + step));

    const computeValueFromX = (clientX: number) => {
        const rect = barRef.current?.getBoundingClientRect();
        if (!rect) return value;
        const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        let newValue = min + percent * (max - min);
        newValue = Math.round(newValue / step) * step;
        return Math.max(min, Math.min(max, newValue));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        onChange(computeValueFromX(e.clientX));
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (e.buttons === 0) return;
        onChange(computeValueFromX(e.clientX));
    };

    // Calculate progress percentage
    const progress = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

    return (
        <div className="flex gap-2 h-9">
            <div
                ref={barRef}
                className="flex-1 bg-surface-1 border border-edge rounded-xl overflow-hidden relative cursor-pointer group touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
            >
                {/* Progress Fill */}
                <div
                    className="absolute top-0 bottom-0 left-0 bg-accent"
                    style={{ width: `${progress}%` }}
                />

                {/* Visual Ticks Overlay */}
                <div className="absolute inset-0 flex items-center justify-around pointer-events-none px-2 z-10 mix-blend-difference">
                    {Array.from({ length: ticks - 1 }).map((_, i) => (
                        <div key={i} className="w-[1px] h-3 bg-faint/50" />
                    ))}
                </div>
            </div>

            <button
                onClick={handleDecrement}
                className="w-9 h-9 flex items-center justify-center bg-surface-1 border border-edge rounded-xl text-faint hover:text-strong hover:border-faint transition-colors shrink-0"
            >
                <Minus className="w-4 h-4" />
            </button>
            <button
                onClick={handleIncrement}
                className="w-9 h-9 flex items-center justify-center bg-surface-1 border border-edge rounded-xl text-faint hover:text-strong hover:border-faint transition-colors shrink-0"
            >
                <Plus className="w-4 h-4" />
            </button>
        </div>
    );
}

// ---------------------------------------------------
// Draggable Section List
// ---------------------------------------------------

const SECTION_LABELS: Record<string, { labelKey: string, icon: any }> = {
    experience: { labelKey: "customize.sectionExperience", icon: Briefcase },
    education: { labelKey: "customize.sectionEducation", icon: GraduationCap },
    certificates: { labelKey: "customize.sectionCertificates", icon: Award },
    projects: { labelKey: "customize.sectionProjects", icon: FolderGit2 },
    skills: { labelKey: "customize.sectionSkills", icon: Code2 },
    languages: { labelKey: "customize.sectionLanguages", icon: Globe },
    interests: { labelKey: "customize.sectionInterests", icon: Heart },
    courses: { labelKey: "customize.sectionCourses", icon: BookOpen },
    awards: { labelKey: "customize.sectionAwards", icon: Award },
    organisations: { labelKey: "customize.sectionOrganisations", icon: Users },
    publications: { labelKey: "customize.sectionPublications", icon: BookOpen },
    references: { labelKey: "customize.sectionReferences", icon: Contact },
    declaration: { labelKey: "customize.sectionDeclaration", icon: PenLine },
    custom: { labelKey: "customize.sectionCustom", icon: Puzzle },
};

const LAYOUT_SEPARATOR_PREFIX = "separator:";
const LAYOUT_VERTICAL_SEPARATOR_PREFIX = "vertical-separator:";
const LAYOUT_PAGE_BREAK_PREFIX = "pagebreak:";

interface LayoutSectionItem {
    key: string;
    base: string;
    label: string;
    caption: string;
    icon: any;
    isSeparator?: boolean;
    isVerticalSeparator?: boolean;
    isPageBreak?: boolean;
}

type SectionPlacement = "left" | "right" | "full";

function getSectionBaseId(sectionKey: string) {
    return sectionKey.split(":")[0];
}

function isLayoutSeparatorKey(sectionKey: string) {
    return getSectionBaseId(sectionKey) === "separator";
}

function isLayoutVerticalSeparatorKey(sectionKey: string) {
    return getSectionBaseId(sectionKey) === "vertical-separator";
}

function isLayoutPageBreakKey(sectionKey: string) {
    return getSectionBaseId(sectionKey) === "pagebreak";
}

function createLayoutSeparatorKey() {
    return `${LAYOUT_SEPARATOR_PREFIX}${createId()}`;
}

function createLayoutVerticalSeparatorKey() {
    return `${LAYOUT_VERTICAL_SEPARATOR_PREFIX}${createId()}`;
}

function createLayoutPageBreakKey() {
    return `${LAYOUT_PAGE_BREAK_PREFIX}${createId()}`;
}

function getDefaultSectionPlacement(index: number, mode: "two" | "mix"): SectionPlacement {
    if (mode === "mix" && index === 0) return "full";
    return index % 2 === 0 ? "left" : "right";
}

function normalizeSectionPlacement(value: string | undefined, index: number, mode: "two" | "mix"): SectionPlacement {
    if (mode === "two") {
        return value === "right" ? "right" : getDefaultSectionPlacement(index, "two");
    }

    if (value === "left" || value === "right" || value === "full") {
        return value;
    }

    return getDefaultSectionPlacement(index, "mix");
}

function resolveLayoutSectionOrder(order: string[], items: LayoutSectionItem[]) {
    const itemMap = new Map(items.map((item) => [item.key, item]));
    const used = new Set<string>();
    const resolved: string[] = [];

    order.forEach((entry) => {
        if (entry === "basic") {
            return;
        }

        if (itemMap.has(entry) && !used.has(entry)) {
            resolved.push(entry);
            used.add(entry);
            return;
        }

        const legacyBase = getSectionBaseId(entry);
        const match = items.find((item) => item.base === legacyBase && !used.has(item.key));
        if (match) {
            resolved.push(match.key);
            used.add(match.key);
        }
    });

    items.forEach((item) => {
        if (!used.has(item.key)) {
            resolved.push(item.key);
            used.add(item.key);
        }
    });

    return resolved;
}

function DraggableSectionList({
    order,
    items,
    layoutMode,
    placements,
    onChange,
    onPlacementChange,
    onRemove,
}: {
    order: string[],
    items: LayoutSectionItem[],
    layoutMode: "one" | "two" | "mix",
    placements: Record<string, SectionPlacement>,
    onChange: (newOrder: string[]) => void,
    onPlacementChange: (key: string, placement: SectionPlacement) => void,
    onRemove: (key: string) => void,
}) {
    const { t } = useTranslation();
    const validOrder = resolveLayoutSectionOrder(order, items);
    const itemMap = new Map(items.map((item) => [item.key, item]));
    const contentIndexMap = new Map<string, number>();
    let contentIndex = 0;

    validOrder.forEach((key) => {
        const item = itemMap.get(key);
        if (!item || item.isSeparator || item.isVerticalSeparator || item.isPageBreak) return;
        contentIndexMap.set(key, contentIndex);
        contentIndex += 1;
    });

    const moveSection = (index: number, dir: "up" | "down") => {
        const nextIndex = dir === "up" ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= validOrder.length) return;
        const next = [...validOrder];
        [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
        onChange(next);
    };

    return (
        <div className="space-y-2 mt-2">
            <SortableList
                items={validOrder}
                getId={(key) => key}
                onReorder={(from, to) => onChange(arrayMove(validOrder, from, to))}
                describe={(key) => itemMap.get(key)?.label ?? key}
            >
            {(key, index, { itemProps, handleProps, isDragging }) => {
                const item = itemMap.get(key);
                if (!item) return null;
                const { label, caption, icon: Icon } = item;
                const placement = item.isSeparator || item.isVerticalSeparator || item.isPageBreak || layoutMode === "one"
                    ? null
                    : normalizeSectionPlacement(
                        placements[key] || placements[item.base],
                        contentIndexMap.get(key) ?? index,
                        layoutMode,
                    );
                return (
                    <div
                        {...itemProps}
                        data-testid={`section-order-row-${key}`}
                        className={`flex items-center justify-between gap-3 bg-surface-1 border rounded-xl px-3 py-3 hover:border-faint transition-colors ${isDragging ? "border-accent shadow-lg" : "border-edge"}`}
                    >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <button
                                type="button"
                                {...handleProps}
                                data-testid={`section-order-handle-${key}`}
                                aria-label={t("customize.dragFromHere")}
                                className="w-7 h-7 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint cursor-grab active:cursor-grabbing flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                title={t("customize.dragFromHere")}
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
                            <div className="w-9 h-9 rounded-xl border border-edge bg-surface-4 flex items-center justify-center shrink-0">
                                <Icon className="w-4 h-4 text-strong" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="text-sm font-medium text-strong truncate">{label}</div>
                                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-faint">
                                        {index + 1}
                                    </span>
                                </div>
                                <div className="text-[11px] text-faint truncate">{caption}</div>
                                {placement && (
                                    <div className="flex items-center gap-1.5 mt-2">
                                        {(layoutMode === "mix"
                                            ? ([
                                                { value: "full", label: t("customize.full") },
                                                { value: "left", label: t("customize.left") },
                                                { value: "right", label: t("customize.right") },
                                            ] as const)
                                            : ([
                                                { value: "left", label: t("customize.left") },
                                                { value: "right", label: t("customize.right") },
                                            ] as const)
                                        ).map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => onPlacementChange(key, option.value)}
                                                className={`px-2.5 h-7 rounded-lg border text-[11px] font-medium transition-colors ${placement === option.value
                                                    ? "bg-edge border-accent text-strong"
                                                    : "bg-surface-4 border-edge text-faint hover:text-strong hover:border-faint"
                                                    }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => onRemove(key)}
                                className={`w-7 h-7 rounded-lg border border-edge transition-colors flex items-center justify-center ${(item.isSeparator || item.isVerticalSeparator || item.isPageBreak)
                                    ? "text-faint hover:text-danger hover:border-danger/60"
                                    : "opacity-0 pointer-events-none"
                                    }`}
                                title={item.isPageBreak ? t("customize.removePageBreak") : item.isVerticalSeparator ? t("customize.removeVerticalSeparator") : t("customize.removeSeparator")}
                                aria-hidden={!(item.isSeparator || item.isVerticalSeparator || item.isPageBreak)}
                                tabIndex={item.isSeparator || item.isVerticalSeparator || item.isPageBreak ? 0 : -1}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => moveSection(index, "up")}
                                disabled={index === 0}
                                className="w-7 h-7 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint disabled:opacity-35 disabled:hover:text-faint disabled:hover:border-edge transition-colors flex items-center justify-center"
                            >
                                <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                            </button>
                            <button
                                type="button"
                                onClick={() => moveSection(index, "down")}
                                disabled={index === validOrder.length - 1}
                                className="w-7 h-7 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint disabled:opacity-35 disabled:hover:text-faint disabled:hover:border-edge transition-colors flex items-center justify-center"
                            >
                                <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                );
            }}
            </SortableList>
        </div>
    );
}

// ---------------------------------------------------
// Colors Section Helpers
// ---------------------------------------------------

// ---------------------------------------------------
// BorderEditor
// ---------------------------------------------------

interface BorderSettings {
    style: "solid" | "dotted" | "dashed";
    width: number;
    color: string;
    radius: number;
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
    dashLength: number;
    dashGap: number;
}

function BorderEditor({
    border,
    fallbackColor,
    onChange
}: {
    border: BorderSettings;
    fallbackColor: string;
    onChange: (updates: Partial<BorderSettings>) => void;
}) {
    const { t } = useTranslation();
    const sideBtn = (active: boolean) =>
        `w-8 h-8 flex items-center justify-center rounded-lg border text-[10px] font-bold transition-colors ${active
            ? "bg-edge border-accent text-strong"
            : "bg-surface-1 border-edge text-faint hover:text-strong hover:border-faint"
        }`;
    const styleBtn = (active: boolean) =>
        `flex-1 py-1.5 text-[10px] font-medium rounded-lg transition-colors ${active
            ? "bg-edge text-strong"
            : "text-faint hover:text-strong"
        }`;
    const showColor = border.color || fallbackColor;

    return (
        <div className="space-y-3">
            <div>
                <label className="text-[10px] text-faint mb-1.5 block">{t("customize.borderSides")}</label>
                <div className="flex gap-1.5">
                    <button type="button" onClick={() => onChange({ top: !border.top })} className={sideBtn(border.top)}>T</button>
                    <button type="button" onClick={() => onChange({ bottom: !border.bottom })} className={sideBtn(border.bottom)}>B</button>
                    <button type="button" onClick={() => onChange({ left: !border.left })} className={sideBtn(border.left)}>L</button>
                    <button type="button" onClick={() => onChange({ right: !border.right })} className={sideBtn(border.right)}>R</button>
                </div>
            </div>
            <div>
                <label className="text-[10px] text-faint mb-1.5 block">{t("customize.borderStyle")}</label>
                <div className="flex bg-surface-1 p-1 rounded-xl border border-edge">
                    {(["solid", "dotted", "dashed"] as const).map(s => (
                        <button key={s} type="button" onClick={() => onChange({ style: s })} className={styleBtn(border.style === s)}>
                            {t(`customize.border${s.charAt(0).toUpperCase() + s.slice(1)}`)}
                        </button>
                    ))}
                </div>
            </div>
            {border.style !== "solid" && (
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <div className="flex justify-between items-end mb-1.5">
                            <label className="text-[10px] text-faint">{t("customize.dashLength")}</label>
                            <span className="text-[10px] text-faint font-medium">{border.dashLength ?? 6}px</span>
                        </div>
                        <TickSlider value={border.dashLength ?? 6} onChange={(v) => onChange({ dashLength: v })} min={1} max={24} step={1} ticks={6} />
                    </div>
                    <div>
                        <div className="flex justify-between items-end mb-1.5">
                            <label className="text-[10px] text-faint">{t("customize.dashGap")}</label>
                            <span className="text-[10px] text-faint font-medium">{border.dashGap ?? 4}px</span>
                        </div>
                        <TickSlider value={border.dashGap ?? 4} onChange={(v) => onChange({ dashGap: v })} min={1} max={20} step={1} ticks={5} />
                    </div>
                </div>
            )}
            <div>
                <div className="flex justify-between items-end mb-1.5">
                    <label className="text-[10px] text-faint">{t("customize.borderWidth")}</label>
                    <span className="text-[10px] text-faint font-medium">{border.width}px</span>
                </div>
                <TickSlider value={border.width} onChange={(v) => onChange({ width: v })} min={0} max={6} step={0.5} ticks={7} />
            </div>
            <div>
                <label className="text-[10px] text-faint mb-1.5 block">{t("customize.borderColor")}</label>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onChange({ color: "" })}
                        className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${!border.color ? "bg-edge border-accent text-strong" : "bg-surface-1 border-edge text-faint hover:text-strong"}`}
                    >
                        {t("customize.inheritAccent")}
                    </button>
                    <div className="relative">
                        <div className="w-7 h-7 rounded-lg border border-edge cursor-pointer" style={{ backgroundColor: showColor }} />
                        <input
                            type="color"
                            value={showColor}
                            onInput={(e) => onChange({ color: (e.target as HTMLInputElement).value })}
                            onChange={(e) => onChange({ color: e.target.value })}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                    </div>
                </div>
            </div>
            <div>
                <div className="flex justify-between items-end mb-1.5">
                    <label className="text-[10px] text-faint">{t("customize.borderRadius")}</label>
                    <span className="text-[10px] text-faint font-medium">{border.radius}px</span>
                </div>
                <TickSlider value={border.radius} onChange={(v) => onChange({ radius: v })} min={0} max={16} step={1} ticks={9} />
            </div>
        </div>
    );
}

// ---------------------------------------------------
// AlignmentPicker
// ---------------------------------------------------

function AlignmentPicker({
    value,
    onChange
}: {
    value: "left" | "center" | "right";
    onChange: (val: "left" | "center" | "right") => void;
}) {
    const btn = (active: boolean) =>
        `flex-1 py-2 flex items-center justify-center rounded-lg transition-colors ${active
            ? "bg-edge text-strong"
            : "text-faint hover:text-strong"
        }`;

    return (
        <div className="flex bg-surface-1 p-1 rounded-xl border border-edge">
            <button type="button" onClick={() => onChange("left")} className={btn(value === "left")}><AlignLeft className="w-4 h-4" /></button>
            <button type="button" onClick={() => onChange("center")} className={btn(value === "center")}><AlignCenter className="w-4 h-4" /></button>
            <button type="button" onClick={() => onChange("right")} className={btn(value === "right")}><AlignRight className="w-4 h-4" /></button>
        </div>
    );
}

// ---------------------------------------------------
// Heading Presets
// ---------------------------------------------------

type HeadingPreset = {
    key: string;
    labelKey: string;
    settings: Record<string, any>;
};

type ContentStylePreset = {
    key: string;
    labelKey: string;
    settings: Record<string, any>;
};

const HEADING_PRESETS: HeadingPreset[] = [
    {
        key: "baseline",
        labelKey: "customize.presetBaseline",
        settings: {
            fontWeight: "700", fontStyle: "normal", textDecoration: "none",
            capitalization: "uppercase", textAlign: "left", letterSpacing: 0, lineHeight: 1.15,
            paddingTop: 0, paddingBottom: 4, paddingLeft: 0, paddingRight: 0, marginTop: 0, marginBottom: 12, marginLeft: 0, marginRight: 0,
            border: { style: "solid", width: 2, color: "", radius: 0, top: false, bottom: true, left: false, right: false, dashLength: 6, dashGap: 4 },
            backgroundColor: "", borderColor: "", preset: "baseline",
        },
    },
    {
        key: "clean",
        labelKey: "customize.presetClean",
        settings: {
            fontWeight: "700", fontStyle: "normal", textDecoration: "none",
            capitalization: "uppercase", textAlign: "left", letterSpacing: 0, lineHeight: 1.15,
            paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0, marginTop: 0, marginBottom: 12, marginLeft: 0, marginRight: 0,
            border: { style: "solid", width: 0, color: "", radius: 0, top: false, bottom: false, left: false, right: false },
            backgroundColor: "", preset: "clean",
        },
    },
    {
        key: "underline",
        labelKey: "customize.presetUnderline",
        settings: {
            fontWeight: "700", fontStyle: "normal", textDecoration: "none",
            capitalization: "uppercase", textAlign: "left", letterSpacing: 0, lineHeight: 1.15,
            paddingTop: 0, paddingBottom: 6, paddingLeft: 0, paddingRight: 0, marginTop: 0, marginBottom: 12, marginLeft: 0, marginRight: 0,
            border: { style: "dashed", width: 3, color: "", radius: 0, top: false, bottom: true, left: false, right: false },
            backgroundColor: "", preset: "underline",
        },
    },
    {
        key: "boxed",
        labelKey: "customize.presetBoxed",
        settings: {
            fontWeight: "700", fontStyle: "normal", textDecoration: "none",
            capitalization: "uppercase", textAlign: "left", letterSpacing: 0, lineHeight: 1.15,
            paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8, marginTop: 0, marginBottom: 12, marginLeft: 0, marginRight: 0,
            border: { style: "solid", width: 1.5, color: "", radius: 4, top: true, bottom: true, left: true, right: true },
            backgroundColor: "", preset: "boxed",
        },
    },
    {
        key: "filled",
        labelKey: "customize.presetFilled",
        settings: {
            fontWeight: "700", fontStyle: "normal", textDecoration: "none",
            capitalization: "uppercase", textAlign: "left", letterSpacing: 0, lineHeight: 1.15,
            paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10, marginTop: 0, marginBottom: 12, marginLeft: 0, marginRight: 0,
            border: { style: "solid", width: 0, color: "", radius: 0, top: false, bottom: false, left: false, right: false },
            backgroundColor: "", preset: "filled", // backgroundColor will be set from accent
        },
    },
    {
        key: "leftbar",
        labelKey: "customize.presetLeftBar",
        settings: {
            fontWeight: "700", fontStyle: "normal", textDecoration: "none",
            capitalization: "uppercase", textAlign: "left", letterSpacing: 0, lineHeight: 1.15,
            paddingTop: 2, paddingBottom: 2, paddingLeft: 10, paddingRight: 0, marginTop: 0, marginBottom: 12, marginLeft: 0, marginRight: 0,
            border: { style: "solid", width: 4, color: "", radius: 0, top: false, bottom: false, left: true, right: false },
            backgroundColor: "", preset: "leftbar",
        },
    },
    {
        key: "topbottom",
        labelKey: "customize.presetTopBottom",
        settings: {
            fontWeight: "700", fontStyle: "normal", textDecoration: "none",
            capitalization: "uppercase", textAlign: "center", letterSpacing: 0, lineHeight: 1.15,
            paddingTop: 4, paddingBottom: 4, paddingLeft: 0, paddingRight: 0, marginTop: 0, marginBottom: 12, marginLeft: 0, marginRight: 0,
            border: { style: "solid", width: 1.5, color: "", radius: 0, top: true, bottom: true, left: false, right: false },
            backgroundColor: "", preset: "topbottom",
        },
    },
    {
        key: "minimal",
        labelKey: "customize.presetMinimal",
        settings: {
            fontWeight: "400", fontStyle: "normal", textDecoration: "none",
            capitalization: "uppercase", textAlign: "left", letterSpacing: 2, lineHeight: 1.15,
            paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0, marginTop: 0, marginBottom: 12, marginLeft: 0, marginRight: 0,
            border: { style: "solid", width: 0, color: "", radius: 0, top: false, bottom: false, left: false, right: false },
            backgroundColor: "", preset: "minimal",
        },
    },
];

const CONTENT_STYLE_PRESETS: ContentStylePreset[] = [
    {
        key: "plain",
        labelKey: "customize.contentPresetPlain",
        settings: {
            paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0,
            marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
            border: { style: "solid", width: 0, color: "", radius: 0, top: false, bottom: false, left: false, right: false, dashLength: 6, dashGap: 4 },
            backgroundColor: "",
            preset: "plain",
        },
    },
    {
        key: "outline",
        labelKey: "customize.contentPresetOutline",
        settings: {
            paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10,
            marginTop: 0, marginBottom: 4, marginLeft: 0, marginRight: 0,
            border: { style: "solid", width: 1, color: "", radius: 8, top: true, bottom: true, left: true, right: true, dashLength: 6, dashGap: 4 },
            backgroundColor: "",
            preset: "outline",
        },
    },
    {
        key: "card",
        labelKey: "customize.contentPresetCard",
        settings: {
            paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12,
            marginTop: 0, marginBottom: 4, marginLeft: 0, marginRight: 0,
            border: { style: "solid", width: 1, color: "", radius: 10, top: true, bottom: true, left: true, right: true, dashLength: 6, dashGap: 4 },
            backgroundColor: "",
            preset: "card",
        },
    },
    {
        key: "filled",
        labelKey: "customize.contentPresetFilled",
        settings: {
            paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12,
            marginTop: 0, marginBottom: 4, marginLeft: 0, marginRight: 0,
            border: { style: "solid", width: 0, color: "", radius: 10, top: false, bottom: false, left: false, right: false, dashLength: 6, dashGap: 4 },
            backgroundColor: "",
            preset: "filled",
        },
    },
    {
        key: "leftbar",
        labelKey: "customize.contentPresetLeftBar",
        settings: {
            paddingTop: 6, paddingBottom: 6, paddingLeft: 12, paddingRight: 0,
            marginTop: 0, marginBottom: 2, marginLeft: 0, marginRight: 0,
            border: { style: "solid", width: 3, color: "", radius: 0, top: false, bottom: false, left: true, right: false, dashLength: 6, dashGap: 4 },
            backgroundColor: "",
            preset: "leftbar",
        },
    },
    {
        key: "split",
        labelKey: "customize.contentPresetSplit",
        settings: {
            paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0,
            marginTop: 0, marginBottom: 3, marginLeft: 0, marginRight: 0,
            border: { style: "dashed", width: 1.5, color: "", radius: 0, top: true, bottom: true, left: false, right: false, dashLength: 8, dashGap: 5 },
            backgroundColor: "",
            preset: "split",
        },
    },
];

type PersonalDetailsLayout = "imageLeft" | "imageTop" | "imageRight";
type PersonalDetailsDetailsLayout = "rows" | "wrap" | "twoColumns";

type PersonalDetailsPreset = {
    key: string;
    labelKey: string;
    layout: PersonalDetailsLayout;
    detailsLayout: PersonalDetailsDetailsLayout;
    alignment: "left" | "center" | "right";
};

type PersonalPhotoFilterSettings = {
    preset: string;
    brightness: number;
    contrast: number;
    saturate: number;
    grayscale: number;
    sepia: number;
    hueRotate: number;
    blur: number;
};

type PersonalPhotoPreset = {
    key: string;
    labelKey: string;
    settings: PersonalPhotoFilterSettings;
};

const DEFAULT_PERSONAL_PHOTO_FILTER: PersonalPhotoFilterSettings = {
    preset: "natural",
    brightness: 100,
    contrast: 100,
    saturate: 100,
    grayscale: 0,
    sepia: 0,
    hueRotate: 0,
    blur: 0,
};

const DEFAULT_PERSONAL_DETAILS_BORDER = {
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
};

const DEFAULT_PERSONAL_PHOTO_SETTINGS = {
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
    filter: DEFAULT_PERSONAL_PHOTO_FILTER,
};

const PERSONAL_PHOTO_FILTER_PRESETS: PersonalPhotoPreset[] = [
    { key: "natural", labelKey: "customize.photoPresetNatural", settings: { preset: "natural", brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, hueRotate: 0, blur: 0 } },
    { key: "studio", labelKey: "customize.photoPresetStudio", settings: { preset: "studio", brightness: 104, contrast: 108, saturate: 95, grayscale: 0, sepia: 0, hueRotate: 0, blur: 0 } },
    { key: "vivid", labelKey: "customize.photoPresetVivid", settings: { preset: "vivid", brightness: 104, contrast: 112, saturate: 128, grayscale: 0, sepia: 0, hueRotate: -4, blur: 0 } },
    { key: "warm", labelKey: "customize.photoPresetWarm", settings: { preset: "warm", brightness: 103, contrast: 106, saturate: 110, grayscale: 0, sepia: 18, hueRotate: -8, blur: 0 } },
    { key: "cool", labelKey: "customize.photoPresetCool", settings: { preset: "cool", brightness: 102, contrast: 105, saturate: 92, grayscale: 0, sepia: 0, hueRotate: 12, blur: 0 } },
    { key: "mono", labelKey: "customize.photoPresetMono", settings: { preset: "mono", brightness: 100, contrast: 115, saturate: 0, grayscale: 100, sepia: 0, hueRotate: 0, blur: 0 } },
    { key: "cinematic", labelKey: "customize.photoPresetCinematic", settings: { preset: "cinematic", brightness: 95, contrast: 118, saturate: 88, grayscale: 0, sepia: 10, hueRotate: -6, blur: 0 } },
    { key: "dreamy", labelKey: "customize.photoPresetDreamy", settings: { preset: "dreamy", brightness: 108, contrast: 92, saturate: 105, grayscale: 0, sepia: 8, hueRotate: 6, blur: 0.6 } },
];

function buildPhotoFilterPreviewValue(filter: PersonalPhotoFilterSettings) {
    return [
        `brightness(${filter.brightness}%)`,
        `contrast(${filter.contrast}%)`,
        `saturate(${filter.saturate}%)`,
        `grayscale(${filter.grayscale}%)`,
        `sepia(${filter.sepia}%)`,
        `hue-rotate(${filter.hueRotate}deg)`,
        `blur(${filter.blur}px)`,
    ].join(" ");
}

function matchesPhotoFilterPreset(current: PersonalPhotoFilterSettings, preset: PersonalPhotoFilterSettings) {
    return current.brightness === preset.brightness
        && current.contrast === preset.contrast
        && current.saturate === preset.saturate
        && current.grayscale === preset.grayscale
        && current.sepia === preset.sepia
        && current.hueRotate === preset.hueRotate
        && current.blur === preset.blur;
}

const PERSONAL_DETAILS_PRESETS: PersonalDetailsPreset[] = [
    { key: "imageRight", labelKey: "customize.imageRight", layout: "imageRight", detailsLayout: "wrap", alignment: "left" },
    { key: "imageTop", labelKey: "customize.imageTop", layout: "imageTop", detailsLayout: "wrap", alignment: "center" },
    { key: "imageLeft", labelKey: "customize.imageLeft", layout: "imageLeft", detailsLayout: "wrap", alignment: "right" },
];

const DESIGN_INSERT_OPTIONS: Array<{
    type: DesignElementType;
    labelKey: string;
    icon: LucideIcon;
}> = [
    { type: "text", labelKey: "customize.designText", icon: TypeIcon },
    { type: "shape", labelKey: "customize.designShape", icon: Square },
    { type: "image", labelKey: "customize.designImage", icon: ImageIcon },
    { type: "block", labelKey: "customize.designBlock", icon: Layout },
    { type: "gradient", labelKey: "customize.designGradient", icon: Palette },
];

function getDesignTypeLabelKey(type: DesignElementType) {
    if (type === "shape") return "customize.designShape";
    if (type === "image") return "customize.designImage";
    if (type === "block") return "customize.designBlock";
    if (type === "gradient") return "customize.designGradient";
    return "customize.designText";
}

function getDesignElementSummary(element: DesignElement, t: (key: string) => string) {
    if (element.type === "text") {
        const trimmed = element.text.trim();
        if (!trimmed) return t("customize.designText");
        const words = trimmed.split(/\s+/).slice(0, 5).join(" ");
        return words.length < trimmed.length ? `${words}…` : words;
    }

    if (element.type === "image" && element.imageSrc) {
        return t("customize.designImageReady");
    }

    return t(getDesignTypeLabelKey(element.type));
}

function getPersonalDetailsDetailsLabelKey(detailsLayout: PersonalDetailsDetailsLayout) {
    if (detailsLayout === "rows") return "customize.detailsRows";
    if (detailsLayout === "twoColumns") return "customize.detailsTwoColumns";
    return "customize.detailsWrap";
}

function PersonalDetailsPresetPreview({
    layout,
    detailsLayout,
}: {
    layout: PersonalDetailsLayout;
    detailsLayout: PersonalDetailsDetailsLayout;
}) {
    const renderDetails = () => {
        if (detailsLayout === "rows") {
            return (
                <div className="flex flex-col gap-1">
                    <div className="h-1.5 w-full rounded-full bg-current opacity-40" />
                    <div className="h-1.5 w-5/6 rounded-full bg-current opacity-30" />
                    <div className="h-1.5 w-4/6 rounded-full bg-current opacity-20" />
                </div>
            );
        }

        if (detailsLayout === "twoColumns") {
            return (
                <div className="grid grid-cols-2 gap-1">
                    <div className="h-1.5 rounded-full bg-current opacity-40" />
                    <div className="h-1.5 rounded-full bg-current opacity-30" />
                    <div className="h-1.5 rounded-full bg-current opacity-30" />
                    <div className="h-1.5 rounded-full bg-current opacity-20" />
                </div>
            );
        }

        return (
            <div className="flex flex-wrap gap-1">
                <div className="h-1.5 w-10 rounded-full bg-current opacity-40" />
                <div className="h-1.5 w-7 rounded-full bg-current opacity-30" />
                <div className="h-1.5 w-8 rounded-full bg-current opacity-30" />
                <div className="h-1.5 w-6 rounded-full bg-current opacity-20" />
            </div>
        );
    };

    const imageNode = <div className="h-9 w-9 shrink-0 rounded-xl border border-current/20 bg-current/10" />;
    const contentNode = <div className="min-w-0 flex-1">{renderDetails()}</div>;

    if (layout === "imageTop") {
        return (
            <div className="flex h-12 w-full flex-col items-center justify-center gap-1.5">
                {imageNode}
                <div className="w-full">{renderDetails()}</div>
            </div>
        );
    }

    return (
        <div className={`flex h-12 w-full items-start gap-2 ${layout === "imageLeft" ? "flex-row" : "flex-row-reverse"}`}>
            {imageNode}
            {contentNode}
        </div>
    );
}

const ACCENT_SWATCHES = [
    "#ffffff", "#374151", "#4b5563", "#6b7280", "#9ca3af", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#4f46e5",
    "#4338ca", "#db2777", "#e11d48", "#f43f5e", "#fbbf24"
];

function ColorPickerCard({
    label,
    value,
    icon: Icon,
    onChange
}: {
    label: string;
    value: string;
    icon: LucideIcon;
    onChange: (value: string) => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="rounded-2xl border border-edge bg-surface-1 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-strong/90 min-w-0">
                    <Icon className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="text-xs font-semibold truncate">{label}</span>
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-faint font-medium truncate">{value.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-3">
                <div
                    className="w-10 h-10 rounded-xl border border-edge shadow-inner shrink-0"
                    style={{ backgroundColor: value }}
                />
                <label className="relative inline-flex items-center justify-center px-3 py-2 rounded-xl bg-surface-4 border border-edge text-xs text-strong/80 hover:text-strong hover:border-faint cursor-pointer transition-colors">
                    {t("customize.pickColor")}
                    <input
                        type="color"
                        value={value}
                        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
                        onChange={(e) => onChange(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                </label>
            </div>
        </div>
    );
}

function InspectorSlider({
    label,
    value,
    onChange,
    min,
    max,
    step,
    ticks,
    suffix = "",
    decimals = 0,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    ticks: number;
    suffix?: string;
    decimals?: number;
}) {
    return (
        <div>
            <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] text-faint">{label}</span>
                <span className="text-[10px] text-faint font-medium">{`${formatDisplayNumber(value, decimals)}${suffix}`}</span>
            </div>
            <TickSlider value={value} onChange={onChange} min={min} max={max} step={step} ticks={ticks} />
        </div>
    );
}

function CompactColorInput({
    label,
    value,
    onChange,
    allowTransparent,
    transparentLabel,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    allowTransparent?: boolean;
    transparentLabel?: string;
}) {
    const { t } = useTranslation();
    return (
        <div className="space-y-2">
            <label className="text-xs font-semibold text-strong/90 block">{label}</label>
            <div className="flex items-center gap-2">
                {allowTransparent && (
                    <button
                        type="button"
                        onClick={() => onChange("")}
                        className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${!value ? "bg-edge border-accent text-strong" : "bg-surface-0 border-edge text-faint hover:text-strong"}`}
                    >
                        {transparentLabel || t("customize.transparent")}
                    </button>
                )}
                <div className="relative">
                    <div className="w-8 h-8 rounded-lg border border-edge" style={{ backgroundColor: value || "#ffffff" }} />
                    <input
                        type="color"
                        value={value || "#ffffff"}
                        onInput={(event) => onChange((event.target as HTMLInputElement).value)}
                        onChange={(event) => onChange(event.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                </div>
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">{value || transparentLabel || t("customize.transparent")}</span>
            </div>
        </div>
    );
}

function DirectionalSpacingEditor({
    label,
    values,
    onChange,
    max,
}: {
    label: string;
    values: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
    onChange: (updates: Partial<{
        top: number;
        bottom: number;
        left: number;
        right: number;
    }>) => void;
    max: number;
}) {
    const { t } = useTranslation();
    return (
        <div>
            <label className="text-xs font-semibold text-strong/90 mb-2 block">{label}</label>
            <div className="grid grid-cols-2 gap-3">
                <InspectorSlider label={t("customize.top")} value={values.top} onChange={(value) => onChange({ top: value })} min={0} max={max} step={1} ticks={9} suffix="px" />
                <InspectorSlider label={t("customize.bottom")} value={values.bottom} onChange={(value) => onChange({ bottom: value })} min={0} max={max} step={1} ticks={9} suffix="px" />
                <InspectorSlider label={t("customize.left")} value={values.left} onChange={(value) => onChange({ left: value })} min={0} max={max} step={1} ticks={9} suffix="px" />
                <InspectorSlider label={t("customize.right")} value={values.right} onChange={(value) => onChange({ right: value })} min={0} max={max} step={1} ticks={9} suffix="px" />
            </div>
        </div>
    );
}

function ApplyToCheckbox({
    label,
    checked,
    onChange
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="flex items-center gap-2 cursor-pointer group text-left"
        >
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? "bg-accent border-accent" : "border-faint group-hover:border-accent"}`}>
                {checked && <Check className="w-3 h-3 text-surface-1" />}
            </div>
            <span className="text-xs text-strong/80">{label}</span>
        </button>
    );
}

// ---------------------------------------------------
// Font Import Button
// ---------------------------------------------------

export function FontImportButton({ onImport }: { onImport: (name: string, url: string) => void }) {
    const { t } = useTranslation();
    const [isImporting, setIsImporting] = useState(false);
    const [importUrl, setImportUrl] = useState("");
    const inputId = useId();
    const noteId = useId();

    if (!isImporting) {
        return (
            <button
                type="button"
                onClick={() => setIsImporting(true)}
                className="text-xs text-accent hover:text-strong transition-colors flex items-center gap-1.5"
            >
                <Plus className="w-3.5 h-3.5" />
                {t("customize.importCustomFont")}
            </button>
        );
    }

    return (
        <div className="bg-surface-1 border border-edge rounded-xl p-3 animate-in fade-in zoom-in-95 duration-200">
            <label htmlFor={inputId} className="text-[10px] font-medium text-faint mb-2 block uppercase tracking-wider">{t("customize.pasteGoogleFontUrl")}</label>
            <div className="flex gap-2">
                <input
                    id={inputId}
                    type="text"
                    aria-describedby={noteId}
                    placeholder="https://fonts.googleapis.com/css2?family=..."
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    className="flex-1 min-w-0 bg-surface-4 border border-edge rounded-lg px-2.5 py-1.5 text-xs text-strong focus:outline-none focus:border-accent transition-colors placeholder:text-faint/50"
                    autoFocus
                />
                <button
                    type="button"
                    onClick={() => {
                        if (importUrl) {
                            const familyMatch = importUrl.match(/family=([^&:]+)/);
                            if (familyMatch && familyMatch[1]) {
                                onImport(familyMatch[1].replace(/\+/g, ' '), importUrl);
                            }
                        }
                        setIsImporting(false);
                        setImportUrl('');
                    }}
                    className="bg-edge hover:bg-accent hover:text-surface-1 text-strong px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0"
                >
                    {t("customize.add")}
                </button>
            </div>
            <p id={noteId} data-testid="custom-font-privacy-note" className="mt-2 text-[11px] leading-4 text-faint">
                {t("customize.customFontPrivacyNote")}
            </p>
        </div>
    );
}

type CustomizeNavigatorContextValue = {
    scope: CustomizeScope;
    activeSection: CustomizeSectionKey | null;
    selectedSectionKey: string | null;
    selectedSectionLabel: string;
    summaries: Partial<Record<CustomizeSectionKey, string>>;
    openSection: (section: CustomizeSectionKey) => void;
    closeSection: () => void;
    clearLocalStyle: (styleKey: SectionStyleKey) => void;
    hasLocalStyle: (styleKey: SectionStyleKey) => boolean;
};

const CustomizeNavigatorContext = createContext<CustomizeNavigatorContextValue | null>(null);

function CustomizeGroupLabel({ label, order }: { label: string; order: number }) {
    return (
        <div
            className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase text-dim"
            style={{ order }}
        >
            {label}
        </div>
    );
}

function CustomizeSectionCard({
    sectionKey,
    children,
}: {
    sectionKey: CustomizeSectionKey;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    const customizeNavigator = useContext(CustomizeNavigatorContext);
    if (!customizeNavigator) return null;

    const meta = CUSTOMIZE_SECTION_BY_ID[sectionKey];
    const Icon = meta.icon;
    const title = t(meta.labelKey);
    const selectedBase = customizeNavigator.selectedSectionKey
        ? getSectionBaseId(customizeNavigator.selectedSectionKey)
        : null;
    const availableInScope = customizeNavigator.scope === "resume"
        || Boolean(meta.localStyleKey && (!meta.sectionBase || meta.sectionBase === selectedBase));
    if (!availableInScope) return null;
    if (customizeNavigator.activeSection && customizeNavigator.activeSection !== sectionKey) return null;

    const summary = customizeNavigator.summaries[sectionKey];
    if (!customizeNavigator.activeSection) {
        return (
            <div className="animate-in fade-in duration-150 px-1" style={{ order: meta.order }}>
                <button
                    type="button"
                    onClick={() => customizeNavigator.openSection(sectionKey)}
                    data-testid={`customize-row-${sectionKey}`}
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-bright outline-none transition-colors hover:bg-surface-4 focus-visible:bg-surface-4 focus-visible:ring-1 focus-visible:ring-accent"
                >
                    <Icon className="h-4 w-4 shrink-0 text-faint" />
                    <span className="min-w-0 flex-1 truncate">{title}</span>
                    {summary ? (
                        <span className="max-w-[42%] truncate text-xs text-faint">{summary}</span>
                    ) : null}
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-dim" />
                </button>
            </div>
        );
    }

    const localStyleKey = customizeNavigator.scope === "section" ? meta.localStyleKey : undefined;
    const overridden = localStyleKey ? customizeNavigator.hasLocalStyle(localStyleKey) : false;
    return (
        <section
            data-testid={`customize-detail-${sectionKey}`}
            className="order-0 min-h-full animate-in fade-in slide-in-from-right-1 duration-150"
        >
            <div className="sticky top-0 z-20 border-b border-edge bg-surface-2/95 pb-3 backdrop-blur">
                <button
                    type="button"
                    onClick={customizeNavigator.closeSection}
                    className="mb-2 inline-flex h-8 items-center gap-1 rounded-md px-1.5 text-xs text-faint transition-colors hover:bg-surface-4 hover:text-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                    <ChevronLeft className="h-4 w-4" />
                    {customizeNavigator.scope === "section"
                        ? customizeNavigator.selectedSectionLabel
                        : t("customize.wholeResume")}
                </button>
                <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-faint" />
                    <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-strong">{title}</h3>
                    {localStyleKey ? (
                        overridden ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={() => customizeNavigator.clearLocalStyle(localStyleKey)}
                                        aria-label={t("customize.resetOverrides")}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-accent transition-colors hover:bg-surface-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                    >
                                        <Undo2 className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="left">{t("customize.resetOverrides")}</TooltipContent>
                            </Tooltip>
                        ) : (
                            <span className="text-[10px] font-medium uppercase text-dim">{t("customize.inherited")}</span>
                        )
                    ) : null}
                </div>
            </div>
            <div className="py-4">{children}</div>
        </section>
    );
}

// ---------------------------------------------------
// Main CustomizeSidebar
// ---------------------------------------------------

export function CustomizeSidebar() {
    const { t } = useTranslation();
    const resume = useResumeStore((state) => state.resume);
    const updateSettings = useResumeStore((state) => state.updateSettings);
    const updateSectionStyle = useResumeStore((state) => state.updateSectionStyle);
    const clearSectionStyle = useResumeStore((state) => state.clearSectionStyle);
    const selectedCustomizeSection = useResumeStore((state) => state.selectedCustomizeSection);
    const setSelectedCustomizeSection = useResumeStore((state) => state.setSelectedCustomizeSection);
    const scope = useResumeStore((state) => state.customizeScope);
    const setScope = useResumeStore((state) => state.setCustomizeScope);
    const pendingCustomizeNav = useResumeStore((state) => state.pendingCustomizeNav);
    const consumeCustomizeNav = useResumeStore((state) => state.consumeCustomizeNav);
    const paperSize = useResumeStore((state) => state.paperSize);
    const updatePaperSize = useResumeStore((state) => state.updatePaperSize);
    const selectedDesignElementId = useResumeStore((state) => state.selectedDesignElementId);
    const activeDesignPage = useResumeStore((state) => state.activeDesignPage);
    const previewPageCount = useResumeStore((state) => state.previewPageCount);
    const setActiveDesignPage = useResumeStore((state) => state.setActiveDesignPage);
    const selectDesignElement = useResumeStore((state) => state.selectDesignElement);
    const clearDesignSelection = useResumeStore((state) => state.clearDesignSelection);
    const addDesignElement = useResumeStore((state) => state.addDesignElement);
    const updateDesignElement = useResumeStore((state) => state.updateDesignElement);
    const updateDesignElementStyle = useResumeStore((state) => state.updateDesignElementStyle);
    const removeDesignElement = useResumeStore((state) => state.removeDesignElement);
    const duplicateDesignElement = useResumeStore((state) => state.duplicateDesignElement);
    const moveDesignElementLayer = useResumeStore((state) => state.moveDesignElementLayer);
    const designImageInputRef = useRef<HTMLInputElement>(null);
    const [activeCustomizeSection, setActiveCustomizeSection] = useState<CustomizeSectionKey | null>(null);

    const defaultSettings = {
        theme: "modern",
        language: "en",
        dateFormat: "DD/MM/YYYY",
        measurementSystem: "metric" as const,
        layout: {
            columns: "one" as const,
            headerPosition: "top" as const,
            leftColumnWidth: 50,
            sectionPlacement: {} as Record<string, SectionPlacement>,
            sectionOrder: ["experience", "education", "certificates", "projects", "skills", "languages"]
        },
        typography: { fontFamily: "Inter", fontSize: 10, lineHeight: 1.35 },
        spacing: { marginH: 20, marginV: 18, itemSpacing: 10 },
        colors: { variant: "basic" as const, accent: "#ffaa8d", text: "#111827", background: "#fff8f6", applyTo: ["headingsLine", "dotsBarsBubbles"], skillIconColor: "mono" as const, skillIconCustomColor: "#ffaa8d" },
        headings: {
            style: "baseline", capitalization: "uppercase" as const, size: "m" as const,
            fontFamily: "", fontSize: 14, fontWeight: "700" as const, fontStyle: "normal" as const, textDecoration: "none" as const,
            textAlign: "left" as const, letterSpacing: 0, lineHeight: 1.15,
            paddingTop: 0, paddingBottom: 4, paddingLeft: 0, paddingRight: 0, marginTop: 0, marginBottom: 12, marginLeft: 0, marginRight: 0,
            border: { style: "solid" as const, width: 2, color: "", radius: 0, top: false, bottom: true, left: false, right: false, dashLength: 6, dashGap: 4 },
            backgroundColor: "", borderColor: "", preset: "baseline",
        },
        header: { fontFamily: "", fontSize: 36, fontWeight: "700" as const, fontStyle: "normal" as const, textDecoration: "none" as const, textTransform: "none" as const },
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
            border: DEFAULT_PERSONAL_DETAILS_BORDER,
            photo: DEFAULT_PERSONAL_PHOTO_SETTINGS,
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
        entryLayout: {
            layout: "contentRight" as const,
            leftWidth: 25,
            middleWidth: 55,
            rightWidth: 20,
            titleFontSize: 11,
            subtitleFontSize: 10,
            subtitleFontWeight: "600",
            subtitleFontStyle: "normal" as const,
            subtitleTextDecoration: "none" as const,
            subtitlePlacement: "nextLine" as const,
            indentBody: false,
            listStyle: "bullet" as const,
            showEntrySkills: false,
            entrySkillsPlacement: "belowBody" as const,
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

    const globalSettings = {
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
        entryLayout: { ...defaultSettings.entryLayout, ...((resume.settings as any)?.entryLayout || {}) },
        footer: { ...defaultSettings.footer, ...((resume.settings as any)?.footer || {}) },
        repoBadge: {
            ...(defaultSettings as any).repoBadge,
            ...((resume.settings as any)?.repoBadge || {}),
            border: {
                ...(defaultSettings as any).repoBadge.border,
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
    const selectedSectionOverride = selectedCustomizeSection
        ? resume.customization.sectionOverrides[selectedCustomizeSection]
        : undefined;
    const settings = scope === "section"
        ? resolveSectionSettings(globalSettings as unknown as ResumeSettings, selectedSectionOverride) as typeof globalSettings
        : globalSettings;
    const sectionDisplayMap = ((resume.settings as any)?.sectionDisplay || {}) as Record<string, { title?: string; icon?: string; showIcon?: boolean }>;
    const contentSectionKeys = resume.settings?.contentSections || [];
    const sectionInstanceCounts = contentSectionKeys.reduce<Record<string, number>>((acc, key) => {
        const base = getSectionBaseId(key);
        acc[base] = (acc[base] || 0) + 1;
        return acc;
    }, {});
    const seenSectionInstances: Record<string, number> = {};
    const contentLayoutItems: LayoutSectionItem[] = contentSectionKeys.map((sectionKey) => {
            const base = getSectionBaseId(sectionKey);
            const sectionMeta = SECTION_LABELS[base] || { labelKey: base, icon: GripVertical };
            const displayTitle = sectionDisplayMap[base]?.title?.trim() || t(sectionMeta.labelKey);
            seenSectionInstances[base] = (seenSectionInstances[base] || 0) + 1;
            const instanceIndex = seenSectionInstances[base];
            const totalInstances = sectionInstanceCounts[base] || 1;

            return {
                key: sectionKey,
                base,
                label: totalInstances > 1 ? `${displayTitle} ${instanceIndex}` : displayTitle,
                caption: totalInstances > 1 ? t("customize.contentSectionOf", { index: instanceIndex, total: totalInstances }) : t("customize.contentSection"),
                icon: sectionMeta.icon,
            };
        });
    const separatorLayoutItems: LayoutSectionItem[] = (settings.layout.sectionOrder || [])
        .filter(isLayoutSeparatorKey)
        .map((separatorKey, index) => ({
            key: separatorKey,
            base: "separator",
            label: `${t("customize.separator")} ${index + 1}`,
            caption: t("customize.fullWidthDivider"),
            icon: Minus,
            isSeparator: true,
        }));
    const verticalSeparatorLayoutItems: LayoutSectionItem[] = (settings.layout.sectionOrder || [])
        .filter(isLayoutVerticalSeparatorKey)
        .map((separatorKey, index) => ({
            key: separatorKey,
            base: "vertical-separator",
            label: `${t("customize.verticalSeparator")} ${index + 1}`,
            caption: t("customize.verticalSeparatorDesc"),
            icon: GripVertical,
            isVerticalSeparator: true,
        }));
    const pageBreakLayoutItems: LayoutSectionItem[] = (settings.layout.sectionOrder || [])
        .filter(isLayoutPageBreakKey)
        .map((pageBreakKey, index) => ({
            key: pageBreakKey,
            base: "pagebreak",
            label: `${t("customize.pageBreak")} ${index + 1}`,
            caption: t("customize.pageBreakDesc"),
            icon: Maximize2,
            isPageBreak: true,
        }));
    const layoutSectionItems: LayoutSectionItem[] = [...contentLayoutItems, ...separatorLayoutItems, ...verticalSeparatorLayoutItems, ...pageBreakLayoutItems];
    const isMultiColumnLayout = settings.layout.columns === "two" || settings.layout.columns === "mix";
    const resolvedLayoutOrder = resolveLayoutSectionOrder(settings.layout.sectionOrder, layoutSectionItems);
    const resolvedContentOrder = resolvedLayoutOrder.filter(
        (key) => !isLayoutSeparatorKey(key) && !isLayoutVerticalSeparatorKey(key) && !isLayoutPageBreakKey(key)
    );
    const resolvedSectionPlacements = resolvedContentOrder.reduce<Record<string, SectionPlacement>>((acc, key, contentIndex) => {
        if (!isMultiColumnLayout) return acc;
        acc[key] = normalizeSectionPlacement(
            settings.layout.sectionPlacement?.[key] || settings.layout.sectionPlacement?.[getSectionBaseId(key)],
            contentIndex,
            settings.layout.columns === "mix" ? "mix" : "two"
        );
        return acc;
    }, {});

    // Migrate legacy per-section fontUrl into shared pool
    const legacyFonts: Array<{ name: string, url: string }> = [];
    const typFontUrl = (settings.typography as any).fontUrl;
    if (typFontUrl) {
        const m = typFontUrl.match(/family=([^&:]+)/);
        if (m?.[1]) legacyFonts.push({ name: m[1].replace(/\+/g, ' '), url: typFontUrl });
    }
    const hdrFontUrl = (settings.header as any).fontUrl;
    if (hdrFontUrl) {
        const m = hdrFontUrl.match(/family=([^&:]+)/);
        if (m?.[1]) legacyFonts.push({ name: m[1].replace(/\+/g, ' '), url: hdrFontUrl });
    }
    const hdgFontUrl = (settings.headings as any).fontUrl;
    if (hdgFontUrl) {
        const m = hdgFontUrl.match(/family=([^&:]+)/);
        if (m?.[1]) legacyFonts.push({ name: m[1].replace(/\+/g, ' '), url: hdgFontUrl });
    }

    // Deduplicated shared custom fonts
    const allCustomFonts = [...settings.customFonts];
    for (const lf of legacyFonts) {
        if (!allCustomFonts.some(f => f.name === lf.name)) {
            allCustomFonts.push(lf);
        }
    }

    // Resolved global font roles (used to preview role references in pickers).
    const roleFonts = getRoleFonts(settings.typography);
    const typographyFonts = (settings.typography as any).fonts || { primary: "", secondary: "", mono: "" };
    const updateRoleFont = (role: FontRole, family: string) => {
        handleUpdate('typography', { fonts: { ...typographyFonts, [role]: family } });
    };

    const [subColorTab, setSubColorTab] = useState<'multi' | 'image'>('multi');
    const accentMatchesPreset = ACCENT_SWATCHES.some((swatch) => swatch.toLowerCase() === settings.colors.accent.toLowerCase());
    const handleUpdate = (category: keyof typeof settings, fields: any) => {
        if (
            scope === "section"
            && selectedCustomizeSection
            && (["headings", "contentStyle", "entryLayout", "repoBadge", "languagesSection", "linkIcon"] as string[]).includes(category)
        ) {
            updateSectionStyle(
                selectedCustomizeSection,
                category as SectionStyleKey,
                fields,
            );
            return;
        }
        updateSettings({ [category]: fields });
    };

    // Layout (list/table) lives in sectionDisplay.languages so the content
    // sidebar toggle and this card share one source of truth.
    const storedLanguageLayout = (sectionDisplayMap.languages as any)?.languageLayout;
    const languageLayout: "list" | "table" | "cefr" =
        storedLanguageLayout === "table" || storedLanguageLayout === "cefr" ? storedLanguageLayout : "list";
    const setLanguageLayout = (value: "list" | "table" | "cefr") => {
        updateSettings({
            sectionDisplay: {
                ...sectionDisplayMap,
                languages: {
                    ...(sectionDisplayMap.languages || {}),
                    languageLayout: value,
                },
            },
        } as any);
    };

    const lineHeightPt = settings.typography.fontSize * settings.typography.lineHeight;
    const lineHeightPx = ptToPx(lineHeightPt);
    const headerFontSizePt = pxToPt(settings.header.fontSize);
    const activePersonalDetailsPresetKey =
        PERSONAL_DETAILS_PRESETS.find((preset) =>
            preset.layout === settings.personalDetails.layout &&
            preset.detailsLayout === settings.personalDetails.detailsLayout &&
            preset.alignment === settings.personalDetails.alignment
        )?.key ?? null;
    const isCustomPersonalDetailsPreset = activePersonalDetailsPresetKey === null;
    const personalDetailsBorder = settings.personalDetails.border ?? defaultSettings.personalDetails.border;
    const personalPhotoSettings = settings.personalDetails.photo;
    const activePersonalPhotoFilterPresetKey =
        PERSONAL_PHOTO_FILTER_PRESETS.find((preset) => matchesPhotoFilterPreset(personalPhotoSettings.filter, preset.settings))?.key ?? null;
    const isCustomPersonalPhotoFilterPreset = activePersonalPhotoFilterPresetKey === null;
    const designCanvas = paperSize === "letter"
        ? { width: 816, height: 1056 }
        : { width: 794, height: 1123 };
    const designElements: DesignElement[] = settings.design.elements || [];
    const designElementsForActivePage = designElements
        .filter((element) => element.pageIndex === activeDesignPage)
        .sort((left, right) => right.zIndex - left.zIndex);
    const selectedDesignElement = designElements.find((element) => element.id === selectedDesignElementId) || null;
    const selectedDesignElementBorder = selectedDesignElement?.style.border || DEFAULT_DESIGN_BORDER;
    const handlePersonalPhotoUpdate = (updates: Partial<typeof personalPhotoSettings>) => {
        handleUpdate("personalDetails", {
            photo: {
                ...personalPhotoSettings,
                ...updates,
            },
        });
    };
    const handlePersonalPhotoBorderUpdate = (updates: Partial<typeof personalPhotoSettings.border>) => {
        handlePersonalPhotoUpdate({
            border: {
                ...personalPhotoSettings.border,
                ...updates,
            },
        });
    };
    const handlePersonalDetailsBorderUpdate = (updates: Partial<typeof personalDetailsBorder>) => {
        handleUpdate("personalDetails", {
            border: {
                ...personalDetailsBorder,
                ...updates,
            },
        });
    };
    const handlePersonalPhotoFilterUpdate = (updates: Partial<PersonalPhotoFilterSettings>) => {
        handlePersonalPhotoUpdate({
            filter: {
                ...personalPhotoSettings.filter,
                ...updates,
            },
        });
    };
    const handleSelectedDesignUpdate = (updates: Partial<Omit<DesignElement, "id" | "style">>) => {
        if (!selectedDesignElement) return;
        updateDesignElement(selectedDesignElement.id, updates);
    };
    const handleSelectedDesignStyleUpdate = (updates: Partial<DesignElement["style"]>) => {
        if (!selectedDesignElement) return;
        updateDesignElementStyle(
            selectedDesignElement.id,
            updates as Parameters<typeof updateDesignElementStyle>[1],
        );
    };
    const handleSelectedDesignBorderUpdate = (updates: Partial<DesignElement["style"]["border"]>) => {
        if (!selectedDesignElement) return;
        handleSelectedDesignStyleUpdate({
            border: {
                ...selectedDesignElement.style.border,
                ...updates,
            } as DesignElement["style"]["border"],
        });
    };
    const handleSelectedDesignImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
        if (!selectedDesignElement || selectedDesignElement.type !== "image") return;
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                handleSelectedDesignUpdate({ imageSrc: reader.result });
            }
        };
        reader.readAsDataURL(file);
        event.target.value = "";
    };

    const addLayoutSeparator = () => {
        handleUpdate('layout', {
            sectionOrder: [...resolvedLayoutOrder, createLayoutSeparatorKey()],
        });
    };
    const addLayoutVerticalSeparator = () => {
        handleUpdate('layout', {
            sectionOrder: [...resolvedLayoutOrder, createLayoutVerticalSeparatorKey()],
        });
    };
    const addLayoutPageBreak = () => {
        handleUpdate('layout', {
            sectionOrder: [...resolvedLayoutOrder, createLayoutPageBreakKey()],
        });
    };
    const removeLayoutFlowItem = (itemKey: string) => {
        handleUpdate('layout', {
            sectionOrder: settings.layout.sectionOrder.filter((entry) => entry !== itemKey),
        });
    };

    const handleImportFont = (name: string, url: string, selectIn?: string) => {
        const updated = [...allCustomFonts];
        if (!updated.some(f => f.name === name)) {
            updated.push({ name, url });
        }
        const patch: any = { customFonts: updated };
        if (selectIn === 'fontPrimary') {
            patch.typography = { fonts: { ...typographyFonts, primary: name } };
        } else if (selectIn === 'fontMono') {
            patch.typography = { fonts: { ...typographyFonts, mono: name } };
        } else if (selectIn) {
            patch[selectIn] = { fontFamily: name };
        }
        if (scope === "section" && selectedCustomizeSection && selectIn === "headings") {
            updateSettings({ customFonts: updated });
            updateSectionStyle(selectedCustomizeSection, "headings", { fontFamily: name });
            return;
        }
        updateSettings(patch);
    };
    const dateFormatOptions = [
        { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', preview: formatCvDate('2026-03-08', 'DD/MM/YYYY', settings.language) },
        { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', preview: formatCvDate('2026-03-08', 'MM/DD/YYYY', settings.language) },
        { value: 'MMM DD, YYYY', label: 'MMM DD, YYYY', preview: formatCvDate('2026-03-08', 'MMM DD, YYYY', settings.language) },
        { value: 'MMMM Do, YYYY', label: 'MMMM Do, YYYY', preview: formatCvDate('2026-03-08', 'MMMM Do, YYYY', settings.language) },
        { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY', preview: formatCvDate('2026-03-08', 'DD.MM.YYYY', settings.language) },
        { value: 'DD MMM YYYY', label: 'DD MMM YYYY', preview: formatCvDate('2026-03-08', 'DD MMM YYYY', settings.language) },
        { value: 'Do MMMM YYYY', label: 'Do MMMM YYYY', preview: formatCvDate('2026-03-08', 'Do MMMM YYYY', settings.language) },
        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', preview: formatCvDate('2026-03-08', 'YYYY-MM-DD', settings.language) }
    ];

    const [searchQuery, setSearchQuery] = useState("");
    const [footerAdvancedOpen, setFooterAdvancedOpen] = useState(() => Boolean(settings.footer?.show));
    const [activeFooterField, setActiveFooterField] = useState<"left" | "middle" | "right" | null>(null);
    const [isTemplateBrowserOpen, setIsTemplateBrowserOpen] = useState(false);
    const activeTemplateId = useResumeStore((state) => state.activeTemplateId);
    const builtinPreviewTemplates = useMemo(() => getBuiltinTemplates().slice(0, 4), []);
    const availableSectionKeys = useMemo(() => {
        const configured = (resume.settings?.contentSections || []).filter(
            (key) => !isLayoutSeparatorKey(key) && !isLayoutVerticalSeparatorKey(key) && !isLayoutPageBreakKey(key),
        );
        return configured.length > 0 ? configured : getVisibleContentKeys(resume);
    }, [resume]);
    const getCustomizeSectionLabel = (sectionKey: string) => {
        const base = getSectionBaseId(sectionKey);
        if (base === "custom") {
            return resume.customSections.find((section) => `custom:${section.id}` === sectionKey)?.title
                || t("editor.sectionCustom");
        }
        const meta = SECTION_LABELS[base];
        return meta ? t(meta.labelKey) : base;
    };
    const sectionOptions = availableSectionKeys.map((sectionKey) => ({
        value: sectionKey,
        label: getCustomizeSectionLabel(sectionKey),
    }));
    const selectedSectionLabel = selectedCustomizeSection
        ? getCustomizeSectionLabel(selectedCustomizeSection)
        : t("customize.currentSection");

    useEffect(() => {
        if (!pendingCustomizeNav) return;

        const timeout = window.setTimeout(() => {
            setSearchQuery("");
            setScope(pendingCustomizeNav.scope);
            if (pendingCustomizeNav.scope === "section" && pendingCustomizeNav.section) {
                setSelectedCustomizeSection(pendingCustomizeNav.section);
            }
            setActiveCustomizeSection(
                pendingCustomizeNav.panel && isCustomizeSectionKey(pendingCustomizeNav.panel)
                    ? pendingCustomizeNav.panel
                    : null,
            );
            consumeCustomizeNav();
        }, 0);

        return () => window.clearTimeout(timeout);
    }, [consumeCustomizeNav, pendingCustomizeNav, setSelectedCustomizeSection]);

    useEffect(() => {
        if (!settings.footer?.show) return;
        const timeout = window.setTimeout(() => {
            setFooterAdvancedOpen(true);
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [settings.footer?.show]);

    const matchSearch = (keywords: string[]) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;

        return keywords.some((keyword) => {
            const translated = t(keyword).toLowerCase();
            return translated.includes(query) || keyword.toLowerCase().includes(query);
        });
    };
    const insertFooterPlaceholder = (token: string) => {
        const targetField = activeFooterField ?? "left";
        const currentValue = settings.footer?.[targetField] || "";
        handleUpdate("footer", {
            [targetField]: currentValue ? `${currentValue}${token}` : token,
        });
        void navigator.clipboard?.writeText(token).catch(() => undefined);
    };
    const designFitOptions = DESIGN_OBJECT_FITS.map((value) => ({
        value,
        label: t(`customize.designFit${value.charAt(0).toUpperCase() + value.slice(1)}`),
    }));
    const renderSelectedDesignControls = () => {
        if (!selectedDesignElement) {
            return <p className="text-xs leading-relaxed text-faint">{t("customize.designSelectHint")}</p>;
        }

        return (
            <>
                <div className="grid grid-cols-2 gap-3">
                    <InspectorSlider label="X" value={selectedDesignElement.x} onChange={(value) => handleSelectedDesignUpdate({ x: value })} min={0} max={designCanvas.width} step={1} ticks={9} suffix="px" />
                    <InspectorSlider label="Y" value={selectedDesignElement.y} onChange={(value) => handleSelectedDesignUpdate({ y: value })} min={0} max={designCanvas.height} step={1} ticks={9} suffix="px" />
                    <InspectorSlider label={t("customize.width")} value={selectedDesignElement.width} onChange={(value) => handleSelectedDesignUpdate({ width: value })} min={24} max={designCanvas.width} step={1} ticks={9} suffix="px" />
                    <InspectorSlider label={t("customize.height")} value={selectedDesignElement.height} onChange={(value) => handleSelectedDesignUpdate({ height: value })} min={24} max={designCanvas.height} step={1} ticks={9} suffix="px" />
                    <div className="col-span-2">
                        <InspectorSlider label={t("customize.designOpacity")} value={selectedDesignElement.style.opacity} onChange={(value) => handleSelectedDesignStyleUpdate({ opacity: value })} min={0} max={100} step={1} ticks={11} suffix="%" />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.designLayerOrder")}</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {([
                            { key: "back", labelKey: "customize.designSendToBack" },
                            { key: "backward", labelKey: "customize.designSendBackward" },
                            { key: "forward", labelKey: "customize.designBringForward" },
                            { key: "front", labelKey: "customize.designBringToFront" },
                        ] as const).map((action) => (
                            <button
                                key={action.key}
                                type="button"
                                onClick={() => moveDesignElementLayer(selectedDesignElement.id, action.key)}
                                className="rounded-xl border border-edge bg-surface-0 px-3 py-2 text-[11px] font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                            >
                                {t(action.labelKey)}
                            </button>
                        ))}
                    </div>
                </div>

                {selectedDesignElement.type === "text" && (
                    <>
                        <div>
                            <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.designTextContent")}</label>
                            <textarea
                                value={selectedDesignElement.text}
                                onChange={(event) => handleSelectedDesignUpdate({ text: event.target.value })}
                                rows={4}
                                className="w-full rounded-2xl border border-edge bg-surface-0 px-3 py-3 text-sm text-strong placeholder:text-faint focus:outline-none focus:border-faint"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.fontFamily")}</label>
                            <FontSelect
                                value={selectedDesignElement.style.fontFamily}
                                customFonts={allCustomFonts}
                                showInherit
                                inheritLabel={t("customize.inherit")}
                                onChange={(fontFamily) => handleSelectedDesignStyleUpdate({ fontFamily })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <InspectorSlider label={t("customize.fontSize")} value={selectedDesignElement.style.fontSize} onChange={(value) => handleSelectedDesignStyleUpdate({ fontSize: value })} min={8} max={72} step={1} ticks={9} suffix="pt" />
                            <InspectorSlider label={t("customize.headingLineHeight")} value={selectedDesignElement.style.lineHeight} onChange={(value) => handleSelectedDesignStyleUpdate({ lineHeight: value })} min={0.8} max={3} step={0.05} ticks={9} decimals={2} />
                        </div>

                        <TextStyleToolbar
                            fontWeight={selectedDesignElement.style.fontWeight}
                            fontStyle={selectedDesignElement.style.fontStyle}
                            textDecoration={selectedDesignElement.style.textDecoration}
                            textTransform={selectedDesignElement.style.textTransform}
                            showTextTransform
                            onChange={(updates) => handleSelectedDesignStyleUpdate(updates)}
                        />

                        <div>
                            <label className="text-xs font-medium text-faint mb-1.5 block">{t("customize.alignment")}</label>
                            <AlignmentPicker
                                value={selectedDesignElement.style.textAlign}
                                onChange={(textAlign) => handleSelectedDesignStyleUpdate({ textAlign })}
                            />
                        </div>

                        <InspectorSlider label={t("customize.letterSpacing")} value={selectedDesignElement.style.letterSpacing} onChange={(value) => handleSelectedDesignStyleUpdate({ letterSpacing: value })} min={-2} max={16} step={0.5} ticks={10} suffix="px" decimals={1} />
                        <CompactColorInput label={t("customize.designTextColor")} value={selectedDesignElement.style.color} onChange={(value) => handleSelectedDesignStyleUpdate({ color: value })} />
                    </>
                )}

                {selectedDesignElement.type === "image" && (
                    <>
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-strong/90 block">{t("customize.designImageSource")}</label>
                            <button
                                type="button"
                                onClick={() => designImageInputRef.current?.click()}
                                className="inline-flex items-center gap-2 rounded-xl border border-edge bg-surface-0 px-3 py-2 text-xs font-medium text-bright hover:border-faint hover:text-strong transition-colors"
                            >
                                <ImageIcon className="w-4 h-4 text-accent" />
                                {t("customize.designUploadImage")}
                            </button>
                            <div className="text-[11px] text-faint">
                                {selectedDesignElement.imageSrc ? t("customize.designImageReady") : t("customize.designImageEmpty")}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.designImageFit")}</label>
                            <Select
                                value={selectedDesignElement.style.objectFit}
                                options={designFitOptions}
                                onChange={(value) => handleSelectedDesignStyleUpdate({ objectFit: value as DesignObjectFit })}
                            />
                        </div>

                        <CompactColorInput
                            label={t("customize.designBackground")}
                            value={selectedDesignElement.style.backgroundColor}
                            onChange={(value) => handleSelectedDesignStyleUpdate({ backgroundColor: value })}
                            allowTransparent
                            transparentLabel={t("customize.transparent")}
                        />
                    </>
                )}

                {selectedDesignElement.type !== "text" && selectedDesignElement.type !== "image" && (
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.designShapeType")}</label>
                        <div className="grid grid-cols-2 gap-3">
                            {([
                                { value: "rectangle", labelKey: "customize.designRectangle", icon: Square },
                                { value: "ellipse", labelKey: "customize.designEllipse", icon: Circle },
                            ] as const).map((option) => {
                                const Icon = option.icon;
                                const isActive = selectedDesignElement.shape === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleSelectedDesignUpdate({ shape: option.value })}
                                        className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm transition-colors ${isActive ? "bg-edge border-accent text-strong" : "bg-surface-0 border-edge text-faint hover:border-faint hover:text-strong"}`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {t(option.labelKey)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {selectedDesignElement.type !== "image" && (
                    <>
                        <div>
                            <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.style")}</label>
                            <div className="flex bg-surface-0 p-1 rounded-xl border border-edge">
                                {([
                                    { value: "solid", labelKey: "customize.designSolidFill" },
                                    { value: "gradient", labelKey: "customize.designGradientFill" },
                                ] as const).map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleSelectedDesignStyleUpdate({ fillMode: option.value })}
                                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${selectedDesignElement.style.fillMode === option.value ? "bg-edge text-strong" : "text-faint hover:text-strong"}`}
                                    >
                                        {t(option.labelKey)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedDesignElement.style.fillMode === "gradient" ? (
                            <>
                                <CompactColorInput label={t("customize.designGradientFrom")} value={selectedDesignElement.style.gradientFrom} onChange={(value) => handleSelectedDesignStyleUpdate({ gradientFrom: value })} />
                                <CompactColorInput label={t("customize.designGradientTo")} value={selectedDesignElement.style.gradientTo} onChange={(value) => handleSelectedDesignStyleUpdate({ gradientTo: value })} />
                                <InspectorSlider label={t("customize.designGradientAngle")} value={selectedDesignElement.style.gradientAngle} onChange={(value) => handleSelectedDesignStyleUpdate({ gradientAngle: value })} min={0} max={360} step={1} ticks={9} suffix="°" />
                            </>
                        ) : (
                            <CompactColorInput
                                label={t("customize.designBackground")}
                                value={selectedDesignElement.style.backgroundColor}
                                onChange={(value) => handleSelectedDesignStyleUpdate({ backgroundColor: value })}
                                allowTransparent
                                transparentLabel={t("customize.transparent")}
                            />
                        )}
                    </>
                )}

                <div>
                    <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.borderSection")}</label>
                    <BorderEditor
                        border={selectedDesignElementBorder}
                        fallbackColor={settings.colors.accent}
                        onChange={handleSelectedDesignBorderUpdate}
                    />
                </div>

                <DirectionalSpacingEditor
                    label={t("customize.padding")}
                    values={{
                        top: selectedDesignElement.style.paddingTop,
                        bottom: selectedDesignElement.style.paddingBottom,
                        left: selectedDesignElement.style.paddingLeft,
                        right: selectedDesignElement.style.paddingRight,
                    }}
                    onChange={(updates) => handleSelectedDesignStyleUpdate({
                        ...(updates.top !== undefined ? { paddingTop: updates.top } : {}),
                        ...(updates.bottom !== undefined ? { paddingBottom: updates.bottom } : {}),
                        ...(updates.left !== undefined ? { paddingLeft: updates.left } : {}),
                        ...(updates.right !== undefined ? { paddingRight: updates.right } : {}),
                    })}
                    max={80}
                />

                <DirectionalSpacingEditor
                    label={t("customize.margin")}
                    values={{
                        top: selectedDesignElement.style.marginTop,
                        bottom: selectedDesignElement.style.marginBottom,
                        left: selectedDesignElement.style.marginLeft,
                        right: selectedDesignElement.style.marginRight,
                    }}
                    onChange={(updates) => handleSelectedDesignStyleUpdate({
                        ...(updates.top !== undefined ? { marginTop: updates.top } : {}),
                        ...(updates.bottom !== undefined ? { marginBottom: updates.bottom } : {}),
                        ...(updates.left !== undefined ? { marginLeft: updates.left } : {}),
                        ...(updates.right !== undefined ? { marginRight: updates.right } : {}),
                    })}
                    max={80}
                />
            </>
        );
    };

    const summaries: Partial<Record<CustomizeSectionKey, string>> = {
        templates: activeTemplateId
            ? getBuiltinTemplates().find((template) => template.id === activeTemplateId)?.meta.name || t("customize.custom")
            : t("customize.browse"),
        languageRegion: settings.language.toUpperCase(),
        documentUnits: paperSize === "letter" ? t("customize.paperLetter") : "A4",
        typography: settings.typography.fontFamily,
        layout: t(`customize.${settings.layout.columns}`),
        spacing: `${formatDisplayNumber(settings.spacing.itemSpacing)}px`,
        footer: settings.footer.show ? t("customize.visible") : t("customize.hidden"),
        colors: settings.colors.accent.toUpperCase(),
        personalDetails: t(`customize.${settings.personalDetails.layout}`),
        personalDetailsSpacing: `${formatDisplayNumber(settings.personalDetails.marginBottom)}px`,
        personalPhoto: `${formatDisplayNumber(settings.personalDetails.photo.width)}px`,
        sectionHeadings: settings.headings.preset || settings.headings.style,
        sectionContent: settings.contentStyle.preset,
        headerTypography: settings.header.fontFamily || t("customize.inherited"),
        entryLayout: t(({
            contentRight: "customize.entryLayoutContentRight",
            contentLeft: "customize.entryLayoutContentLeft",
            threeCol: "customize.entryLayoutThreeCol",
            singleCol: "customize.entryLayoutSingleCol",
        } as Record<string, string>)[settings.entryLayout.layout] || "customize.entryLayoutContentRight"),
        repoBadge: settings.repoBadge.colorMode,
        languagesSection: `${settings.languagesSection.columns}`,
        linkIcons: t(`customize.${settings.linkIcon.side}`),
        headerLinkIndicators: t(`customize.${settings.headerIcon.side}`),
        designOverlays: `${settings.design.elements.length}`,
    };
    const navigatorValue: CustomizeNavigatorContextValue = {
        scope,
        activeSection: activeCustomizeSection,
        selectedSectionKey: selectedCustomizeSection,
        selectedSectionLabel,
        summaries,
        openSection: (section) => {
            setSearchQuery("");
            setActiveCustomizeSection(section);
        },
        closeSection: () => setActiveCustomizeSection(null),
        clearLocalStyle: (styleKey) => {
            if (selectedCustomizeSection) clearSectionStyle(selectedCustomizeSection, styleKey);
        },
        hasLocalStyle: (styleKey) => Boolean(
            selectedCustomizeSection
            && hasSectionStyleOverride(resume, selectedCustomizeSection, styleKey)
        ),
    };

    return (
        <CustomizeNavigatorContext.Provider value={navigatorValue}>
        <div className="sidebar-scroll flex-1 overflow-y-auto flex flex-col pb-24 lg:pb-8 [overscroll-behavior-y:contain] [will-change:scroll-position]">

            {!activeCustomizeSection ? (
                <div
                    className="sticky top-0 z-20 mb-1 border border-edge bg-surface-1"
                    style={{ order: -1000, borderRadius: 8 }}
                >
                    <div className="relative flex items-center border-b border-edge px-3">
                        <Search className="h-4 w-4 shrink-0 text-faint" />
                        <input
                            type="text"
                            placeholder={t("customize.searchOptions")}
                            aria-label={t("customize.searchOptions")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 w-full bg-transparent px-2 py-2 text-sm text-strong outline-none placeholder:text-faint"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-1 p-1">
                        <button
                            type="button"
                            onClick={() => {
                                setScope("resume");
                                setActiveCustomizeSection(null);
                            }}
                            aria-pressed={scope === "resume"}
                            className={`h-8 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                                scope === "resume" ? "bg-surface-3 text-bright" : "text-faint hover:bg-surface-2 hover:text-strong"
                            }`}
                        >
                            {t("customize.wholeResume")}
                        </button>
                        <button
                            type="button"
                            disabled={availableSectionKeys.length === 0}
                            onClick={() => {
                                const sectionKey = selectedCustomizeSection || availableSectionKeys[0] || null;
                                if (sectionKey) setSelectedCustomizeSection(sectionKey);
                                setScope("section");
                                setActiveCustomizeSection(null);
                            }}
                            aria-pressed={scope === "section"}
                            className={`h-8 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40 ${
                                scope === "section" ? "bg-surface-3 text-bright" : "text-faint hover:bg-surface-2 hover:text-strong"
                            }`}
                        >
                            {t("customize.currentSection")}
                        </button>
                    </div>
                    {scope === "section" && selectedCustomizeSection ? (
                        <div className="px-2 pb-2 pt-0.5">
                            <Select
                                value={selectedCustomizeSection}
                                onChange={(value) => setSelectedCustomizeSection(value)}
                                options={sectionOptions}
                                testId="customize-section-select"
                                compact
                            />
                        </div>
                    ) : null}
                </div>
            ) : null}

            {!activeCustomizeSection && searchQuery.trim() ? (
                <CustomizeGroupLabel label={t("customize.searchResults")} order={0} />
            ) : null}
            {!activeCustomizeSection && !searchQuery.trim() && scope === "resume" ? (
                <>
                    {CUSTOMIZE_GROUPS.map((group) => (
                        <CustomizeGroupLabel
                            key={group.id}
                            label={t(group.labelKey)}
                            order={group.order}
                        />
                    ))}
                </>
            ) : null}
            {!activeCustomizeSection && !searchQuery.trim() && scope === "section" ? (
                <CustomizeGroupLabel label={t("customize.sectionStyles")} order={400} />
            ) : null}

            {matchSearch(["editor.templates", "editor.browseTemplates", "editor.templatesTagline"]) && (
            <CustomizeSectionCard
                sectionKey="templates"
            >
                <div className="space-y-3">
                    <p className="text-xs text-faint">{t("editor.templatesTagline")}</p>
                    <button
                        type="button"
                        onClick={() => setIsTemplateBrowserOpen(true)}
                        className="group relative block w-full overflow-hidden rounded-xl border border-edge transition-colors hover:border-faint"
                    >
                        <div className="flex gap-2 p-3">
                            {builtinPreviewTemplates.map((tpl) => (
                                <div key={tpl.id} className="min-w-0 flex-1">
                                    <TemplatePreviewCard
                                        template={tpl}
                                        variant="catalog"
                                        showName={false}
                                        className="[&>div]:!h-auto [&>div]:!min-h-0 [&>div]:aspect-[0.72] [&>div]:!max-w-none [&>div]:!w-full [&>div]:!rounded-md [&>div]:!shadow-none"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-surface-2/20 to-surface-2/50">
                            <span className="flex items-center gap-2 rounded-full bg-strong px-5 py-2.5 text-sm font-semibold text-surface-2 shadow-lg transition-transform group-hover:scale-[1.03]">
                                <LayoutTemplate className="h-4 w-4" />
                                {t("editor.browseTemplates")}
                            </span>
                        </div>
                    </button>
                </div>
            </CustomizeSectionCard>
            )}

            <TemplateBrowserDialog
                open={isTemplateBrowserOpen}
                onClose={() => setIsTemplateBrowserOpen(false)}
                currentTemplateId={activeTemplateId}
            />

            {matchSearch(["customize.languageRegion", "customize.language", "customize.dateFormat"]) && (
            <CustomizeSectionCard
                sectionKey="languageRegion"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-faint mb-1.5 block">{t("customize.language")}</label>
                        <Select
                            value={settings.language}
                            onChange={(val) => updateSettings({
                                language: val,
                                dateFormat: getDefaultCvDateFormat(val),
                            })}
                            options={CV_LANGUAGE_OPTIONS}
                            testId="language-select"
                            optionTestIdPrefix="language-option"
                            searchable
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-faint mb-1.5 block">{t("customize.dateFormat")}</label>
                        <Select
                            value={settings.dateFormat}
                            onChange={(val) => handleUpdate('dateFormat', val)}
                            options={dateFormatOptions}
                        />
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.documentUnits", "customize.pageFormat", "customize.measurementSystem", "a4", "letter"]) && (
            <CustomizeSectionCard
                sectionKey="documentUnits"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-faint mb-1.5 block">{t("customize.pageFormat")}</label>
                        <Select
                            value={paperSize}
                            onChange={(val) => updatePaperSize(val as any)}
                            options={[
                                { value: 'a4', label: 'A4' },
                                { value: 'letter', label: t("customize.paperLetter") }
                            ]}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-faint mb-1.5 block">{t("customize.measurementSystem")}</label>
                        <Select
                            value={settings.measurementSystem}
                            onChange={(val) => handleUpdate('measurementSystem', val)}
                            testId="measurement-system-select"
                            optionTestIdPrefix="measurement-system-option"
                            options={[
                                { value: 'metric', label: t("customize.metric"), preview: 'cm / kg' },
                                { value: 'imperial', label: t("customize.imperial"), preview: 'ft / in / lb' }
                            ]}
                        />
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.typography", "customize.fontFamily", "customize.globalFontSize"]) && (
            <CustomizeSectionCard
                sectionKey="typography"
            >
                <div className="space-y-4">
                    <p className="text-[11px] text-faint leading-relaxed">{t("customize.fontRolesHint")}</p>
                    <div>
                        <label className="text-xs font-medium text-faint mb-1.5 block">{t("customize.fontPrimary")}</label>
                        <FontSelect
                            value={typographyFonts.primary || ""}
                            customFonts={allCustomFonts}
                            showInherit
                            inheritLabel={`${t("customize.inherit")} (${roleFonts.secondary})`}
                            onChange={(family) => updateRoleFont('primary', family)}
                        />
                        <FontImportButton onImport={(name, url) => handleImportFont(name, url, 'fontPrimary')} />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-faint mb-1.5 block">{t("customize.fontSecondary")}</label>
                        <FontSelect
                            value={settings.typography.fontFamily}
                            customFonts={allCustomFonts}
                            onChange={(fontFamily) => handleUpdate('typography', { fontFamily })}
                        />
                        <FontImportButton onImport={(name, url) => handleImportFont(name, url, 'typography')} />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-faint mb-1.5 block">{t("customize.fontMono")}</label>
                        <FontSelect
                            value={typographyFonts.mono || ""}
                            customFonts={allCustomFonts}
                            showInherit
                            inheritLabel={`${t("customize.inherit")} (${roleFonts.secondary})`}
                            onChange={(family) => updateRoleFont('mono', family)}
                        />
                        <FontImportButton onImport={(name, url) => handleImportFont(name, url, 'fontMono')} />
                    </div>

                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.globalFontSize")}</label>
                            <span className="text-[10px] text-faint font-medium">{formatPointSizeWithPx(settings.typography.fontSize)}</span>
                        </div>
                        <TickSlider
                            value={settings.typography.fontSize}
                            onChange={(v) => handleUpdate('typography', { fontSize: v })}
                            min={8} max={16} step={0.5} ticks={17}
                        />
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.headerTypography", "customize.fontFamily", "customize.fontSize", "customize.style", "customize.fontStyle", "customize.fontWeight", "customize.textDecoration", "customize.textTransform"]) && (
            <CustomizeSectionCard
                sectionKey="headerTypography"
            >
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-medium text-faint mb-1.5 block">{t("customize.fontFamily")}</label>
                        <FontSelect
                            value={settings.header.fontFamily}
                            customFonts={allCustomFonts}
                            showInherit
                            roleFonts={roleFonts}
                            inheritLabel={`${t("customize.inherit")} (${t("customize.fontRolePrimary")})`}
                            onChange={(fontFamily) => handleUpdate('header', { fontFamily })}
                        />
                        <FontImportButton onImport={(name, url) => handleImportFont(name, url, 'header')} />
                    </div>

                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.fontSize")}</label>
                            <span className="text-[10px] text-faint font-medium">{formatPointSizeWithPx(headerFontSizePt)}</span>
                        </div>
                        <TickSlider
                            value={headerFontSizePt}
                            onChange={(v) => handleUpdate('header', { fontSize: ptToPx(v) })}
                            min={12} max={54} step={1} ticks={15}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-faint mb-1.5 block">{t("customize.style")}</label>
                        <TextStyleToolbar
                            fontWeight={settings.header.fontWeight}
                            fontStyle={settings.header.fontStyle}
                            textDecoration={settings.header.textDecoration}
                            textTransform={settings.header.textTransform}
                            showTextTransform
                            onChange={(updates) => handleUpdate('header', updates)}
                        />
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.sectionHeadings", "customize.presetBaseline", "customize.presetClean", "customize.presetUnderline", "customize.presetBoxed", "customize.presetFilled", "customize.presetLeftBar", "customize.presetTopBottom", "customize.presetMinimal", "customize.borderSides", "customize.borderStyle", "customize.borderWidth", "customize.borderColor", "customize.borderRadius", "customize.alignment", "customize.letterSpacing", "customize.headingLineHeight", "customize.headingPadding", "customize.headingMarginBottom", "customize.margin", "customize.top", "customize.bottom", "customize.left", "customize.right", "customize.headingBorderColor", "customize.headingBackgroundColor"]) && (
            <CustomizeSectionCard
                sectionKey="sectionHeadings"
            >
                {/* Preset Grid */}
                <div>
                    <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.presets")}</label>
                    <div className="grid grid-cols-4 gap-2">
                        {HEADING_PRESETS.map(preset => {
                            const isActive = settings.headings.preset === preset.key;
                            const p = preset.settings;
                            const bdr = p.border || {};
                            const previewBorderColor = bdr.color || settings.colors.accent;
                            // Mini visual preview
                            return (
                                <button
                                    key={preset.key}
                                    type="button"
                                    onClick={() => {
                                        const applied = { ...preset.settings };
                                        // For filled preset, use a lightened accent
                                        if (preset.key === "filled") {
                                            applied.backgroundColor = settings.colors.accent + "22";
                                        }
                                        handleUpdate('headings', applied);
                                    }}
                                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors ${isActive ? "bg-edge border-accent text-strong" : "bg-surface-1 border-edge text-faint hover:border-faint hover:text-strong"}`}
                                >
                                    {/* Mini preview */}
                                    <div className="w-full h-5 flex items-center" style={{ justifyContent: p.textAlign === "center" ? "center" : p.textAlign === "right" ? "flex-end" : "flex-start" }}>
                                        <div
                                            className="h-3.5 rounded-[1px]"
                                            style={{
                                                width: "80%",
                                                ...(preset.key === "filled" ? { backgroundColor: settings.colors.accent + "33" } : {}),
                                                ...(bdr.bottom ? { borderBottom: `${Math.min(bdr.width, 3)}px ${bdr.style} ${previewBorderColor}` } : {}),
                                                ...(bdr.top ? { borderTop: `${Math.min(bdr.width, 3)}px ${bdr.style} ${previewBorderColor}` } : {}),
                                                ...(bdr.left ? { borderLeft: `${Math.min(bdr.width, 3)}px ${bdr.style} ${previewBorderColor}` } : {}),
                                                ...(bdr.right ? { borderRight: `${Math.min(bdr.width, 3)}px ${bdr.style} ${previewBorderColor}` } : {}),
                                                ...(bdr.radius ? { borderRadius: `${bdr.radius}px` } : {}),
                                                padding: '1px 2px',
                                            }}
                                        >
                                            <div className="w-full h-1.5 bg-current rounded-full opacity-40" />
                                        </div>
                                    </div>
                                    <span className="text-[9px] leading-tight">{t(preset.labelKey)}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Font Family */}
                    <div>
                        <label className="text-xs font-medium text-faint mb-1.5 block">{t("customize.fontFamily")}</label>
                        <FontSelect
                            value={settings.headings.fontFamily || ""}
                            customFonts={allCustomFonts}
                            roleFonts={roleFonts}
                            showInherit
                            inheritLabel={`${t("customize.inherit")} (${t("customize.fontRolePrimary")})`}
                            onChange={(fontFamily) => handleUpdate('headings', { fontFamily })}
                        />
                        <FontImportButton onImport={(name, url) => handleImportFont(name, url, 'headings')} />
                    </div>

                    {/* Font Size */}
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.fontSize")}</label>
                            <span className="text-[10px] text-faint font-medium">{settings.headings.fontSize}px</span>
                        </div>
                        <TickSlider
                            value={settings.headings.fontSize}
                            onChange={(v) => handleUpdate('headings', { fontSize: v })}
                            min={8} max={24} step={1} ticks={9}
                        />
                    </div>

                    {/* Text Style */}
                    <div>
                        <label className="text-xs font-medium text-faint mb-1.5 block">{t("customize.style")}</label>
                        <TextStyleToolbar
                            fontWeight={settings.headings.fontWeight || "700"}
                            fontStyle={settings.headings.fontStyle || "normal"}
                            textDecoration={settings.headings.textDecoration || "none"}
                            textTransform={settings.headings.capitalization === "uppercase" ? "uppercase" : "capitalize"}
                            showTextTransform
                            onChange={(updates) => {
                                const patch: Record<string, any> = {};
                                if (updates.fontWeight) patch.fontWeight = updates.fontWeight;
                                if (updates.fontStyle) patch.fontStyle = updates.fontStyle;
                                if (updates.textDecoration) patch.textDecoration = updates.textDecoration;
                                if (updates.textTransform) patch.capitalization = updates.textTransform === "uppercase" ? "uppercase" : "capitalize";
                                handleUpdate('headings', patch);
                            }}
                        />
                    </div>

                    {/* Alignment */}
                    <div>
                        <label className="text-xs font-medium text-faint mb-1.5 block">{t("customize.alignment")}</label>
                        <AlignmentPicker
                            value={settings.headings.textAlign || "left"}
                            onChange={(val) => handleUpdate('headings', { textAlign: val })}
                        />
                    </div>

                    {/* Letter Spacing */}
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.letterSpacing")}</label>
                            <span className="text-[10px] text-faint font-medium">{settings.headings.letterSpacing ?? 0}px</span>
                        </div>
                        <TickSlider
                            value={settings.headings.letterSpacing ?? 0}
                            onChange={(v) => handleUpdate('headings', { letterSpacing: v })}
                            min={0} max={8} step={0.5} ticks={9}
                        />
                    </div>

                    {/* Line Height */}
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.headingLineHeight")}</label>
                            <span className="text-[10px] text-faint font-medium">{(settings.headings.lineHeight ?? 1.15).toFixed(2)}</span>
                        </div>
                        <TickSlider
                            value={settings.headings.lineHeight ?? 1.15}
                            onChange={(v) => handleUpdate('headings', { lineHeight: v })}
                            min={0.8} max={2.0} step={0.05} ticks={9}
                        />
                    </div>

                    {/* Border */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.borderSection")}</label>
                        <BorderEditor
                            border={settings.headings.border ?? { style: "solid", width: 2, color: "", radius: 0, top: false, bottom: true, left: false, right: false, dashLength: 6, dashGap: 4 }}
                            fallbackColor={settings.colors.accent}
                            onChange={(updates) => {
                                const currentBorder = settings.headings.border ?? { style: "solid", width: 2, color: "", radius: 0, top: false, bottom: true, left: false, right: false, dashLength: 6, dashGap: 4 };
                                handleUpdate('headings', { border: { ...currentBorder, ...updates } });
                            }}
                        />
                    </div>

                    {/* Padding */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.headingPadding")}</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.top")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.headings.paddingTop ?? 0}px</span>
                                </div>
                                <TickSlider value={settings.headings.paddingTop ?? 0} onChange={(v) => handleUpdate('headings', { paddingTop: v })} min={0} max={20} step={1} ticks={5} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.bottom")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.headings.paddingBottom ?? 4}px</span>
                                </div>
                                <TickSlider value={settings.headings.paddingBottom ?? 4} onChange={(v) => handleUpdate('headings', { paddingBottom: v })} min={0} max={20} step={1} ticks={5} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.left")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.headings.paddingLeft ?? 0}px</span>
                                </div>
                                <TickSlider value={settings.headings.paddingLeft ?? 0} onChange={(v) => handleUpdate('headings', { paddingLeft: v })} min={0} max={20} step={1} ticks={5} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.right")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.headings.paddingRight ?? 0}px</span>
                                </div>
                                <TickSlider value={settings.headings.paddingRight ?? 0} onChange={(v) => handleUpdate('headings', { paddingRight: v })} min={0} max={20} step={1} ticks={5} />
                            </div>
                        </div>
                    </div>

                    {/* Margin */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.margin")}</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.top")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.headings.marginTop ?? 0}px</span>
                                </div>
                                <TickSlider value={settings.headings.marginTop ?? 0} onChange={(v) => handleUpdate('headings', { marginTop: v })} min={0} max={32} step={1} ticks={9} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.bottom")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.headings.marginBottom ?? 12}px</span>
                                </div>
                                <TickSlider value={settings.headings.marginBottom ?? 12} onChange={(v) => handleUpdate('headings', { marginBottom: v })} min={0} max={32} step={1} ticks={9} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.left")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.headings.marginLeft ?? 0}px</span>
                                </div>
                                <TickSlider value={settings.headings.marginLeft ?? 0} onChange={(v) => handleUpdate('headings', { marginLeft: v })} min={0} max={32} step={1} ticks={9} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.right")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.headings.marginRight ?? 0}px</span>
                                </div>
                                <TickSlider value={settings.headings.marginRight ?? 0} onChange={(v) => handleUpdate('headings', { marginRight: v })} min={0} max={32} step={1} ticks={9} />
                            </div>
                        </div>
                    </div>

                    {/* Border Color */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.headingBorderColor")}</label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleUpdate('headings', { borderColor: "" })}
                                className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${!settings.headings.borderColor ? "bg-edge border-accent text-strong" : "bg-surface-1 border-edge text-faint hover:text-strong"}`}
                            >
                                {t("customize.inheritAccent")}
                            </button>
                            <div className="relative">
                                <div className="w-7 h-7 rounded-lg border border-edge cursor-pointer" style={{ backgroundColor: settings.headings.borderColor || settings.colors.accent }} />
                                <input
                                    type="color"
                                    value={settings.headings.borderColor || settings.colors.accent}
                                    onInput={(e) => handleUpdate('headings', { borderColor: (e.target as HTMLInputElement).value })}
                                    onChange={(e) => handleUpdate('headings', { borderColor: e.target.value })}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Background Color */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.headingBackgroundColor")}</label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleUpdate('headings', { backgroundColor: "" })}
                                className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${!settings.headings.backgroundColor ? "bg-edge border-accent text-strong" : "bg-surface-1 border-edge text-faint hover:text-strong"}`}
                            >
                                {t("customize.transparent")}
                            </button>
                            <div className="relative">
                                <div className="w-7 h-7 rounded-lg border border-edge cursor-pointer" style={{ backgroundColor: settings.headings.backgroundColor || "transparent" }} />
                                <input
                                    type="color"
                                    value={settings.headings.backgroundColor || "#ffffff"}
                                    onInput={(e) => handleUpdate('headings', { backgroundColor: (e.target as HTMLInputElement).value })}
                                    onChange={(e) => handleUpdate('headings', { backgroundColor: e.target.value })}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.sectionContent", "customize.contentPresetPlain", "customize.contentPresetOutline", "customize.contentPresetCard", "customize.contentPresetFilled", "customize.contentPresetLeftBar", "customize.contentPresetSplit", "customize.borderSection", "customize.borderSides", "customize.borderStyle", "customize.borderWidth", "customize.borderColor", "customize.borderRadius", "customize.dashLength", "customize.dashGap", "customize.padding", "customize.margin", "customize.contentBackgroundColor", "customize.top", "customize.bottom", "customize.left", "customize.right"]) && (
            <CustomizeSectionCard
                sectionKey="sectionContent"
            >
                <div>
                    <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.presets")}</label>
                    <div className="grid grid-cols-3 gap-3">
                        {CONTENT_STYLE_PRESETS.map((preset) => {
                            const isActive = settings.contentStyle.preset === preset.key;
                            const previewBorder = preset.settings.border || defaultSettings.contentStyle.border;
                            const previewBorderColor = previewBorder.color || settings.colors.accent;
                            const previewBackground = preset.key === "filled"
                                ? settings.colors.accent + "22"
                                : preset.key === "card"
                                    ? settings.colors.accent + "12"
                                    : preset.settings.backgroundColor || "transparent";

                            return (
                                <button
                                    key={preset.key}
                                    type="button"
                                    onClick={() => {
                                        const applied = { ...preset.settings };
                                        if (preset.key === "filled") {
                                            applied.backgroundColor = settings.colors.accent + "22";
                                        } else if (preset.key === "card") {
                                            applied.backgroundColor = settings.colors.accent + "12";
                                        }
                                        handleUpdate("contentStyle" as any, applied);
                                    }}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-colors ${isActive ? "bg-edge border-accent text-strong" : "bg-surface-1 border-edge text-faint hover:border-faint hover:text-strong"}`}
                                >
                                    <div className="w-full h-12 rounded-xl bg-surface-0 border border-surface-5 p-2 flex items-center">
                                        <div
                                            className="w-full h-full"
                                            style={{
                                                borderRadius: `${previewBorder.radius ?? 0}px`,
                                                backgroundColor: previewBackground,
                                                ...(previewBorder.top ? { borderTop: `${Math.min(previewBorder.width ?? 0, 3)}px ${previewBorder.style} ${previewBorderColor}` } : {}),
                                                ...(previewBorder.bottom ? { borderBottom: `${Math.min(previewBorder.width ?? 0, 3)}px ${previewBorder.style} ${previewBorderColor}` } : {}),
                                                ...(previewBorder.left ? { borderLeft: `${Math.min(previewBorder.width ?? 0, 3)}px ${previewBorder.style} ${previewBorderColor}` } : {}),
                                                ...(previewBorder.right ? { borderRight: `${Math.min(previewBorder.width ?? 0, 3)}px ${previewBorder.style} ${previewBorderColor}` } : {}),
                                                padding: "4px 6px",
                                            }}
                                        >
                                            <div className="grid h-full gap-1" style={{ gridTemplateColumns: "0.45fr 1fr 0.45fr" }}>
                                                <div className="rounded-full bg-current opacity-30" />
                                                <div className="space-y-1">
                                                    <div className="h-1.5 rounded-full bg-current opacity-55" />
                                                    <div className="h-1.5 rounded-full bg-current opacity-35 w-4/5" />
                                                </div>
                                                <div className="rounded-full bg-current opacity-30" />
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-[10px] leading-tight">{t(preset.labelKey)}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-5">
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.borderSection")}</label>
                        <BorderEditor
                            border={settings.contentStyle.border ?? defaultSettings.contentStyle.border}
                            fallbackColor={settings.colors.accent}
                            onChange={(updates) => {
                                const currentBorder = settings.contentStyle.border ?? defaultSettings.contentStyle.border;
                                handleUpdate("contentStyle" as any, {
                                    border: { ...currentBorder, ...updates },
                                });
                            }}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.padding")}</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.top")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.contentStyle.paddingTop ?? 0}px</span>
                                </div>
                                <TickSlider value={settings.contentStyle.paddingTop ?? 0} onChange={(v) => handleUpdate("contentStyle" as any, { paddingTop: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.bottom")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.contentStyle.paddingBottom ?? 0}px</span>
                                </div>
                                <TickSlider value={settings.contentStyle.paddingBottom ?? 0} onChange={(v) => handleUpdate("contentStyle" as any, { paddingBottom: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.left")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.contentStyle.paddingLeft ?? 0}px</span>
                                </div>
                                <TickSlider value={settings.contentStyle.paddingLeft ?? 0} onChange={(v) => handleUpdate("contentStyle" as any, { paddingLeft: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.right")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.contentStyle.paddingRight ?? 0}px</span>
                                </div>
                                <TickSlider value={settings.contentStyle.paddingRight ?? 0} onChange={(v) => handleUpdate("contentStyle" as any, { paddingRight: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.margin")}</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.top")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.contentStyle.marginTop ?? 0}px</span>
                                </div>
                                <TickSlider value={settings.contentStyle.marginTop ?? 0} onChange={(v) => handleUpdate("contentStyle" as any, { marginTop: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.bottom")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.contentStyle.marginBottom ?? 0}px</span>
                                </div>
                                <TickSlider value={settings.contentStyle.marginBottom ?? 0} onChange={(v) => handleUpdate("contentStyle" as any, { marginBottom: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.left")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.contentStyle.marginLeft ?? 0}px</span>
                                </div>
                                <TickSlider value={settings.contentStyle.marginLeft ?? 0} onChange={(v) => handleUpdate("contentStyle" as any, { marginLeft: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.right")}</span>
                                    <span className="text-[10px] text-faint font-medium">{settings.contentStyle.marginRight ?? 0}px</span>
                                </div>
                                <TickSlider value={settings.contentStyle.marginRight ?? 0} onChange={(v) => handleUpdate("contentStyle" as any, { marginRight: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.contentBackgroundColor")}</label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleUpdate("contentStyle" as any, { backgroundColor: "" })}
                                className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${!settings.contentStyle.backgroundColor ? "bg-edge border-accent text-strong" : "bg-surface-1 border-edge text-faint hover:text-strong"}`}
                            >
                                {t("customize.transparent")}
                            </button>
                            <div className="relative">
                                <div className="w-7 h-7 rounded-lg border border-edge cursor-pointer" style={{ backgroundColor: settings.contentStyle.backgroundColor || "transparent" }} />
                                <input
                                    type="color"
                                    value={settings.contentStyle.backgroundColor || "#ffffff"}
                                    onInput={(e) => handleUpdate("contentStyle" as any, { backgroundColor: (e.target as HTMLInputElement).value })}
                                    onChange={(e) => handleUpdate("contentStyle" as any, { backgroundColor: e.target.value })}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.spacing", "customize.lineHeight", "customize.leftRightMargin", "customize.topBottomMargin", "customize.spaceBetweenEntries"]) && (
            <CustomizeSectionCard
                sectionKey="spacing"
            >
                <div className="space-y-5">
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.lineHeight")}</label>
                            <span className="text-[10px] text-faint font-medium">
                                {`${formatDisplayNumber(settings.typography.lineHeight)}x • ${formatDisplayNumber(lineHeightPx)}px • ${formatDisplayNumber(lineHeightPt)}pt`}
                            </span>
                        </div>
                        <TickSlider
                            value={settings.typography.lineHeight}
                            onChange={(v) => handleUpdate('typography', { lineHeight: v })}
                            min={1} max={2} step={0.05} ticks={11}
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.leftRightMargin")}</label>
                            <span data-testid="spacing-margin-h-display" className="text-[10px] text-faint font-medium">{formatLengthWithPxFromMm(settings.spacing.marginH, settings.measurementSystem)}</span>
                        </div>
                        <TickSlider
                            value={settings.spacing.marginH}
                            onChange={(v) => handleUpdate('spacing', { marginH: v })}
                            min={0} max={50} step={1} ticks={11}
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.topBottomMargin")}</label>
                            <span className="text-[10px] text-faint font-medium">{formatLengthWithPxFromMm(settings.spacing.marginV, settings.measurementSystem)}</span>
                        </div>
                        <TickSlider
                            value={settings.spacing.marginV}
                            onChange={(v) => handleUpdate('spacing', { marginV: v })}
                            min={0} max={50} step={1} ticks={11}
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.spaceBetweenEntries")}</label>
                            <span className="text-[10px] text-faint font-medium">{formatLengthFromPx(settings.spacing.itemSpacing, settings.measurementSystem)}</span>
                        </div>
                        <TickSlider
                            value={settings.spacing.itemSpacing}
                            onChange={(v) => handleUpdate('spacing', { itemSpacing: v })}
                            min={0} max={48} step={1} ticks={13}
                        />
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.footer", "customize.footerComingSoon"]) && (
            <CustomizeSectionCard
                sectionKey="footer"
            >
                <div className="space-y-6">
                    <div className="space-y-3">
                        {[
                            { key: "showPageNumbers", label: t("customize.footerPlaceholderPages") },
                            { key: "showEmail", label: t("editor.emailLabel") },
                            { key: "showPhone", label: t("editor.phoneLabel") },
                            { key: "showName", label: t("saveTemplate.name") },
                        ].map((item) => (
                            <ApplyToCheckbox
                                key={item.key}
                                label={item.label}
                                checked={Boolean((settings.footer as any)?.[item.key])}
                                onChange={(checked) => handleUpdate("footer", { [item.key]: checked })}
                            />
                        ))}
                    </div>

                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={() => setFooterAdvancedOpen((open) => !open)}
                            className="inline-flex items-center gap-2 text-sm text-strong/80 hover:text-strong transition-colors"
                        >
                            <span>{t("customize.footerAdvanced")}</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${footerAdvancedOpen ? "rotate-180" : ""}`} />
                        </button>

                        {footerAdvancedOpen ? (
                            <div className="rounded-2xl bg-surface-3 p-4 space-y-4 border border-surface-5">
                                <ApplyToCheckbox
                                    label={t("customize.footerCustom")}
                                    checked={settings.footer?.show || false}
                                    onChange={(checked) => handleUpdate("footer", { show: checked })}
                                />

                                {settings.footer?.show ? (
                                    <>
                                        <div className="space-y-3">
                                            <label className="text-xs font-semibold text-strong/90">{t("customize.footerInsertPlaceholders")}</label>
                                            <div className="flex flex-wrap gap-2">
                                                {[
                                                    { label: t("customize.footerPlaceholderName"), tag: "{{name}}" },
                                                    { label: t("editor.phoneLabel"), tag: "{{phone}}" },
                                                    { label: t("editor.emailLabel"), tag: "{{email}}" },
                                                    { label: t("customize.footerPlaceholderPages"), tag: "{{page}} / {{pages}}" },
                                                ].map((item) => (
                                                    <button
                                                        key={item.tag}
                                                        type="button"
                                                        className="px-3 py-1.5 rounded-full border border-edge bg-surface-3 text-xs text-dim hover:text-strong hover:border-edge-strong transition-colors flex items-center gap-1.5"
                                                        onClick={() => insertFooterPlaceholder(item.tag)}
                                                    >
                                                        <span className="font-medium text-strong/70">{item.label}</span>
                                                        <span className="opacity-60">{item.tag}</span>
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-[11px] leading-relaxed text-dim">
                                                {t("customize.footerPlaceholderHint")}
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.footerLeftColumn")}</label>
                                                <textarea
                                                    rows={3}
                                                    value={settings.footer?.left || ""}
                                                    onFocus={() => setActiveFooterField("left")}
                                                    onChange={(e) => handleUpdate("footer", { left: e.target.value })}
                                                    className="w-full resize-none bg-surface-1 border border-edge rounded-2xl px-4 py-3 text-sm text-strong focus:outline-none focus:border-accent transition-colors placeholder:text-strong/20"
                                                    placeholder={t("common.example", { example: "{{name}}" })}
                                                />
                                            </div>

                                            <div>
                                                <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.footerMiddleColumn")}</label>
                                                <textarea
                                                    rows={3}
                                                    value={settings.footer?.middle || ""}
                                                    onFocus={() => setActiveFooterField("middle")}
                                                    onChange={(e) => handleUpdate("footer", { middle: e.target.value })}
                                                    className="w-full resize-none bg-surface-1 border border-edge rounded-2xl px-4 py-3 text-sm text-strong focus:outline-none focus:border-accent transition-colors placeholder:text-strong/20"
                                                    placeholder={t("common.example", { example: "{{email}}" })}
                                                />
                                            </div>

                                            <div>
                                                <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.footerRightColumn")}</label>
                                                <textarea
                                                    rows={3}
                                                    value={settings.footer?.right || ""}
                                                    onFocus={() => setActiveFooterField("right")}
                                                    onChange={(e) => handleUpdate("footer", { right: e.target.value })}
                                                    className="w-full resize-none bg-surface-1 border border-edge rounded-2xl px-4 py-3 text-sm text-strong focus:outline-none focus:border-accent transition-colors placeholder:text-strong/20"
                                                    placeholder={t("common.example", { example: "{{page}} / {{pages}}" })}
                                                />
                                            </div>

                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="text-xs font-semibold text-strong/90">{t("customize.footerHeight")}</label>
                                                    <span className="text-[10px] text-faint font-medium">
                                                        {t("customize.footerLines", { count: settings.footer?.heightLines || 1 })}
                                                    </span>
                                                </div>
                                                <TickSlider
                                                    value={settings.footer?.heightLines || 1}
                                                    onChange={(v) => handleUpdate("footer", { heightLines: v })}
                                                    min={1}
                                                    max={5}
                                                    step={1}
                                                    ticks={5}
                                                />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-xs leading-relaxed text-dim">
                                        {t("customize.footerOffHint")}
                                    </p>
                                )}
                            </div>
                        ) : null}
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.entryLayout", "customize.entryLayoutPreset", "customize.columnProportions", "customize.titleFontSize", "customize.subtitleFontSize", "customize.subtitleStyle", "customize.subtitlePlacement", "customize.descriptionIndentation", "customize.listStyle", "customize.entrySkills", "customize.showEntrySkills", "customize.entrySkillsBelowBody", "customize.entrySkillsUnderSubtitle"]) && (
            <CustomizeSectionCard
                sectionKey="entryLayout"
            >
                <div className="space-y-6">
                    {/* Layout Presets */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.entryLayoutPreset")}</label>
                        <div className="grid grid-cols-2 gap-3">
                            {([
                                { value: "contentRight" as const, labelKey: "customize.entryLayoutContentRight", preview: (
                                    <div className="flex gap-2 w-full items-start opacity-80">
                                        <div className="flex flex-col gap-1 flex-1">
                                            <div className="w-full h-1 bg-current rounded-full" />
                                            <div className="w-3/4 h-1 bg-current rounded-full" />
                                        </div>
                                        <div className="flex flex-col gap-1 w-1/4">
                                            <div className="w-full h-1 rounded-full border border-current" />
                                            <div className="w-3/4 h-1 rounded-full border border-current" />
                                        </div>
                                    </div>
                                )},
                                { value: "contentLeft" as const, labelKey: "customize.entryLayoutContentLeft", preview: (
                                    <div className="flex gap-2 w-full items-start opacity-80">
                                        <div className="flex flex-col gap-1 w-1/4">
                                            <div className="w-full h-1 rounded-full border border-current" />
                                            <div className="w-3/4 h-1 rounded-full border border-current" />
                                        </div>
                                        <div className="flex flex-col gap-1 flex-1">
                                            <div className="w-full h-1 bg-current rounded-full" />
                                            <div className="w-3/4 h-1 bg-current rounded-full" />
                                        </div>
                                    </div>
                                )},
                                { value: "threeCol" as const, labelKey: "customize.entryLayoutThreeCol", preview: (
                                    <div className="flex gap-1.5 w-full items-start opacity-80">
                                        <div className="w-1/5 h-1 rounded-full border border-current shrink-0" />
                                        <div className="flex-1 flex flex-col gap-1">
                                            <div className="w-full h-1 bg-current rounded-full" />
                                            <div className="w-3/4 h-1 bg-current rounded-full" />
                                        </div>
                                        <div className="w-1/5 h-1 rounded-full border border-current shrink-0" />
                                    </div>
                                )},
                                { value: "singleCol" as const, labelKey: "customize.entryLayoutSingleCol", preview: (
                                    <div className="flex flex-col gap-1 w-full items-start opacity-80">
                                        <div className="flex justify-between w-full">
                                            <div className="w-1/2 h-1 bg-current rounded-full" />
                                            <div className="w-1/4 h-1 rounded-full border border-current" />
                                        </div>
                                        <div className="w-3/4 h-1 bg-current rounded-full" />
                                    </div>
                                )},
                            ]).map((preset) => (
                                <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() => handleUpdate('entryLayout' as any, { layout: preset.value })}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors ${
                                        settings.entryLayout.layout === preset.value
                                            ? "bg-edge border-accent text-strong"
                                            : "bg-surface-1 border-edge text-faint hover:border-faint"
                                    }`}
                                >
                                    <div className="w-full h-6 flex items-center justify-center px-2">
                                        {preset.preview}
                                    </div>
                                    <span className="text-[11px] font-medium">{t(preset.labelKey)}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Column Proportions */}
                    {(settings.entryLayout.layout === "threeCol" || settings.entryLayout.layout === "contentRight" || settings.entryLayout.layout === "contentLeft") && (
                        <div>
                            <div className="flex justify-between items-end mb-3">
                                <label className="text-xs font-semibold text-strong/90">{t("customize.columnProportions")}</label>
                                {settings.entryLayout.layout === "threeCol" ? (
                                    <button
                                        type="button"
                                        onClick={() => handleUpdate('entryLayout' as any, { leftWidth: 17, middleWidth: 66, rightWidth: 17 })}
                                        className="text-[10px] font-medium text-faint hover:text-accent transition-colors flex items-center gap-1 bg-surface-1 hover:bg-edge border border-edge px-2 py-0.5 rounded-md"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        {t("customize.resetColumnProportions")}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleUpdate('entryLayout' as any, { leftWidth: settings.entryLayout.layout === "contentRight" ? 25 : 75 })}
                                        className="text-[10px] font-medium text-faint hover:text-accent transition-colors flex items-center gap-1 bg-surface-1 hover:bg-edge border border-edge px-2 py-0.5 rounded-md"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        {t("customize.resetDefault")}
                                    </button>
                                )}
                            </div>
                            
                            {settings.entryLayout.layout === "threeCol" ? (
                                <div className="bg-surface-1 border border-edge p-3 rounded-xl space-y-3">
                                    <ProportionsSlider
                                        left={settings.entryLayout.leftWidth}
                                        middle={settings.entryLayout.middleWidth}
                                        right={settings.entryLayout.rightWidth}
                                        onChange={(l, m, r) => handleUpdate('entryLayout' as any, {
                                            leftWidth: l,
                                            middleWidth: m,
                                            rightWidth: r
                                        })}
                                    />
                                    <div className="flex justify-between text-[10px] items-center px-1">
                                        <span className="text-strong/70 w-8 text-left">{settings.entryLayout.leftWidth}%</span>
                                        <span className="text-accent font-bold w-8 text-center">{settings.entryLayout.middleWidth}%</span>
                                        <span className="text-strong/70 w-8 text-right">{settings.entryLayout.rightWidth}%</span>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex justify-between text-[10px] mb-2 px-1">
                                        <span className="text-strong/70">{settings.entryLayout.leftWidth}%</span>
                                        <span className="text-strong/70">{100 - settings.entryLayout.leftWidth}%</span>
                                    </div>
                                    <TickSlider
                                        value={settings.entryLayout.leftWidth}
                                        onChange={(v) => handleUpdate('entryLayout' as any, { leftWidth: v })}
                                        min={10} max={90} step={1} ticks={17}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Title Font Size */}
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.titleFontSize")}</label>
                            <span className="text-[10px] text-faint font-medium">{settings.entryLayout.titleFontSize}pt</span>
                        </div>
                        <TickSlider
                            value={settings.entryLayout.titleFontSize}
                            onChange={(v) => handleUpdate('entryLayout' as any, { titleFontSize: v })}
                            min={8} max={16} step={0.5} ticks={17}
                        />
                    </div>

                    {/* Subtitle Font Size */}
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.subtitleFontSize")}</label>
                            <span className="text-[10px] text-faint font-medium">{settings.entryLayout.subtitleFontSize}pt</span>
                        </div>
                        <TickSlider
                            value={settings.entryLayout.subtitleFontSize}
                            onChange={(v) => handleUpdate('entryLayout' as any, { subtitleFontSize: v })}
                            min={8} max={16} step={0.5} ticks={17}
                        />
                    </div>

                    {/* Subtitle Style */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.subtitleStyle")}</label>
                        <TextStyleToolbar
                            fontWeight={settings.entryLayout.subtitleFontWeight}
                            fontStyle={settings.entryLayout.subtitleFontStyle}
                            textDecoration={settings.entryLayout.subtitleTextDecoration}
                            showTextTransform={false}
                            showWeightPicker={true}
                            onChange={(updates) => {
                                const patch: Record<string, any> = {};
                                if (updates.fontWeight) patch.subtitleFontWeight = updates.fontWeight;
                                if (updates.fontStyle) patch.subtitleFontStyle = updates.fontStyle;
                                if (updates.textDecoration) patch.subtitleTextDecoration = updates.textDecoration;
                                handleUpdate('entryLayout' as any, patch);
                            }}
                        />
                    </div>

                    {/* Subtitle Placement */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.subtitlePlacement")}</label>
                        <div className="flex bg-surface-1 p-1 rounded-xl border border-edge">
                            {([
                                { value: "sameLine" as const, labelKey: "customize.subtitleSameLine" },
                                { value: "nextLine" as const, labelKey: "customize.subtitleNextLine" },
                            ]).map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleUpdate('entryLayout' as any, { subtitlePlacement: opt.value })}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                                        settings.entryLayout.subtitlePlacement === opt.value
                                            ? "bg-edge text-strong"
                                            : "text-faint hover:text-strong"
                                    }`}
                                >
                                    {t(opt.labelKey)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Description Indentation */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.descriptionIndentation")}</label>
                        <ApplyToCheckbox
                            label={t("customize.indentBody")}
                            checked={settings.entryLayout.indentBody}
                            onChange={(checked) => handleUpdate('entryLayout' as any, { indentBody: checked })}
                        />
                    </div>

                    {/* List Style */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.listStyle")}</label>
                        <div className="flex gap-2">
                            {([
                                { value: "bullet" as const, labelKey: "customize.listBullet", icon: "•" },
                                { value: "hyphen" as const, labelKey: "customize.listHyphen", icon: "–" },
                            ]).map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleUpdate('entryLayout' as any, { listStyle: opt.value })}
                                    className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                        settings.entryLayout.listStyle === opt.value
                                            ? "bg-edge border-accent text-strong"
                                            : "bg-surface-1 border-edge text-faint hover:text-strong hover:border-faint"
                                    }`}
                                >
                                    <span className="font-serif font-bold opacity-70">{opt.icon}</span>
                                    {t(opt.labelKey)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Entry Skills Badges */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.entrySkills")}</label>
                        <ApplyToCheckbox
                            label={t("customize.showEntrySkills")}
                            checked={(settings.entryLayout as any).showEntrySkills}
                            onChange={(checked) => handleUpdate('entryLayout' as any, { showEntrySkills: checked })}
                        />
                        {(settings.entryLayout as any).showEntrySkills && (
                            <div className="flex bg-surface-1 p-1 rounded-xl border border-edge mt-3">
                                {([
                                    { value: "belowBody" as const, labelKey: "customize.entrySkillsBelowBody" },
                                    { value: "underSubtitle" as const, labelKey: "customize.entrySkillsUnderSubtitle" },
                                ]).map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handleUpdate('entryLayout' as any, { entrySkillsPlacement: opt.value })}
                                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                                            (settings.entryLayout as any).entrySkillsPlacement === opt.value
                                                ? "bg-edge text-strong"
                                                : "text-faint hover:text-strong"
                                        }`}
                                    >
                                        {t(opt.labelKey)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.repoBadge", "customize.repoBadgeColorMode", "customize.repoBadgeTypography", "customize.repoBadgeBorder", "customize.repoBadgeSpacing", "customize.repoBadgeShowVisibility"]) && (
            <CustomizeSectionCard
                sectionKey="repoBadge"
            >
                <div className="space-y-6">
                    {/* Color mode */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.repoBadgeColorMode")}</label>
                        <div className="grid grid-cols-2 gap-2">
                            {([
                                { value: "platform" as const, label: t("customize.repoBadgeColorPlatform") },
                                { value: "accent" as const, label: t("customize.repoBadgeColorAccent") },
                                { value: "monochrome" as const, label: t("customize.repoBadgeColorMonochrome") },
                                { value: "custom" as const, label: t("customize.repoBadgeColorCustom") },
                            ]).map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleUpdate('repoBadge' as any, { colorMode: opt.value })}
                                    className={`py-2 rounded-xl border text-xs font-medium transition-colors ${
                                        (settings as any).repoBadge.colorMode === opt.value
                                            ? "bg-edge border-accent text-strong"
                                            : "bg-surface-1 border-edge text-faint hover:text-strong hover:border-faint"
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {(settings as any).repoBadge.colorMode === "custom" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <ColorPickerCard
                                label={t("customize.textColor")}
                                value={(settings as any).repoBadge.textColor || settings.colors.text}
                                icon={TypeIcon}
                                onChange={(value) => handleUpdate('repoBadge' as any, { textColor: value })}
                            />
                            <ColorPickerCard
                                label={t("customize.backgroundColor")}
                                value={(settings as any).repoBadge.backgroundColor || settings.colors.accent}
                                icon={Square}
                                onChange={(value) => handleUpdate('repoBadge' as any, { backgroundColor: value })}
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="flex justify-between items-end mb-1.5">
                                <label className="text-[10px] text-faint">{t("customize.repoBadgeBgOpacity")}</label>
                                <span className="text-[10px] text-faint font-medium">{Math.round((settings as any).repoBadge.backgroundOpacity * 100)}%</span>
                            </div>
                            <TickSlider value={(settings as any).repoBadge.backgroundOpacity} onChange={(v) => handleUpdate('repoBadge' as any, { backgroundOpacity: v })} min={0} max={1} step={0.05} ticks={6} />
                        </div>
                        <div>
                            <div className="flex justify-between items-end mb-1.5">
                                <label className="text-[10px] text-faint">{t("customize.repoBadgeBorderOpacity")}</label>
                                <span className="text-[10px] text-faint font-medium">{Math.round((settings as any).repoBadge.borderOpacity * 100)}%</span>
                            </div>
                            <TickSlider value={(settings as any).repoBadge.borderOpacity} onChange={(v) => handleUpdate('repoBadge' as any, { borderOpacity: v })} min={0} max={1} step={0.05} ticks={6} />
                        </div>
                    </div>

                    {/* Typography */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-strong/90 block">{t("customize.repoBadgeTypography")}</label>
                        <TextStyleToolbar
                            fontWeight={(settings as any).repoBadge.fontWeight}
                            fontStyle={(settings as any).repoBadge.fontStyle}
                            textDecoration="none"
                            textTransform={(settings as any).repoBadge.textTransform}
                            showTextTransform
                            onChange={(updates) => handleUpdate('repoBadge' as any, updates)}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="flex justify-between items-end mb-1.5">
                                    <label className="text-[10px] text-faint">{t("customize.fontSize")}</label>
                                    <span className="text-[10px] text-faint font-medium">{(settings as any).repoBadge.fontSize}pt</span>
                                </div>
                                <TickSlider value={(settings as any).repoBadge.fontSize} onChange={(v) => handleUpdate('repoBadge' as any, { fontSize: v })} min={6} max={14} step={0.5} ticks={9} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1.5">
                                    <label className="text-[10px] text-faint">{t("customize.letterSpacing")}</label>
                                    <span className="text-[10px] text-faint font-medium">{(settings as any).repoBadge.letterSpacing.toFixed(2)}em</span>
                                </div>
                                <TickSlider value={(settings as any).repoBadge.letterSpacing} onChange={(v) => handleUpdate('repoBadge' as any, { letterSpacing: v })} min={-0.05} max={0.3} step={0.01} ticks={8} />
                            </div>
                        </div>
                    </div>

                    {/* Icon + label toggles */}
                    <div className="space-y-2">
                        <ApplyToCheckbox
                            label={t("customize.repoBadgeShowIcon")}
                            checked={(settings as any).repoBadge.showIcon}
                            onChange={(checked) => handleUpdate('repoBadge' as any, { showIcon: checked })}
                        />
                        <ApplyToCheckbox
                            label={t("customize.repoBadgeShowPlatform")}
                            checked={(settings as any).repoBadge.showPlatformName}
                            onChange={(checked) => handleUpdate('repoBadge' as any, { showPlatformName: checked })}
                        />
                        <ApplyToCheckbox
                            label={t("customize.repoBadgeShowVisibility")}
                            checked={Boolean((settings as any).repoBadge.showVisibility)}
                            onChange={(checked) => handleUpdate('repoBadge' as any, { showVisibility: checked })}
                        />
                        <div>
                            <div className="flex justify-between items-end mb-1.5">
                                <label className="text-[10px] text-faint">{t("customize.repoBadgeIconSize")}</label>
                                <span className="text-[10px] text-faint font-medium">{(settings as any).repoBadge.iconSize.toFixed(2)}em</span>
                            </div>
                            <TickSlider value={(settings as any).repoBadge.iconSize} onChange={(v) => handleUpdate('repoBadge' as any, { iconSize: v })} min={0.5} max={1.5} step={0.05} ticks={11} />
                        </div>
                    </div>

                    {/* Spacing */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-strong/90 block">{t("customize.repoBadgeSpacing")}</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="flex justify-between items-end mb-1.5">
                                    <label className="text-[10px] text-faint">{t("customize.repoBadgePaddingX")}</label>
                                    <span className="text-[10px] text-faint font-medium">{(settings as any).repoBadge.paddingX}px</span>
                                </div>
                                <TickSlider value={(settings as any).repoBadge.paddingX} onChange={(v) => handleUpdate('repoBadge' as any, { paddingX: v })} min={0} max={20} step={1} ticks={6} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1.5">
                                    <label className="text-[10px] text-faint">{t("customize.repoBadgePaddingY")}</label>
                                    <span className="text-[10px] text-faint font-medium">{(settings as any).repoBadge.paddingY}px</span>
                                </div>
                                <TickSlider value={(settings as any).repoBadge.paddingY} onChange={(v) => handleUpdate('repoBadge' as any, { paddingY: v })} min={0} max={12} step={1} ticks={7} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1.5">
                                    <label className="text-[10px] text-faint">{t("customize.repoBadgeGap")}</label>
                                    <span className="text-[10px] text-faint font-medium">{(settings as any).repoBadge.gap}px</span>
                                </div>
                                <TickSlider value={(settings as any).repoBadge.gap} onChange={(v) => handleUpdate('repoBadge' as any, { gap: v })} min={0} max={20} step={1} ticks={6} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1.5">
                                    <label className="text-[10px] text-faint">{t("customize.repoBadgeMargin")}</label>
                                    <span className="text-[10px] text-faint font-medium">{(settings as any).repoBadge.marginTop}px</span>
                                </div>
                                <TickSlider value={(settings as any).repoBadge.marginTop} onChange={(v) => handleUpdate('repoBadge' as any, { marginTop: v, marginBottom: v })} min={0} max={16} step={1} ticks={5} />
                            </div>
                        </div>
                    </div>

                    {/* Border */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.repoBadgeBorder")}</label>
                        <BorderEditor
                            border={(settings as any).repoBadge.border}
                            fallbackColor={settings.colors.accent}
                            onChange={(updates) => {
                                const current = (settings as any).repoBadge.border;
                                handleUpdate('repoBadge' as any, { border: { ...current, ...updates } });
                            }}
                        />
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.languagesSection", "customize.languagesLayout", "customize.languagesColumns", "customize.languagesColumnGap", "customize.languagesItemSpacing", "customize.languagesFluency", "customize.languagesFluencySize", "customize.languagesFluencyPlacement", "customize.languagesFluencyOrder", "customize.languagesTablePadding", "customize.alignment"]) && (
            <CustomizeSectionCard
                sectionKey="languagesSection"
            >
                <div className="space-y-6">
                    {/* Layout */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.languagesLayout")}</label>
                        <div className="flex bg-surface-1 p-1 rounded-xl border border-edge">
                            {([
                                { value: "list" as const, labelKey: "editor.languagePreviewList" },
                                { value: "table" as const, labelKey: "editor.languagePreviewTable" },
                                { value: "cefr" as const, labelKey: "editor.languagePreviewCefr" },
                            ]).map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setLanguageLayout(opt.value)}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                                        languageLayout === opt.value
                                            ? "bg-edge text-strong"
                                            : "text-faint hover:text-strong"
                                    }`}
                                >
                                    {t(opt.labelKey)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Alignment */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.alignment")}</label>
                        <AlignmentPicker
                            value={settings.languagesSection.textAlign}
                            onChange={(value) => handleUpdate('languagesSection', { textAlign: value })}
                        />
                    </div>

                    {languageLayout === "list" && (
                        <>
                            {/* Columns */}
                            <div>
                                <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.languagesColumns")}</label>
                                <div className="flex bg-surface-1 p-1 rounded-xl border border-edge">
                                    {[1, 2, 3].map((count) => (
                                        <button
                                            key={count}
                                            type="button"
                                            onClick={() => handleUpdate('languagesSection', { columns: count })}
                                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                                                settings.languagesSection.columns === count
                                                    ? "bg-edge text-strong"
                                                    : "text-faint hover:text-strong"
                                            }`}
                                        >
                                            {count}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Column Gap */}
                            {settings.languagesSection.columns > 1 && (
                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <label className="text-xs font-semibold text-strong/90">{t("customize.languagesColumnGap")}</label>
                                        <span className="text-[10px] text-faint font-medium">{settings.languagesSection.columnGap}px</span>
                                    </div>
                                    <TickSlider
                                        value={settings.languagesSection.columnGap}
                                        onChange={(v) => handleUpdate('languagesSection', { columnGap: v })}
                                        min={0} max={48} step={2} ticks={7}
                                    />
                                </div>
                            )}

                            {/* Entry Spacing */}
                            <div className="space-y-3">
                                <ApplyToCheckbox
                                    label={t("customize.languagesCustomItemSpacing")}
                                    checked={settings.languagesSection.itemSpacing != null}
                                    onChange={(checked) => handleUpdate('languagesSection', { itemSpacing: checked ? settings.spacing.itemSpacing : null })}
                                />
                                {settings.languagesSection.itemSpacing != null && (
                                    <div>
                                        <div className="flex justify-between items-end mb-2">
                                            <label className="text-xs font-semibold text-strong/90">{t("customize.languagesItemSpacing")}</label>
                                            <span className="text-[10px] text-faint font-medium">{settings.languagesSection.itemSpacing}px</span>
                                        </div>
                                        <TickSlider
                                            value={settings.languagesSection.itemSpacing}
                                            onChange={(v) => handleUpdate('languagesSection', { itemSpacing: v })}
                                            min={0} max={32} step={1} ticks={9}
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {(languageLayout === "table" || languageLayout === "cefr") && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="flex justify-between items-end mb-1.5">
                                    <label className="text-[10px] text-faint">{t("customize.languagesTablePaddingX")}</label>
                                    <span className="text-[10px] text-faint font-medium">{settings.languagesSection.tableCellPaddingX}px</span>
                                </div>
                                <TickSlider
                                    value={settings.languagesSection.tableCellPaddingX}
                                    onChange={(v) => handleUpdate('languagesSection', { tableCellPaddingX: v })}
                                    min={0} max={24} step={1} ticks={7}
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1.5">
                                    <label className="text-[10px] text-faint">{t("customize.languagesTablePaddingY")}</label>
                                    <span className="text-[10px] text-faint font-medium">{settings.languagesSection.tableCellPaddingY}px</span>
                                </div>
                                <TickSlider
                                    value={settings.languagesSection.tableCellPaddingY}
                                    onChange={(v) => handleUpdate('languagesSection', { tableCellPaddingY: v })}
                                    min={0} max={20} step={1} ticks={6}
                                />
                            </div>
                        </div>
                    )}

                    {/* Fluency */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-strong/90 block">{t("customize.languagesFluency")}</label>
                        <div className="flex bg-surface-1 p-1 rounded-xl border border-edge">
                            {([
                                { value: "badge" as const, labelKey: "customize.languagesFluencyBadge" },
                                { value: "text" as const, labelKey: "customize.languagesFluencyText" },
                                { value: "hidden" as const, labelKey: "customize.languagesFluencyHidden" },
                            ]).map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleUpdate('languagesSection', { fluencyDisplay: opt.value })}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                                        settings.languagesSection.fluencyDisplay === opt.value
                                            ? "bg-edge text-strong"
                                            : "text-faint hover:text-strong"
                                    }`}
                                >
                                    {t(opt.labelKey)}
                                </button>
                            ))}
                        </div>
                        {settings.languagesSection.fluencyDisplay !== "hidden" && (
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="text-xs font-semibold text-strong/90">{t("customize.languagesFluencySize")}</label>
                                    <span className="text-[10px] text-faint font-medium">{settings.languagesSection.fluencySize.toFixed(2)}em</span>
                                </div>
                                <TickSlider
                                    value={settings.languagesSection.fluencySize}
                                    onChange={(v) => handleUpdate('languagesSection', { fluencySize: v })}
                                    min={0.6} max={1.4} step={0.05} ticks={9}
                                />
                            </div>
                        )}
                        {languageLayout === "list" && settings.languagesSection.fluencyDisplay !== "hidden" && (
                            <>
                                {/* Placement: below the name or inline on the same line */}
                                <div>
                                    <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.languagesFluencyPlacement")}</label>
                                    <div className="flex bg-surface-1 p-1 rounded-xl border border-edge">
                                        {([
                                            { value: "nextLine" as const, labelKey: "customize.subtitleNextLine" },
                                            { value: "sameLine" as const, labelKey: "customize.subtitleSameLine" },
                                        ]).map((opt) => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => handleUpdate('languagesSection', { fluencyPlacement: opt.value })}
                                                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                                                    settings.languagesSection.fluencyPlacement === opt.value
                                                        ? "bg-edge text-strong"
                                                        : "text-faint hover:text-strong"
                                                }`}
                                            >
                                                {t(opt.labelKey)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {settings.languagesSection.fluencyPlacement === "sameLine" && (
                                    <div>
                                        <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.languagesFluencyOrder")}</label>
                                        <div className="flex bg-surface-1 p-1 rounded-xl border border-edge">
                                            {([
                                                { value: "languageFirst" as const, labelKey: "customize.languagesOrderLanguageFirst" },
                                                { value: "fluencyFirst" as const, labelKey: "customize.languagesOrderFluencyFirst" },
                                            ]).map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => handleUpdate('languagesSection', { fluencyOrder: opt.value })}
                                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                                                        settings.languagesSection.fluencyOrder === opt.value
                                                            ? "bg-edge text-strong"
                                                            : "text-faint hover:text-strong"
                                                    }`}
                                                >
                                                    {t(opt.labelKey)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.colors", "customize.textColor", "customize.backgroundColor", "customize.accentColor", "customize.applyAccentColor", "customize.basic", "customize.advanced", "customize.border", "customize.palette", "customize.skillLogoColor", "customize.skillLogoMono", "customize.skillLogoBrand", "customize.skillLogoCustom", "customize.skillLogoCustomColor"]) && (
            <CustomizeSectionCard
                sectionKey="colors"
            >
                {/* Primary Tabs */}
                <div className="flex gap-6 mb-6">
                    <button
                        onClick={() => handleUpdate('colors', { variant: 'basic' })}
                        className={`flex flex-col items-center gap-2 transition-opacity ${settings.colors.variant === 'basic' ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
                    >
                        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${settings.colors.variant === 'basic' ? 'border-accent bg-accent/10' : 'border-edge bg-surface-1'}`}>
                            <Circle className={`w-6 h-6 ${settings.colors.variant === 'basic' ? 'text-accent' : 'text-faint'}`} />
                        </div>
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-faint">{t("customize.basic")}</span>
                    </button>
                    <button
                        onClick={() => { handleUpdate('colors', { variant: 'advanced' }); setSubColorTab('multi'); }}
                        className={`flex flex-col items-center gap-2 transition-opacity ${settings.colors.variant === 'advanced' ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
                    >
                        <div className={`w-12 h-12 rounded-full border-2 overflow-hidden flex flex-col ${settings.colors.variant === 'advanced' ? 'border-accent' : 'border-edge'}`}>
                            <div className="h-1/2 w-full flex items-center justify-center" style={{ backgroundColor: settings.colors.background }}>
                                <TypeIcon className="w-4 h-4" style={{ color: settings.colors.text }} />
                            </div>
                            <div className="h-1/2 w-full" style={{ backgroundColor: settings.colors.accent }} />
                        </div>
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-faint">{t("customize.advanced")}</span>
                    </button>
                    <button
                        onClick={() => handleUpdate('colors', { variant: 'border' })}
                        className={`flex flex-col items-center gap-2 transition-opacity ${settings.colors.variant === 'border' ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
                    >
                        <div className={`w-12 h-12 rounded-full border-[6px] ${settings.colors.variant === 'border' ? 'border-accent bg-transparent' : 'border-faint bg-transparent'}`} />
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-faint">{t("customize.border")}</span>
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Sub Tabs */}
                    <div className="flex gap-4">
                        <button
                            onClick={() => setSubColorTab('multi')}
                            className={`flex flex-col flex-1 items-center gap-1.5 transition-opacity ${subColorTab === 'multi' ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
                        >
                            <div className={`w-full h-8 rounded-md flex overflow-hidden border ${subColorTab === 'multi' ? 'border-accent' : 'border-edge'}`}>
                                <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: settings.colors.background }}>
                                    <TypeIcon className="w-3.5 h-3.5" style={{ color: settings.colors.text }} />
                                </div>
                                <div className="flex-1" style={{ backgroundColor: settings.colors.accent }} />
                            </div>
                            <span className="text-[10px] font-medium text-faint">{t("customize.palette")}</span>
                        </button>
                        <button
                            onClick={() => setSubColorTab('image')}
                            className={`flex flex-col flex-1 items-center gap-1.5 transition-opacity ${subColorTab === 'image' ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
                        >
                            <div className={`w-full h-8 rounded-md flex items-center justify-center border bg-surface-1 ${subColorTab === 'image' ? 'border-accent' : 'border-edge'}`}>
                                <ImageIcon className="w-4 h-4 text-faint" />
                            </div>
                            <span className="text-[10px] font-medium text-faint">{t("customize.image")}</span>
                        </button>
                    </div>

                    {subColorTab === 'multi' && (
                        settings.colors.variant === 'advanced' ? (
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-edge bg-surface-1 p-4">
                                    <div className="text-xs font-semibold text-strong/90 mb-1">{t("customize.advancedPalette")}</div>
                                    <div className="text-[11px] text-faint leading-relaxed">
                                        {t("customize.advancedPaletteDesc")}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <ColorPickerCard
                                        label={t("customize.textColor")}
                                        value={settings.colors.text}
                                        icon={TypeIcon}
                                        onChange={(value) => handleUpdate('colors', { text: value })}
                                    />
                                    <ColorPickerCard
                                        label={t("customize.backgroundColor")}
                                        value={settings.colors.background}
                                        icon={Square}
                                        onChange={(value) => handleUpdate('colors', { background: value })}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-edge bg-surface-1 p-4 text-sm text-faint leading-relaxed">
                                {t("customize.switchToAdvanced")}
                            </div>
                        )
                    )}

                    {subColorTab === 'image' && (
                        <div className="rounded-2xl border border-dashed border-edge bg-surface-1 p-4 text-sm text-faint leading-relaxed">
                            {t("customize.imageNotReady")}
                        </div>
                    )}

                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.accentColor")}</label>
                            <div className="flex items-center gap-2 min-w-0">
                                <span
                                    className="w-3.5 h-3.5 rounded-full border border-strong/10 shrink-0"
                                    style={{ backgroundColor: settings.colors.accent }}
                                />
                                <span className="text-[10px] uppercase tracking-[0.18em] text-faint font-medium truncate">
                                    {settings.colors.accent.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                            <button
                                onClick={() => handleUpdate('colors', { accent: "#ffffff" })}
                                className="w-8 h-8 rounded-full border border-faint relative overflow-hidden flex items-center justify-center group"
                            >
                                <div className="absolute inset-0 bg-transparent" />
                                <div className="absolute w-[180%] h-px bg-faint rotate-45 group-hover:bg-accent transition-colors" />
                            </button>

                            {ACCENT_SWATCHES.slice(1).map((swatch) => (
                                <button
                                    key={swatch}
                                    onClick={() => handleUpdate('colors', { accent: swatch })}
                                    className={`w-8 h-8 rounded-full transition-transform hover:scale-110 shadow-sm ${settings.colors.accent.toLowerCase() === swatch.toLowerCase() ? 'ring-2 ring-strong ring-offset-2 ring-offset-surface-4' : ''}`}
                                    style={{ backgroundColor: swatch }}
                                />
                            ))}

                            <div
                                className={`relative w-8 h-8 rounded-full cursor-pointer hover:scale-110 transition-transform flex items-center justify-center overflow-hidden shadow-sm ${accentMatchesPreset ? '' : 'ring-2 ring-strong ring-offset-2 ring-offset-surface-4'}`}
                                style={{ background: 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)' }}
                            >
                                <div
                                    className="w-4 h-4 rounded-full border border-strong/40 shadow-sm"
                                    style={{ backgroundColor: settings.colors.accent }}
                                />
                                <input
                                    type="color"
                                    value={settings.colors.accent}
                                    onInput={(e) => handleUpdate('colors', { accent: (e.target as HTMLInputElement).value })}
                                    onChange={(e) => handleUpdate('colors', { accent: e.target.value })}
                                    className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 opacity-0 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Apply Accent Color Toggles */}
                    <div className="pt-2">
                        <label className="text-xs font-semibold text-strong/90 mb-4 block">{t("customize.applyAccentColor")}</label>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                            {[
                                { id: "name", label: t("customize.accentName") },
                                { id: "dotsBarsBubbles", label: t("customize.accentDotsBarsBubbles") },
                                { id: "jobTitle", label: t("customize.accentJobTitle") },
                                { id: "dates", label: t("customize.accentDates") },
                                { id: "headings", label: t("customize.accentHeadings") },
                                { id: "entrySubtitle", label: t("customize.accentEntrySubtitle") },
                                { id: "headingsLine", label: t("customize.accentHeadingsLine") },
                                { id: "linkIcons", label: t("customize.accentLinkIcons") },
                                { id: "headerIcons", label: t("customize.accentHeaderIcons") }
                            ].map((item) => (
                                <ApplyToCheckbox
                                    key={item.id}
                                    label={item.label}
                                    checked={settings.colors.applyTo.includes(item.id)}
                                    onChange={(checked) => {
                                        const newApplyTo = checked
                                            ? [...settings.colors.applyTo, item.id]
                                            : settings.colors.applyTo.filter(id => id !== item.id);
                                        handleUpdate('colors', { applyTo: newApplyTo });
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Skill logo colour: inherited accent, brand colours, or one custom colour */}
                    <div className="pt-2">
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.skillLogoColor")}</label>
                        <div className="flex bg-surface-1 p-1 rounded-xl border border-edge">
                            {([
                                { value: "mono" as const, labelKey: "customize.skillLogoMono" },
                                { value: "brand" as const, labelKey: "customize.skillLogoBrand" },
                                { value: "custom" as const, labelKey: "customize.skillLogoCustom" },
                            ]).map((opt) => (
                                <button
                                    type="button"
                                    key={opt.value}
                                    onClick={() => handleUpdate('colors', { skillIconColor: opt.value })}
                                    className={`flex-[1] py-2 text-sm font-medium rounded-lg transition-colors ${settings.colors.skillIconColor === opt.value ? "bg-edge text-strong" : "text-faint hover:text-strong"}`}
                                >{t(opt.labelKey)}</button>
                            ))}
                        </div>
                        {settings.colors.skillIconColor === "custom" && (
                            <div className="mt-3">
                                <CompactColorInput
                                    label={t("customize.skillLogoCustomColor")}
                                    value={settings.colors.skillIconCustomColor || settings.colors.accent}
                                    onChange={(value) => handleUpdate('colors', { skillIconCustomColor: value })}
                                />
                            </div>
                        )}
                        <p className="text-[11px] text-faint mt-2 leading-snug">{t("customize.skillLogoColorHint")}</p>
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.linkIcon", "customize.linkIconSide", "customize.linkIconSize"]) && (
            <CustomizeSectionCard
                sectionKey="linkIcons"
            >
                <div className="space-y-5">
                    {/* Side selector */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.linkIconSide")}</label>
                        <div className="flex bg-surface-1 p-1 rounded-xl border border-edge">
                            {(["left", "right"] as const).map(side => (
                                <button
                                    key={side}
                                    onClick={() => handleUpdate('linkIcon' as any, { side })}
                                    className={`flex-[1] py-2 text-sm font-medium capitalize rounded-lg transition-colors ${settings.linkIcon.side === side ? "bg-edge text-strong" : "text-faint hover:text-strong"}`}
                                >{t(`customize.${side}`)}</button>
                            ))}
                        </div>
                    </div>

                    {/* Size slider */}
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.linkIconSize")}</label>
                            <span className="text-[10px] text-faint font-medium">{`${settings.linkIcon.size.toFixed(2)}em`}</span>
                        </div>
                        <TickSlider
                            value={settings.linkIcon.size}
                            onChange={(v) => handleUpdate('linkIcon' as any, { size: v })}
                            min={0.5} max={1.5} step={0.05} ticks={11}
                        />
                    </div>

                    {/* Vertical align */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.linkIconAlign")}</label>
                        <div className="flex bg-surface-1 p-1 rounded-xl border border-edge">
                            {(["top", "center", "bottom", "baseline"] as const).map(align => (
                                <button
                                    key={align}
                                    onClick={() => handleUpdate('linkIcon' as any, { align })}
                                    className={`flex-[1] py-2 text-xs font-medium capitalize rounded-lg transition-colors ${settings.linkIcon.align === align ? "bg-edge text-strong" : "text-faint hover:text-strong"}`}
                                >{t(`customize.align${align.charAt(0).toUpperCase() + align.slice(1)}`)}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.headerIconTitle", "customize.headerIconSide", "customize.headerIconSize", "customize.headerIconAlign"]) && (
            <CustomizeSectionCard
                sectionKey="headerLinkIndicators"
            >
                <div className="space-y-5">
                    {/* Side selector */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.headerIconSide")}</label>
                        <div className="flex bg-surface-1 p-1 rounded-xl border border-edge">
                            {(["left", "right", "hidden"] as const).map(side => (
                                <button
                                    key={side}
                                    onClick={() => handleUpdate('headerIcon' as any, { side })}
                                    className={`flex-[1] py-2 text-sm font-medium capitalize rounded-lg transition-colors ${settings.headerIcon.side === side ? "bg-edge text-strong" : "text-faint hover:text-strong"}`}
                                >{t(`customize.${side}`)}</button>
                            ))}
                        </div>
                    </div>

                    {/* Size slider */}
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.headerIconSize")}</label>
                            <span className="text-[10px] text-faint font-medium">{`${settings.headerIcon.size.toFixed(2)}em`}</span>
                        </div>
                        <TickSlider
                            value={settings.headerIcon.size}
                            onChange={(v) => handleUpdate('headerIcon' as any, { size: v })}
                            min={0.5} max={1.5} step={0.05} ticks={11}
                        />
                    </div>

                    {/* Vertical align */}
                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.headerIconAlign")}</label>
                        <div className="flex bg-surface-1 p-1 rounded-xl border border-edge">
                            {(["top", "center", "bottom", "baseline"] as const).map(align => (
                                <button
                                    key={align}
                                    onClick={() => handleUpdate('headerIcon' as any, { align })}
                                    className={`flex-[1] py-2 text-xs font-medium capitalize rounded-lg transition-colors ${settings.headerIcon.align === align ? "bg-edge text-strong" : "text-faint hover:text-strong"}`}
                                >{t(`customize.align${align.charAt(0).toUpperCase() + align.slice(1)}`)}</button>
                            ))}
                        </div>
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.layout", "customize.columns", "customize.documentFlow", "customize.one", "customize.two", "customize.mix"]) && (
            <CustomizeSectionCard
                sectionKey="layout"
            >
                <div className="space-y-6">
                    {/* Columns Selector */}
                    <div>
                        <label className="text-xs font-medium text-faint mb-3 block">{t("customize.columns")}</label>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => handleUpdate('layout', { columns: "one" })}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors ${settings.layout.columns === "one" ? "bg-edge border-accent text-strong" : "bg-surface-1 border-edge text-faint hover:border-faint"}`}
                            >
                                <div className="w-10 h-7 flex flex-col gap-1 items-center justify-center opacity-80">
                                    <div className="w-8 h-1.5 bg-current rounded-full" />
                                    <div className="w-8 h-1.5 bg-current rounded-full" />
                                    <div className="w-8 h-1.5 bg-current rounded-full" />
                                </div>
                                <span className="text-xs">{t("customize.one")}</span>
                            </button>
                            <button
                                onClick={() => handleUpdate('layout', { columns: "two" })}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors ${settings.layout.columns === "two" ? "bg-edge border-accent text-strong" : "bg-surface-1 border-edge text-faint hover:border-faint"}`}
                            >
                                <div className="w-10 h-7 flex gap-1 items-center justify-center opacity-80">
                                    <div className="flex flex-col gap-1 w-[14px]">
                                        <div className="w-full h-1.5 bg-current rounded-full" />
                                        <div className="w-full h-1.5 bg-current rounded-full" />
                                        <div className="w-full h-1.5 bg-current rounded-full" />
                                    </div>
                                    <div className="flex flex-col gap-1 w-[14px]">
                                        <div className="w-full h-1.5 bg-current rounded-full" />
                                        <div className="w-full h-1.5 bg-current rounded-full" />
                                        <div className="w-full h-1.5 bg-current rounded-full" />
                                    </div>
                                </div>
                                <span className="text-xs">{t("customize.two")}</span>
                            </button>
                            <button
                                onClick={() => handleUpdate('layout', { columns: "mix" })}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors ${settings.layout.columns === "mix" ? "bg-edge border-accent text-strong" : "bg-surface-1 border-edge text-faint hover:border-faint"}`}
                            >
                                <div className="w-10 h-7 flex flex-col gap-1 items-center justify-center opacity-80">
                                    <div className="w-8 h-1.5 bg-current rounded-full" />
                                    <div className="flex gap-1 w-8">
                                        <div className="w-full h-1.5 bg-current rounded-full" />
                                        <div className="w-full h-1.5 bg-current rounded-full" />
                                    </div>
                                    <div className="flex gap-1 w-8">
                                        <div className="w-full h-1.5 bg-current rounded-full" />
                                        <div className="w-full h-1.5 bg-current rounded-full" />
                                    </div>
                                </div>
                                <span className="text-xs">{t("customize.mix")}</span>
                            </button>
                        </div>
                    </div>

                    {isMultiColumnLayout && (
                        <div>
                            <div className="bg-surface-1 border border-edge rounded-2xl p-4 space-y-5">
                                <div>
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <div className="text-xs font-medium text-faint">
                                            {t("customize.columnSplit", { left: settings.layout.leftColumnWidth, right: 100 - settings.layout.leftColumnWidth })}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleUpdate('layout', { leftColumnWidth: 50 })}
                                            disabled={settings.layout.leftColumnWidth === 50}
                                            className="text-[11px] font-medium text-accent hover:text-strong disabled:opacity-40 disabled:hover:text-accent transition-colors"
                                        >
                                            {t("customize.resetTo5050")}
                                        </button>
                                    </div>
                                    <div className="relative pt-2 pb-4">
                                        <input
                                            type="range"
                                            min="20"
                                            max="80"
                                            step="1"
                                            value={settings.layout.leftColumnWidth}
                                            onChange={(e) => handleUpdate('layout', { leftColumnWidth: parseInt(e.target.value) })}
                                            className="w-full h-1.5 bg-edge rounded-full appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Change Section Layout */}
                    <div>
                        <label className="text-xs font-medium text-faint mb-1.5 block">{t("customize.documentFlow")}</label>
                        <p className="text-[11px] text-faint mb-3">
                            {t("customize.documentFlowDesc")}
                        </p>
                        <DraggableSectionList
                            order={settings.layout.sectionOrder}
                            items={layoutSectionItems}
                            layoutMode={settings.layout.columns}
                            placements={resolvedSectionPlacements}
                            onChange={(newOrder) => handleUpdate('layout', { sectionOrder: newOrder })}
                            onPlacementChange={(key, placement) => handleUpdate('layout', {
                                sectionPlacement: {
                                    ...(settings.layout.sectionPlacement || {}),
                                    [key]: placement,
                                },
                            })}
                            onRemove={removeLayoutFlowItem}
                        />
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={addLayoutSeparator}
                                className="h-10 rounded-xl border border-dashed border-faint text-sm font-medium text-faint hover:text-strong hover:border-strong transition-colors flex items-center justify-center gap-2"
                            >
                                {`- ${t("customize.addHorizontalSeparator")}`}
                            </button>
                            <button
                                type="button"
                                onClick={addLayoutVerticalSeparator}
                                className="h-10 rounded-xl border border-dashed border-faint text-sm font-medium text-faint hover:text-strong hover:border-strong transition-colors flex items-center justify-center gap-2"
                            >
                                {`| ${t("customize.addVerticalSeparator")}`}
                            </button>
                            <button
                                type="button"
                                onClick={addLayoutPageBreak}
                                className="h-10 rounded-xl border border-dashed border-faint text-sm font-medium text-faint hover:text-strong hover:border-strong transition-colors flex items-center justify-center gap-2"
                            >
                                {t("customize.addPageBreak")}
                            </button>
                        </div>
                    </div>

                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.personalDetailsSection", "customize.presets", "customize.profileLayout", "customize.detailsLayout", "customize.contentAlignment", "customize.imageLeft", "customize.imageTop", "customize.imageRight", "customize.detailsRows", "customize.detailsWrap", "customize.detailsTwoColumns", "left", "center", "right"]) && (
            <CustomizeSectionCard
                sectionKey="personalDetails"
            >
                <div>
                    <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.presets")}</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {PERSONAL_DETAILS_PRESETS.map((preset) => {
                            const isActive = activePersonalDetailsPresetKey === preset.key;
                            return (
                                <button
                                    key={preset.key}
                                    type="button"
                                    onClick={() => handleUpdate("personalDetails", {
                                        layout: preset.layout,
                                        detailsLayout: preset.detailsLayout,
                                        alignment: preset.alignment,
                                    })}
                                    className={`flex flex-col items-start gap-2 rounded-xl border p-2 text-left transition-colors ${isActive ? "bg-edge border-accent text-strong" : "bg-surface-1 border-edge text-faint hover:border-faint hover:text-strong"}`}
                                >
                                    <PersonalDetailsPresetPreview layout={preset.layout} detailsLayout={preset.detailsLayout} />
                                    <div className="space-y-0.5">
                                        <div className="text-[10px] font-semibold text-current">{t(preset.labelKey)}</div>
                                        <div className="text-[9px] text-current/70">{t(`customize.${preset.alignment}`)}</div>
                                    </div>
                                </button>
                            );
                        })}
                        <div
                            className={`flex flex-col items-start gap-2 rounded-xl border p-2 text-left ${isCustomPersonalDetailsPreset ? "bg-edge border-accent text-strong" : "bg-surface-1 border-edge text-faint"}`}
                        >
                            <PersonalDetailsPresetPreview
                                layout={settings.personalDetails.layout}
                                detailsLayout={settings.personalDetails.detailsLayout}
                            />
                            <div className="space-y-0.5">
                                <div className="text-[10px] font-semibold text-current">{t("customize.custom")}</div>
                                <div className="text-[9px] text-current/70">
                                    {`${t(`customize.${settings.personalDetails.layout}`)} • ${t(getPersonalDetailsDetailsLabelKey(settings.personalDetails.detailsLayout))} • ${t(`customize.${settings.personalDetails.alignment}`)}`}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-5">
                    <div>
                        <label className="text-xs font-medium text-faint mb-3 block">{t("customize.profileLayout")}</label>
                        <div className="grid grid-cols-3 gap-3">
                            {([
                                { value: "imageLeft", labelKey: "customize.imageLeft", icon: AlignLeft },
                                { value: "imageTop", labelKey: "customize.imageTop", icon: Square },
                                { value: "imageRight", labelKey: "customize.imageRight", icon: AlignRight },
                            ] as const).map((option) => {
                                const Icon = option.icon;
                                const isActive = settings.personalDetails.layout === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleUpdate("personalDetails", { layout: option.value })}
                                        className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${isActive ? "bg-edge border-accent text-strong" : "bg-surface-1 border-edge text-faint hover:border-faint"}`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="text-xs text-center">{t(option.labelKey)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-faint mb-3 block">{t("customize.detailsLayout")}</label>
                        <div className="grid grid-cols-3 gap-3">
                            {([
                                { value: "rows", labelKey: "customize.detailsRows", icon: AlignLeft },
                                { value: "wrap", labelKey: "customize.detailsWrap", icon: List },
                                { value: "twoColumns", labelKey: "customize.detailsTwoColumns", icon: Layout },
                            ] as const).map((option) => {
                                const isActive = settings.personalDetails.detailsLayout === option.value;
                                const Icon = option.icon;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleUpdate("personalDetails", { detailsLayout: option.value })}
                                        className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${isActive ? "bg-edge border-accent text-strong" : "bg-surface-1 border-edge text-faint hover:border-faint"}`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="text-xs text-center">{t(option.labelKey)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-faint mb-1.5 block">{t("customize.contentAlignment")}</label>
                        <AlignmentPicker
                            value={settings.personalDetails.alignment}
                            onChange={(alignment) => handleUpdate("personalDetails", { alignment })}
                        />
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.personalDetailsSpacingSection", "customize.borderSection", "customize.borderSides", "customize.borderStyle", "customize.borderWidth", "customize.borderColor", "customize.borderRadius", "customize.dashLength", "customize.dashGap", "customize.padding", "customize.margin", "customize.top", "customize.bottom", "customize.left", "customize.right"]) && (
            <CustomizeSectionCard
                sectionKey="personalDetailsSpacing"
            >
                    <div className="space-y-5">
                        <div>
                            <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.borderSection")}</label>
                            <BorderEditor
                                border={personalDetailsBorder}
                                fallbackColor={settings.colors.accent}
                                onChange={handlePersonalDetailsBorderUpdate}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.padding")}</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-[10px] text-faint">{t("customize.top")}</span>
                                        <span className="text-[10px] text-faint font-medium">{settings.personalDetails.paddingTop ?? 0}px</span>
                                    </div>
                                    <TickSlider value={settings.personalDetails.paddingTop ?? 0} onChange={(v) => handleUpdate("personalDetails", { paddingTop: v })} min={0} max={24} step={1} ticks={7} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-[10px] text-faint">{t("customize.bottom")}</span>
                                        <span className="text-[10px] text-faint font-medium">{settings.personalDetails.paddingBottom ?? 0}px</span>
                                    </div>
                                    <TickSlider value={settings.personalDetails.paddingBottom ?? 0} onChange={(v) => handleUpdate("personalDetails", { paddingBottom: v })} min={0} max={24} step={1} ticks={7} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-[10px] text-faint">{t("customize.left")}</span>
                                        <span className="text-[10px] text-faint font-medium">{settings.personalDetails.paddingLeft ?? 0}px</span>
                                    </div>
                                    <TickSlider value={settings.personalDetails.paddingLeft ?? 0} onChange={(v) => handleUpdate("personalDetails", { paddingLeft: v })} min={0} max={24} step={1} ticks={7} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-[10px] text-faint">{t("customize.right")}</span>
                                        <span className="text-[10px] text-faint font-medium">{settings.personalDetails.paddingRight ?? 0}px</span>
                                    </div>
                                    <TickSlider value={settings.personalDetails.paddingRight ?? 0} onChange={(v) => handleUpdate("personalDetails", { paddingRight: v })} min={0} max={24} step={1} ticks={7} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.margin")}</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-[10px] text-faint">{t("customize.top")}</span>
                                        <span className="text-[10px] text-faint font-medium">{settings.personalDetails.marginTop ?? 0}px</span>
                                    </div>
                                    <TickSlider value={settings.personalDetails.marginTop ?? 0} onChange={(v) => handleUpdate("personalDetails", { marginTop: v })} min={0} max={24} step={1} ticks={7} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-[10px] text-faint">{t("customize.bottom")}</span>
                                        <span className="text-[10px] text-faint font-medium">{settings.personalDetails.marginBottom ?? 0}px</span>
                                    </div>
                                    <TickSlider value={settings.personalDetails.marginBottom ?? 0} onChange={(v) => handleUpdate("personalDetails", { marginBottom: v })} min={0} max={24} step={1} ticks={7} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-[10px] text-faint">{t("customize.left")}</span>
                                        <span className="text-[10px] text-faint font-medium">{settings.personalDetails.marginLeft ?? 0}px</span>
                                    </div>
                                    <TickSlider value={settings.personalDetails.marginLeft ?? 0} onChange={(v) => handleUpdate("personalDetails", { marginLeft: v })} min={0} max={24} step={1} ticks={7} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-[10px] text-faint">{t("customize.right")}</span>
                                        <span className="text-[10px] text-faint font-medium">{settings.personalDetails.marginRight ?? 0}px</span>
                                    </div>
                                    <TickSlider value={settings.personalDetails.marginRight ?? 0} onChange={(v) => handleUpdate("personalDetails", { marginRight: v })} min={0} max={24} step={1} ticks={7} />
                                </div>
                            </div>
                        </div>
                    </div>
            </CustomizeSectionCard>
            )}

            {matchSearch(["customize.personalPhotoSection", "customize.photoShape", "customize.photoShapeSquare", "customize.photoShapeRounded", "customize.photoShapeCircle", "customize.photoSize", "customize.width", "customize.height", "customize.borderSection", "customize.borderSides", "customize.borderStyle", "customize.borderWidth", "customize.borderColor", "customize.borderRadius", "customize.dashLength", "customize.dashGap", "customize.photoFilters", "customize.photoFilterBrightness", "customize.photoFilterContrast", "customize.photoFilterSaturate", "customize.photoFilterGrayscale", "customize.photoFilterSepia", "customize.photoFilterHue", "customize.photoFilterBlur", "customize.photoPresetNatural", "customize.photoPresetStudio", "customize.photoPresetVivid", "customize.photoPresetWarm", "customize.photoPresetCool", "customize.photoPresetMono", "customize.photoPresetCinematic", "customize.photoPresetDreamy", "customize.padding", "customize.margin", "customize.top", "customize.bottom", "customize.left", "customize.right"]) && (
            <CustomizeSectionCard
                sectionKey="personalPhoto"
            >
                <div className="space-y-5">
                    <div>
                        <label className="mb-2 block text-xs font-semibold text-strong/90">
                            {t("customize.photoShape")}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { key: "square", label: t("customize.photoShapeSquare"), radius: 0 },
                                { key: "rounded", label: t("customize.photoShapeRounded"), radius: 18 },
                                { key: "circle", label: t("customize.photoShapeCircle"), radius: 999 },
                            ].map((shape) => {
                                const isCircle = personalPhotoSettings.width === personalPhotoSettings.height
                                    && personalPhotoSettings.border.radius >= personalPhotoSettings.width / 2;
                                const active = shape.key === "circle"
                                    ? isCircle
                                    : shape.key === "square"
                                        ? personalPhotoSettings.border.radius === 0
                                        : personalPhotoSettings.border.radius > 0 && !isCircle;
                                return (
                                    <button
                                        key={shape.key}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => {
                                            if (shape.key === "circle") {
                                                const size = Math.min(personalPhotoSettings.width, personalPhotoSettings.height);
                                                handlePersonalPhotoUpdate({
                                                    width: size,
                                                    height: size,
                                                    border: { ...personalPhotoSettings.border, radius: shape.radius },
                                                });
                                            } else {
                                                handlePersonalPhotoBorderUpdate({ radius: shape.radius });
                                            }
                                        }}
                                        className={`flex flex-col items-center gap-2 rounded-xl border p-2 text-[10px] transition-colors ${active ? "border-accent bg-edge text-strong" : "border-edge bg-surface-1 text-faint hover:border-faint hover:text-strong"}`}
                                    >
                                        <span
                                            className="block h-8 w-8 border-2 border-current bg-surface-4"
                                            style={{ borderRadius: shape.key === "circle" ? "999px" : `${shape.radius}px` }}
                                        />
                                        {shape.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.photoSize")}</label>
                            <span className="text-[10px] text-faint font-medium">{`${personalPhotoSettings.width}px x ${personalPhotoSettings.height}px`}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.width")}</span>
                                    <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.width}px</span>
                                </div>
                                <TickSlider value={personalPhotoSettings.width} onChange={(v) => handlePersonalPhotoUpdate({ width: v })} min={48} max={220} step={2} ticks={9} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.height")}</span>
                                    <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.height}px</span>
                                </div>
                                <TickSlider value={personalPhotoSettings.height} onChange={(v) => handlePersonalPhotoUpdate({ height: v })} min={48} max={220} step={2} ticks={9} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.borderSection")}</label>
                        <BorderEditor
                            border={personalPhotoSettings.border}
                            fallbackColor={settings.colors.accent}
                            onChange={handlePersonalPhotoBorderUpdate}
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.photoFilters")}</label>
                            <span className="text-[10px] text-faint font-medium">
                                {t(activePersonalPhotoFilterPresetKey ? PERSONAL_PHOTO_FILTER_PRESETS.find((preset) => preset.key === activePersonalPhotoFilterPresetKey)?.labelKey || "customize.custom" : "customize.custom")}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {PERSONAL_PHOTO_FILTER_PRESETS.map((preset) => {
                                const isActive = activePersonalPhotoFilterPresetKey === preset.key;
                                return (
                                    <button
                                        key={preset.key}
                                        type="button"
                                        onClick={() => handlePersonalPhotoFilterUpdate(preset.settings)}
                                        className={`flex flex-col items-start gap-2 rounded-xl border p-2 text-left transition-colors ${isActive ? "bg-edge border-accent text-strong" : "bg-surface-1 border-edge text-faint hover:border-faint hover:text-strong"}`}
                                    >
                                        <div className="h-12 w-full overflow-hidden rounded-xl border border-current/10 bg-surface-0">
                                            <div
                                                className="relative h-full w-full"
                                                style={{ filter: buildPhotoFilterPreviewValue(preset.settings) }}
                                            >
                                                <div className="absolute inset-0 bg-[linear-gradient(135deg,#f8fafc_0%,#fed7aa_35%,#93c5fd_68%,#1f2937_100%)]" />
                                                <div className="absolute bottom-0 left-1/2 h-6 w-8 -translate-x-1/2 rounded-t-[999px] bg-black/25" />
                                                <div className="absolute top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-black/20" />
                                            </div>
                                        </div>
                                        <span className="text-[10px] leading-tight">{t(preset.labelKey)}</span>
                                    </button>
                                );
                            })}
                            <div
                                className={`flex flex-col items-start gap-2 rounded-xl border p-2 text-left ${isCustomPersonalPhotoFilterPreset ? "bg-edge border-accent text-strong" : "bg-surface-1 border-edge text-faint"}`}
                            >
                                <div className="h-12 w-full overflow-hidden rounded-xl border border-current/10 bg-surface-0">
                                    <div
                                        className="relative h-full w-full"
                                        style={{ filter: buildPhotoFilterPreviewValue(personalPhotoSettings.filter) }}
                                    >
                                        <div className="absolute inset-0 bg-[linear-gradient(135deg,#f8fafc_0%,#fed7aa_35%,#93c5fd_68%,#1f2937_100%)]" />
                                        <div className="absolute bottom-0 left-1/2 h-6 w-8 -translate-x-1/2 rounded-t-[999px] bg-black/25" />
                                        <div className="absolute top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-black/20" />
                                    </div>
                                </div>
                                <span className="text-[10px] leading-tight">{t("customize.custom")}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-[10px] text-faint">{t("customize.photoFilterBrightness")}</span>
                                <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.filter.brightness}%</span>
                            </div>
                            <TickSlider value={personalPhotoSettings.filter.brightness} onChange={(v) => handlePersonalPhotoFilterUpdate({ brightness: v, preset: "custom" })} min={50} max={150} step={1} ticks={11} />
                        </div>
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-[10px] text-faint">{t("customize.photoFilterContrast")}</span>
                                <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.filter.contrast}%</span>
                            </div>
                            <TickSlider value={personalPhotoSettings.filter.contrast} onChange={(v) => handlePersonalPhotoFilterUpdate({ contrast: v, preset: "custom" })} min={50} max={160} step={1} ticks={12} />
                        </div>
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-[10px] text-faint">{t("customize.photoFilterSaturate")}</span>
                                <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.filter.saturate}%</span>
                            </div>
                            <TickSlider value={personalPhotoSettings.filter.saturate} onChange={(v) => handlePersonalPhotoFilterUpdate({ saturate: v, preset: "custom" })} min={0} max={180} step={1} ticks={10} />
                        </div>
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-[10px] text-faint">{t("customize.photoFilterHue")}</span>
                                <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.filter.hueRotate}deg</span>
                            </div>
                            <TickSlider value={personalPhotoSettings.filter.hueRotate} onChange={(v) => handlePersonalPhotoFilterUpdate({ hueRotate: v, preset: "custom" })} min={-180} max={180} step={5} ticks={9} />
                        </div>
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-[10px] text-faint">{t("customize.photoFilterGrayscale")}</span>
                                <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.filter.grayscale}%</span>
                            </div>
                            <TickSlider value={personalPhotoSettings.filter.grayscale} onChange={(v) => handlePersonalPhotoFilterUpdate({ grayscale: v, preset: "custom" })} min={0} max={100} step={1} ticks={11} />
                        </div>
                        <div>
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-[10px] text-faint">{t("customize.photoFilterSepia")}</span>
                                <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.filter.sepia}%</span>
                            </div>
                            <TickSlider value={personalPhotoSettings.filter.sepia} onChange={(v) => handlePersonalPhotoFilterUpdate({ sepia: v, preset: "custom" })} min={0} max={100} step={1} ticks={11} />
                        </div>
                        <div className="col-span-2">
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-[10px] text-faint">{t("customize.photoFilterBlur")}</span>
                                <span className="text-[10px] text-faint font-medium">{`${formatDisplayNumber(personalPhotoSettings.filter.blur, 1)}px`}</span>
                            </div>
                            <TickSlider value={personalPhotoSettings.filter.blur} onChange={(v) => handlePersonalPhotoFilterUpdate({ blur: v, preset: "custom" })} min={0} max={4} step={0.1} ticks={9} />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.padding")}</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.top")}</span>
                                    <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.paddingTop ?? 0}px</span>
                                </div>
                                <TickSlider value={personalPhotoSettings.paddingTop ?? 0} onChange={(v) => handlePersonalPhotoUpdate({ paddingTop: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.bottom")}</span>
                                    <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.paddingBottom ?? 0}px</span>
                                </div>
                                <TickSlider value={personalPhotoSettings.paddingBottom ?? 0} onChange={(v) => handlePersonalPhotoUpdate({ paddingBottom: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.left")}</span>
                                    <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.paddingLeft ?? 0}px</span>
                                </div>
                                <TickSlider value={personalPhotoSettings.paddingLeft ?? 0} onChange={(v) => handlePersonalPhotoUpdate({ paddingLeft: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.right")}</span>
                                    <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.paddingRight ?? 0}px</span>
                                </div>
                                <TickSlider value={personalPhotoSettings.paddingRight ?? 0} onChange={(v) => handlePersonalPhotoUpdate({ paddingRight: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.margin")}</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.top")}</span>
                                    <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.marginTop ?? 0}px</span>
                                </div>
                                <TickSlider value={personalPhotoSettings.marginTop ?? 0} onChange={(v) => handlePersonalPhotoUpdate({ marginTop: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.bottom")}</span>
                                    <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.marginBottom ?? 0}px</span>
                                </div>
                                <TickSlider value={personalPhotoSettings.marginBottom ?? 0} onChange={(v) => handlePersonalPhotoUpdate({ marginBottom: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.left")}</span>
                                    <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.marginLeft ?? 0}px</span>
                                </div>
                                <TickSlider value={personalPhotoSettings.marginLeft ?? 0} onChange={(v) => handlePersonalPhotoUpdate({ marginLeft: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-faint">{t("customize.right")}</span>
                                    <span className="text-[10px] text-faint font-medium">{personalPhotoSettings.marginRight ?? 0}px</span>
                                </div>
                                <TickSlider value={personalPhotoSettings.marginRight ?? 0} onChange={(v) => handlePersonalPhotoUpdate({ marginRight: v })} min={0} max={24} step={1} ticks={7} />
                            </div>
                        </div>
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

            {matchSearch([
                "customize.designOverlays",
                "customize.designInsert",
                "customize.designLayers",
                "customize.designInspector",
                "customize.designText",
                "customize.designShape",
                "customize.designImage",
                "customize.designBlock",
                "customize.designGradient",
                "customize.designTextContent",
                "customize.designImageSource",
                "customize.designShapeType",
                "customize.designBackground",
                "customize.designOpacity",
            ]) && (
            <CustomizeSectionCard
                sectionKey="designOverlays"
            >
                <input
                    ref={designImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleSelectedDesignImageUpload}
                />

                <div className="space-y-5">
                    <div className="rounded-2xl border border-edge bg-surface-1 p-4 space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-strong/90 mb-2 block">{t("customize.designPage")}</label>
                            <div className="flex flex-wrap gap-2">
                                {Array.from({ length: Math.max(previewPageCount, 1) }, (_, index) => (
                                    <button
                                        key={`design-page-${index}`}
                                        type="button"
                                        onClick={() => {
                                            setActiveDesignPage(index);
                                            if (selectedDesignElement) {
                                                handleSelectedDesignUpdate({
                                                    pageIndex: index,
                                                    zIndex: designElements.filter((element) => element.pageIndex === index).length + 1,
                                                });
                                            }
                                        }}
                                        className={`min-w-10 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${index === activeDesignPage ? "bg-edge border-accent text-strong" : "bg-surface-0 border-edge text-faint hover:border-faint hover:text-strong"}`}
                                    >
                                        {t("customize.designPageShort", { page: index + 1 })}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-strong/90 mb-3 block">{t("customize.designInsert")}</label>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {DESIGN_INSERT_OPTIONS.map((option) => {
                                    const Icon = option.icon;
                                    return (
                                        <button
                                            key={option.type}
                                            type="button"
                                            onClick={() => addDesignElement(option.type, activeDesignPage)}
                                            className="flex items-center gap-3 rounded-xl border border-edge bg-surface-0 px-3 py-3 text-left text-sm text-strong/85 transition-colors hover:border-faint hover:text-strong"
                                        >
                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-4 text-accent">
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <span className="min-w-0 text-xs font-medium">{t(option.labelKey)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-edge bg-surface-1 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.designLayers")}</label>
                            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">
                                {t("customize.designPageShort", { page: activeDesignPage + 1 })}
                            </span>
                        </div>

                        {designElementsForActivePage.length === 0 ? (
                            <p className="text-xs leading-relaxed text-faint">{t("customize.designNoLayers")}</p>
                        ) : (
                            <div className="space-y-2">
                                {designElementsForActivePage.map((element) => (
                                    <div
                                        key={element.id}
                                        className={`flex items-start gap-2 rounded-xl border p-2 transition-colors ${selectedDesignElement?.id === element.id ? "bg-edge border-accent text-strong" : "bg-surface-0 border-edge text-bright hover:border-faint"}`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => selectDesignElement(element.id)}
                                            className="min-w-0 flex-1 text-left"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-xs font-semibold truncate">{getDesignElementSummary(element, t)}</div>
                                                    <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-current/60">
                                                        {t(getDesignTypeLabelKey(element.type))}
                                                    </div>
                                                </div>
                                                <span className="rounded-lg border border-current/10 px-2 py-1 text-[10px] font-medium text-current/70">
                                                    z{element.zIndex}
                                                </span>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeDesignElement(element.id)}
                                            className="shrink-0 rounded-lg border border-danger-tint px-2.5 py-2 text-danger-soft transition-colors hover:border-danger hover:text-strong"
                                            aria-label={t("customize.designDelete")}
                                            title={t("customize.designDelete")}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-edge bg-surface-1 p-4 space-y-5">
                        <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-semibold text-strong/90">{t("customize.designInspector")}</label>
                            {selectedDesignElement ? (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => duplicateDesignElement(selectedDesignElement.id)}
                                        className="rounded-lg border border-edge px-2.5 py-1.5 text-[10px] font-medium text-bright hover:border-faint hover:text-strong transition-colors"
                                    >
                                        {t("customize.designDuplicate")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            removeDesignElement(selectedDesignElement.id);
                                            clearDesignSelection();
                                        }}
                                        className="rounded-lg border border-danger-tint px-2.5 py-1.5 text-[10px] font-medium text-danger-soft hover:border-danger hover:text-strong transition-colors"
                                    >
                                        {t("customize.designDelete")}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                        {renderSelectedDesignControls()}
                    </div>
                </div>
            </CustomizeSectionCard>
            )}

        </div>
        </CustomizeNavigatorContext.Provider>
    );
}
