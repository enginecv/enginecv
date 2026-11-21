"use client";

import { Palette, RotateCcw, Type } from "lucide-react";
import type { ReactNode } from "react";
import { ColorPickerCard, FontSelect, Select, TickSlider } from "@/components/editor/CustomizeSidebar";
import { useTranslation } from "@/lib/i18n";
import type { DesignKey, LetterDesign, LetterDocument } from "@/lib/letters/schema";
import { PaneSection } from "./fields";

const WEIGHTS = [
    { value: "400", labelKey: "editor.fontRegular" },
    { value: "500", labelKey: "editor.fontMedium" },
    { value: "600", labelKey: "editor.fontSemiBold" },
    { value: "700", labelKey: "editor.fontBold" },
    { value: "800", labelKey: "editor.fontExtraBold" },
] as const;

const CAPS = [
    { value: "none", labelKey: "letters.design.capsNone" },
    { value: "uppercase", labelKey: "letters.design.capsUpper" },
    { value: "capitalize", labelKey: "letters.design.capsTitle" },
] as const;

/** A control with its label, a marker when this letter changed it, and a way back to the base value. */
function DesignRow({ keys, label, value, changed, readOnly, onReset, children }: {
    keys: DesignKey;
    label: string;
    value?: ReactNode;
    changed: boolean;
    readOnly: boolean;
    onReset: () => void;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    return (
        <div className="space-y-1.5" data-testid={`letter-design-${keys}`}>
            <div className="flex items-end justify-between gap-2">
                <span className="text-xs font-semibold text-strong/90">{label}</span>
                <span className="flex items-center gap-2 text-[10px] text-faint">
                    {value}
                    {changed && (
                        <>
                            <span className="rounded-md bg-accent/15 px-1.5 py-0.5 font-medium text-accent" data-testid={`letter-design-changed-${keys}`}>{t("letters.design.changed")}</span>
                            {!readOnly && (
                                <button type="button" onClick={onReset} data-testid={`letter-design-reset-${keys}`} className="flex items-center gap-1 text-accent hover:underline">
                                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                                    {t("letters.design.reset")}
                                </button>
                            )}
                        </>
                    )}
                </span>
            </div>
            {children}
        </div>
    );
}

/**
 * The letter's own design controls, the same fonts, sliders and colour pickers as the CV editor's
 * Customize panel. A letter linked to a CV starts from the CV's design and the person changes only
 * what they want for this letter (each change is marked and can be reset); a standalone letter starts
 * from the default design. The CV is never changed from here.
 */
export function DesignPane({ design, baseDesign, overridden, standalone, onChange, readOnly = false }: {
    /** What the letter prints now. */
    design: LetterDesign;
    /** What it would print with no changes of its own: the CV's design, or the default. */
    baseDesign: LetterDesign;
    overridden: DesignKey[];
    standalone: boolean;
    onChange: (change: (current: LetterDocument) => LetterDocument) => void;
    readOnly?: boolean;
}) {
    const { t } = useTranslation();

    const setValue = <K extends DesignKey>(key: K, value: LetterDesign[K]) =>
        onChange((current) => {
            const next = { ...current.designOverrides };
            // Choosing what the base already has is the same as not changing it.
            if (baseDesign[key] === value) delete next[key];
            else next[key] = value;
            return { ...current, designOverrides: next };
        });

    const reset = (key: DesignKey) =>
        onChange((current) => {
            const next = { ...current.designOverrides };
            delete next[key];
            return { ...current, designOverrides: next };
        });

    const resetAll = () => onChange((current) => ({ ...current, designOverrides: {} }));

    return (
        <PaneSection title={t("letters.section.design")} testId="letter-design-pane">
            <p className="text-xs text-mid">{t(standalone ? "letters.design.hintStandalone" : "letters.design.hint")}</p>
            <div className={`space-y-5 ${readOnly ? "pointer-events-none opacity-60" : ""}`} aria-disabled={readOnly}>
                <DesignRow changed={overridden.includes("fontFamily")} readOnly={readOnly} onReset={() => reset("fontFamily")} keys="fontFamily" label={t("customize.fontFamily")}>
                    <FontSelect value={design.fontFamily} customFonts={[]} onChange={(family) => setValue("fontFamily", family)} />
                </DesignRow>
                <DesignRow changed={overridden.includes("fontSize")} readOnly={readOnly} onReset={() => reset("fontSize")} keys="fontSize" label={t("customize.fontSize")} value={`${design.fontSize} pt`}>
                    <TickSlider value={design.fontSize} min={8} max={16} step={0.5} ticks={17} onChange={(value) => setValue("fontSize", value)} />
                </DesignRow>
                <DesignRow changed={overridden.includes("lineHeight")} readOnly={readOnly} onReset={() => reset("lineHeight")} keys="lineHeight" label={t("customize.lineHeight")} value={`${design.lineHeight.toFixed(2)}x`}>
                    <TickSlider value={design.lineHeight} min={1} max={2} step={0.05} ticks={11} onChange={(value) => setValue("lineHeight", value)} />
                </DesignRow>
                <DesignRow changed={overridden.includes("marginHmm")} readOnly={readOnly} onReset={() => reset("marginHmm")} keys="marginHmm" label={t("customize.leftRightMargin")} value={`${design.marginHmm} mm`}>
                    <TickSlider value={design.marginHmm} min={0} max={50} step={1} ticks={11} onChange={(value) => setValue("marginHmm", value)} />
                </DesignRow>
                <DesignRow changed={overridden.includes("marginVmm")} readOnly={readOnly} onReset={() => reset("marginVmm")} keys="marginVmm" label={t("customize.topBottomMargin")} value={`${design.marginVmm} mm`}>
                    <TickSlider value={design.marginVmm} min={0} max={50} step={1} ticks={11} onChange={(value) => setValue("marginVmm", value)} />
                </DesignRow>
                <div className="grid gap-3 sm:grid-cols-2">
                    <DesignRow changed={overridden.includes("textColor")} readOnly={readOnly} onReset={() => reset("textColor")} keys="textColor" label={t("customize.textColor")}>
                        <ColorPickerCard label={t("customize.textColor")} value={design.textColor} icon={Type} onChange={(value) => setValue("textColor", value)} />
                    </DesignRow>
                    <DesignRow changed={overridden.includes("accentColor")} readOnly={readOnly} onReset={() => reset("accentColor")} keys="accentColor" label={t("customize.accentColor")}>
                        <ColorPickerCard label={t("customize.accentColor")} value={design.accentColor} icon={Palette} onChange={(value) => setValue("accentColor", value)} />
                    </DesignRow>
                </div>
                <DesignRow changed={overridden.includes("headerFontFamily")} readOnly={readOnly} onReset={() => reset("headerFontFamily")} keys="headerFontFamily" label={t("letters.design.headerFont")}>
                    <FontSelect value={design.headerFontFamily} customFonts={[]} showInherit inheritLabel={t("letters.design.sameAsBody")} onChange={(family) => setValue("headerFontFamily", family)} />
                </DesignRow>
                <div className="grid gap-3 sm:grid-cols-2">
                    <DesignRow changed={overridden.includes("headerFontWeight")} readOnly={readOnly} onReset={() => reset("headerFontWeight")} keys="headerFontWeight" label={t("letters.design.headerWeight")}>
                        <Select value={design.headerFontWeight} options={WEIGHTS.map((option) => ({ value: option.value, label: t(option.labelKey) }))} onChange={(value) => setValue("headerFontWeight", value)} testId="letter-design-weight" />
                    </DesignRow>
                    <DesignRow changed={overridden.includes("headerTextTransform")} readOnly={readOnly} onReset={() => reset("headerTextTransform")} keys="headerTextTransform" label={t("letters.design.headerCaps")}>
                        <Select value={design.headerTextTransform} options={CAPS.map((option) => ({ value: option.value, label: t(option.labelKey) }))} onChange={(value) => setValue("headerTextTransform", value)} testId="letter-design-caps" />
                    </DesignRow>
                </div>
            </div>
            {overridden.length > 0 && !readOnly && (
                <button type="button" onClick={resetAll} data-testid="letter-design-reset-all" className="flex items-center gap-1 text-xs text-accent hover:underline">
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    {t("letters.design.resetAll")}
                </button>
            )}
        </PaneSection>
    );
}
