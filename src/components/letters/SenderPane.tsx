"use client";

import { RotateCcw } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { SENDER_KEYS, type LetterDocument, type Sender, type SenderKey } from "@/lib/letters/schema";
import { PaneSection, TextAreaField, TextField } from "./fields";

/**
 * The sender block: each field shows what this letter prints. By default it is the
 * CV's value and follows the CV. Typing a different value overrides it for this letter
 * only (and is marked); the reset button makes it follow the CV again. The CV itself
 * is never changed from here.
 */
export function SenderPane({ sender, cvSender, overridden, onChange, readOnly = false }: {
    /** What the letter prints now. */
    sender: Sender;
    /** The CV's own values, or null when the CV is missing. */
    cvSender: Sender | null;
    overridden: SenderKey[];
    onChange: (change: (current: LetterDocument) => LetterDocument) => void;
    readOnly?: boolean;
}) {
    const { t } = useTranslation();

    const setField = (key: SenderKey, value: string) =>
        onChange((current) => {
            const next = { ...current.senderOverrides };
            // Typing the CV's own value back is the same as not overriding.
            if (cvSender && value === cvSender[key]) delete next[key];
            else next[key] = value;
            return { ...current, senderOverrides: next };
        });

    const reset = (key: SenderKey) =>
        onChange((current) => {
            const next = { ...current.senderOverrides };
            delete next[key];
            return { ...current, senderOverrides: next };
        });

    return (
        <PaneSection title={t("letters.section.sender")} testId="letter-sender-pane">
            <p className="text-xs text-mid">{t("letters.sender.hint")}</p>
            {SENDER_KEYS.map((key) => {
                const differs = overridden.includes(key);
                const Field = key === "address" ? TextAreaField : TextField;
                return (
                    <div key={key} className="space-y-1.5">
                        <Field
                            label={t(`letters.field.${key}`)}
                            value={sender[key]}
                            disabled={readOnly}
                            testId={`letter-sender-${key}`}
                            onChange={(value: string) => setField(key, value)}
                        />
                        {differs && (
                            <div className="flex flex-wrap items-center gap-2 text-xs" data-testid={`letter-sender-differs-${key}`}>
                                <span className="rounded-md bg-accent/15 px-1.5 py-0.5 font-medium text-accent">{t("letters.sender.differs")}</span>
                                {cvSender && <span className="truncate text-faint">{t("letters.sender.cvValue", { value: cvSender[key] || t("letters.sender.empty") })}</span>}
                                {!readOnly && cvSender && (
                                    <button type="button" onClick={() => reset(key)} data-testid={`letter-sender-reset-${key}`} className="flex items-center gap-1 text-accent hover:underline">
                                        <RotateCcw className="h-3 w-3" aria-hidden="true" />
                                        {t("letters.sender.reset")}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </PaneSection>
    );
}
