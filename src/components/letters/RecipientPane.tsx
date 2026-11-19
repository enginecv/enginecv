"use client";

import { useTranslation } from "@/lib/i18n";
import type { LetterDocument } from "@/lib/letters/schema";
import { PaneSection, TextAreaField, TextField } from "./fields";

/** Who the letter goes to and which job it is for. */
export function RecipientPane({ letter, onChange, readOnly = false }: {
    letter: LetterDocument;
    onChange: (change: (current: LetterDocument) => LetterDocument) => void;
    readOnly?: boolean;
}) {
    const { t } = useTranslation();
    return (
        <PaneSection title={t("letters.section.recipient")} testId="letter-recipient-pane">
            <TextField label={t("letters.recipient.name")} value={letter.recipient.name} disabled={readOnly} testId="letter-recipient-name"
                onChange={(name) => onChange((current) => ({ ...current, recipient: { ...current.recipient, name } }))} />
            <TextAreaField label={t("letters.recipient.address")} value={letter.recipient.address} disabled={readOnly} testId="letter-recipient-address"
                onChange={(address) => onChange((current) => ({ ...current, recipient: { ...current.recipient, address } }))} />
            <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t("letters.company")} value={letter.company} disabled={readOnly} testId="letter-company"
                    onChange={(company) => onChange((current) => ({ ...current, company }))} />
                <TextField label={t("letters.role")} value={letter.role} disabled={readOnly} testId="letter-role"
                    onChange={(role) => onChange((current) => ({ ...current, role }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t("letters.date")} type="date" value={letter.date} disabled={readOnly} testId="letter-date"
                    onChange={(date) => onChange((current) => ({ ...current, date }))} />
                <TextField label={t("letters.subject")} value={letter.subject} disabled={readOnly} testId="letter-subject"
                    onChange={(subject) => onChange((current) => ({ ...current, subject }))} />
            </div>
        </PaneSection>
    );
}
