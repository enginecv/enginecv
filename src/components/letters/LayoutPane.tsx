"use client";

import { useState } from "react";
import { CV_LANGUAGE_OPTIONS } from "@/lib/cv-language";
import { useTranslation } from "@/lib/i18n";
import { applyLayout, applyPaperSize } from "@/lib/letters/layout";
import { LETTER_LAYOUTS, PAPER_SIZES, type LetterDocument } from "@/lib/letters/schema";
import { PaneSection, SelectField } from "./fields";


/**
 * Layout, paper size, language and photo for one letter. The German layout is defined for
 * A4, so choosing it on another size switches the letter to A4 (and says so); choosing the
 * standard layout again brings the earlier size back. The CV is never changed from here.
 */
export function LayoutPane({ letter, onChange, readOnly = false }: {
    letter: LetterDocument;
    onChange: (change: (current: LetterDocument) => LetterDocument) => void;
    readOnly?: boolean;
}) {
    const { t } = useTranslation();
    const [notice, setNotice] = useState<string | null>(null);
    const german = letter.layout === "din5008";

    const chooseLayout = (layout: LetterDocument["layout"]) => {
        const result = applyLayout(letter, layout);
        setNotice(result.switchedToA4 ? t("letters.layout.switchedToA4") : null);
        onChange((current) => applyLayout(current, layout).letter);
    };

    return (
        <PaneSection title={t("letters.section.page")} testId="letter-layout-pane" tips="page">
            <SelectField id="letter-layout" label={t("letters.layout.label")} value={letter.layout} disabled={readOnly} testId="letter-layout" onChange={(value) => chooseLayout(value as LetterDocument["layout"])}
                hint={notice ? <p role="status" className="text-xs text-accent" data-testid="letter-layout-notice">{notice}</p> : undefined}>
                {LETTER_LAYOUTS.map((layout) => <option key={layout} value={layout}>{t(`letters.layout.${layout}`)}</option>)}
            </SelectField>

            <SelectField id="letter-paper" label={t("letters.paper.label")} value={german ? "a4" : letter.paperSize} disabled={readOnly || german} testId="letter-paper" onChange={(value) => onChange((current) => applyPaperSize(current, value as LetterDocument["paperSize"]))}
                hint={german ? <p className="text-xs text-faint" data-testid="letter-paper-hint">{t("letters.paper.germanHint")}</p> : undefined}>
                {PAPER_SIZES.map((size) => <option key={size} value={size}>{t(`letters.paper.${size}`)}</option>)}
            </SelectField>

            <SelectField id="letter-language" label={t("letters.language.label")} value={letter.language} disabled={readOnly} testId="letter-language" onChange={(value) => onChange((current) => ({ ...current, language: value }))}
                hint={<p className="text-xs text-faint">{t("letters.language.hint")}</p>}>
                {!CV_LANGUAGE_OPTIONS.some((option) => option.value === letter.language) && <option value={letter.language}>{letter.language}</option>}
                {CV_LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>

            <label className="flex items-center gap-2 text-sm text-mid">
                <input type="checkbox" checked={letter.showPhoto} disabled={readOnly} onChange={(event) => onChange((current) => ({ ...current, showPhoto: event.target.checked }))} data-testid="letter-show-photo" className="h-4 w-4 accent-accent" />
                {t("letters.photo.show")}
            </label>

            {german && (
                <label className="flex items-center gap-2 text-sm text-mid">
                    <input type="checkbox" checked={letter.printFoldMarks} disabled={readOnly} onChange={(event) => onChange((current) => ({ ...current, printFoldMarks: event.target.checked }))} data-testid="letter-print-fold-marks" className="h-4 w-4 accent-accent" />
                    {t("letters.layout.printFoldMarks")}
                </label>
            )}
        </PaneSection>
    );
}
