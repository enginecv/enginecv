import type { ApplicationDetails } from "./operations";
import { normalizeTags } from "./operations";
import { dateOnlySchema, isSafeWebUrl, PAY_PERIODS, WORK_MODES, type JobApplication } from "./schema";

/**
 * The editable job details as form text, and the way back. Every field is a string while it is typed;
 * empty optional text is stored as null. Errors are message keys for the field they belong to.
 */

export interface DetailsForm {
    company: string;
    role: string;
    jobUrl: string;
    location: string;
    workMode: (typeof WORK_MODES)[number];
    employmentType: string;
    deadline: string;
    tags: string;
    source: string;
    descriptionMarkdown: string;
    notesMarkdown: string;
    payMin: string;
    payMax: string;
    payCurrency: string;
    payPeriod: (typeof PAY_PERIODS)[number];
}

/** The details the form edits; working documents are linked elsewhere. */
export type EditableDetails = Omit<ApplicationDetails, "workingCvId" | "workingLetterId">;
export type DetailsField = keyof DetailsForm;
export type DetailsErrors = Partial<Record<DetailsField, string>>;

export function emptyDetailsForm(): DetailsForm {
    return {
        company: "", role: "", jobUrl: "", location: "", workMode: "unspecified", employmentType: "", deadline: "",
        tags: "", source: "", descriptionMarkdown: "", notesMarkdown: "", payMin: "", payMax: "", payCurrency: "", payPeriod: "year",
    };
}

export function formFromApplication(application: JobApplication): DetailsForm {
    const pay = application.compensation;
    return {
        company: application.company,
        role: application.role,
        jobUrl: application.jobUrl ?? "",
        location: application.location ?? "",
        workMode: application.workMode,
        employmentType: application.employmentType ?? "",
        deadline: application.deadline ?? "",
        tags: application.tags.join(", "),
        source: application.source ?? "",
        descriptionMarkdown: application.descriptionMarkdown,
        notesMarkdown: application.notesMarkdown,
        payMin: pay?.min != null ? String(pay.min) : "",
        payMax: pay?.max != null ? String(pay.max) : "",
        payCurrency: pay?.currency ?? "",
        payPeriod: pay?.period ?? "year",
    };
}

const orNull = (value: string) => (value.trim() === "" ? null : value.trim());

function parseAmount(value: string): number | null | "invalid" {
    const text = value.trim().replace(/\s/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/[,']/g, "");
    if (text === "") return null;
    const amount = Number(text);
    return Number.isFinite(amount) && amount >= 0 ? amount : "invalid";
}

/** Converts the form to stored details, or names the fields that need fixing. */
export function detailsFromForm(form: DetailsForm): { ok: true; details: EditableDetails } | { ok: false; errors: DetailsErrors } {
    const errors: DetailsErrors = {};
    if (!form.company.trim()) errors.company = "jobs.form.error.required";
    if (!form.role.trim()) errors.role = "jobs.form.error.required";
    const jobUrl = orNull(form.jobUrl);
    if (jobUrl && !isSafeWebUrl(jobUrl)) errors.jobUrl = "jobs.form.error.url";
    const deadline = orNull(form.deadline);
    if (deadline && !dateOnlySchema.safeParse(deadline).success) errors.deadline = "jobs.form.error.date";

    const min = parseAmount(form.payMin);
    const max = parseAmount(form.payMax);
    const currency = form.payCurrency.trim().toUpperCase();
    if (min === "invalid") errors.payMin = "jobs.form.error.amount";
    if (max === "invalid") errors.payMax = "jobs.form.error.amount";
    const hasPay = (min !== null && min !== "invalid") || (max !== null && max !== "invalid");
    if (typeof min === "number" && typeof max === "number" && min > max) errors.payMax = "jobs.form.error.range";
    if (hasPay && !/^[A-Z]{3}$/.test(currency)) errors.payCurrency = "jobs.form.error.currency";

    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return {
        ok: true,
        details: {
            company: form.company.trim(),
            role: form.role.trim(),
            jobUrl,
            source: orNull(form.source),
            location: orNull(form.location),
            workMode: form.workMode,
            employmentType: orNull(form.employmentType),
            compensation: hasPay ? { min: min as number | null, max: max as number | null, currency, period: form.payPeriod } : null,
            descriptionMarkdown: form.descriptionMarkdown,
            notesMarkdown: form.notesMarkdown,
            tags: normalizeTags(form.tags.split(",")),
            deadline,
        },
    };
}
