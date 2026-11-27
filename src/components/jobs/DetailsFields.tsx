"use client";

import { useTranslation } from "@/lib/i18n";
import type { DetailsErrors, DetailsField, DetailsForm } from "@/lib/jobs/form";
import { PAY_PERIODS, WORK_MODES } from "@/lib/jobs/schema";
import { FIELD_CLASS, LABEL_CLASS, TEXTAREA_CLASS } from "./shared";

interface FieldsProps {
    form: DetailsForm;
    errors: DetailsErrors;
    onChange: <K extends DetailsField>(field: K, value: DetailsForm[K]) => void;
    /** Prefix for element ids and test ids, so two forms never share an id. */
    idPrefix: string;
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <label htmlFor={id} className={LABEL_CLASS}>{label}</label>
            {children}
            {error && <p id={`${id}-error`} className="mt-1 text-xs text-danger" data-testid={`${id}-error`}>{error}</p>}
        </div>
    );
}

function TextField({ field, label, props, type = "text", autoComplete = "off", placeholder, autoFocus = false }: { field: DetailsField; label: string; props: FieldsProps; type?: string; autoComplete?: string; placeholder?: string; autoFocus?: boolean }) {
    const { t } = useTranslation();
    const id = `${props.idPrefix}-${field}`;
    const error = props.errors[field];
    return (
        <Field id={id} label={label} error={error ? t(error) : undefined}>
            <input
                id={id}
                type={type}
                value={props.form[field] as string}
                onChange={(event) => props.onChange(field, event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                autoComplete={autoComplete}
                placeholder={placeholder}
                data-autofocus={autoFocus || undefined}
                data-testid={id}
                className={FIELD_CLASS}
            />
        </Field>
    );
}

/** Company, role and link: the only fields a new job needs. */
export function EssentialFields({ focusFirst = false, ...props }: FieldsProps & { focusFirst?: boolean }) {
    const { t } = useTranslation();
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <TextField field="company" label={t("jobs.field.company")} props={props} autoComplete="organization" autoFocus={focusFirst} />
            <TextField field="role" label={t("jobs.field.role")} props={props} autoComplete="organization-title" />
            <div className="sm:col-span-2">
                <TextField field="jobUrl" label={t("jobs.field.jobUrl")} props={props} type="url" />
            </div>
        </div>
    );
}

/** Everything else about the job. */
export function MoreFields(props: FieldsProps) {
    const { t } = useTranslation();
    const select = (field: "workMode" | "payPeriod", options: readonly string[], label: string, optionKey: string) => {
        const id = `${props.idPrefix}-${field}`;
        return (
            <Field id={id} label={label}>
                <select
                    id={id}
                    value={props.form[field]}
                    onChange={(event) => props.onChange(field, event.target.value as never)}
                    data-testid={id}
                    className={FIELD_CLASS}
                >
                    {options.map((option) => <option key={option} value={option}>{t(`${optionKey}.${option}`)}</option>)}
                </select>
            </Field>
        );
    };
    const descriptionId = `${props.idPrefix}-descriptionMarkdown`;
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <TextField field="location" label={t("jobs.field.location")} props={props} />
            {select("workMode", WORK_MODES, t("jobs.field.workMode"), "jobs.workMode")}
            <TextField field="employmentType" label={t("jobs.field.employmentType")} props={props} placeholder={t("jobs.field.employmentTypeHint")} />
            <TextField field="deadline" label={t("jobs.field.deadline")} props={props} type="date" />
            <fieldset className="sm:col-span-2">
                <legend className={LABEL_CLASS}>{t("jobs.field.compensation")}</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <TextField field="payMin" label={t("jobs.field.payMin")} props={props} />
                    <TextField field="payMax" label={t("jobs.field.payMax")} props={props} />
                    <TextField field="payCurrency" label={t("jobs.field.payCurrency")} props={props} placeholder="EUR" />
                    {select("payPeriod", PAY_PERIODS, t("jobs.field.payPeriod"), "jobs.payPeriod")}
                </div>
            </fieldset>
            <TextField field="tags" label={t("jobs.field.tags")} props={props} placeholder={t("jobs.field.tagsHint")} />
            <TextField field="source" label={t("jobs.field.source")} props={props} placeholder={t("jobs.field.sourceHint")} />
            <div className="sm:col-span-2">
                <Field id={descriptionId} label={t("jobs.field.description")}>
                    <textarea
                        id={descriptionId}
                        value={props.form.descriptionMarkdown}
                        onChange={(event) => props.onChange("descriptionMarkdown", event.target.value)}
                        placeholder={t("jobs.field.descriptionHint")}
                        data-testid={descriptionId}
                        className={TEXTAREA_CLASS}
                    />
                </Field>
            </div>
        </div>
    );
}
