"use client";

import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { EuropassImportError, type EuropassImportFailureClass } from "@/lib/import/europass/errors";
import { MAX_EUROPASS_BYTES, parseEuropassFile, type ParsedEuropassFile } from "@/lib/import/europass/file";
import { mapEuropassToResume } from "@/lib/import/europass/map-europass-to-resume";
import type { ParsedEuropassCv } from "@/lib/import/europass/parse";
import { persistImportedResume } from "@/lib/import/persist-imported-resume";
import type { Resume } from "@/lib/schema";

export const EUROPASS_URL = "https://europass.europa.eu/en";

type PanelStep = "guide" | "parsing" | "preview" | "importing" | "error";

export interface EuropassImportPanelProps {
    /** Called with the new resume id once it is saved. */
    onDone: (id: string) => void;
    /** Cancel on the preview. Without it the panel goes back to the drop zone. */
    onCancel?: () => void;
    /** Reports when saving is in progress, so a host dialog can block closing. */
    onBusyChange?: (busy: boolean) => void;
    /** Id of the element that names the panel, when it stands on a page. */
    labelledBy?: string;
    persistResume?: (resume: Resume) => Promise<string>;
}

const ERROR_MESSAGE_KEYS: Record<EuropassImportFailureClass, string> = {
    "too-large": "europassImport.errorTooLarge",
    "unrecognized-file": "europassImport.errorUnrecognizedFile",
    "no-europass-data": "europassImport.errorNoEuropassData",
    "corrupt-file": "europassImport.errorCorruptFile",
};

const GUIDE_STEPS = [
    { title: "europassImport.guideStep1Title", body: "europassImport.guideStep1Body", link: true },
    { title: "europassImport.guideStep2Title", body: "europassImport.guideStep2Body", link: false },
    { title: "europassImport.guideStep3Title", body: "europassImport.guideStep3Body", link: false },
] as const;

type PreviewSection = { id: string; labelKey: string; count: (cv: ParsedEuropassCv) => number };

const PREVIEW_SECTIONS: PreviewSection[] = [
    { id: "experience", labelKey: "europassImport.previewSectionExperience", count: (cv) => cv.experience.length },
    { id: "education", labelKey: "europassImport.previewSectionEducation", count: (cv) => cv.education.length },
    { id: "languages", labelKey: "europassImport.previewSectionLanguages", count: (cv) => cv.languages.length },
    { id: "skills", labelKey: "europassImport.previewSectionSkills", count: (cv) => cv.skills.length },
    { id: "certifications", labelKey: "europassImport.previewSectionCertifications", count: (cv) => cv.certifications.length },
    { id: "courses", labelKey: "europassImport.previewSectionCourses", count: (cv) => cv.courses.length },
    { id: "projects", labelKey: "europassImport.previewSectionProjects", count: (cv) => cv.projects.length },
    { id: "publications", labelKey: "europassImport.previewSectionPublications", count: (cv) => cv.publications.length },
    { id: "references", labelKey: "europassImport.previewSectionReferences", count: (cv) => cv.references.length },
    { id: "interests", labelKey: "europassImport.previewSectionInterests", count: (cv) => cv.interests.length },
];

function EuropassGuide() {
    const { t } = useTranslation();

    return (
        <div data-testid="europass-import-guide" className="space-y-3">
            <ol className="space-y-3">
                {GUIDE_STEPS.map((step, index) => (
                    <li key={step.title} className="rounded-xl border border-edge bg-surface-1 p-3.5">
                        <div className="flex items-start gap-3">
                            <span
                                aria-hidden="true"
                                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-edge text-xs font-semibold text-accent"
                            >
                                {index + 1}
                            </span>
                            <div className="min-w-0 space-y-1">
                                <p className="text-sm font-medium text-strong">{t(step.title)}</p>
                                <p className="text-xs leading-5 text-mid">{t(step.body)}</p>
                                {step.link && (
                                    <a
                                        href={EUROPASS_URL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        data-testid="europass-site-link"
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent-soft"
                                    >
                                        {t("europassImport.guideStep1LinkLabel")}
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </li>
                ))}
            </ol>
            <p className="text-xs leading-5 text-dim">{t("europassImport.ownDataNote")}</p>
        </div>
    );
}

function EuropassDropZone({ onFile, onTooLarge }: { onFile: (file: File) => void; onTooLarge: () => void }) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const handleFiles = (list: FileList | null) => {
        const file = list?.[0];
        if (!file) return;
        if (file.size > MAX_EUROPASS_BYTES) {
            onTooLarge();
            return;
        }
        onFile(file);
    };

    return (
        <>
            <div
                role="button"
                tabIndex={0}
                data-testid="europass-drop-zone"
                aria-label={t("europassImport.dropZoneLabel")}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        inputRef.current?.click();
                    }
                }}
                onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(false);
                    handleFiles(event.dataTransfer.files);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                    dragOver ? "border-accent bg-accent/5" : "border-edge bg-surface-1 hover:border-faint"
                }`}
            >
                <FileText className="h-6 w-6 text-accent" />
                <p className="text-sm font-medium text-strong">{t("europassImport.dropZoneLabel")}</p>
                <p className="text-xs text-faint">{t("europassImport.dropZoneHint")}</p>
                <span className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-bright">
                    {t("europassImport.dropZoneBrowse")}
                </span>
            </div>
            <input
                ref={inputRef}
                type="file"
                accept=".pdf,.xml,application/pdf,application/xml,text/xml"
                data-testid="europass-file-input"
                // Opened through the drop zone button and kept outside it, out of the tab
                // order and accessibility tree, so the button stays the only control.
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                onChange={(event) => {
                    handleFiles(event.target.files);
                    event.target.value = "";
                }}
            />
        </>
    );
}

/** The Europass import flow: guide and drop zone, preview, save. Used by the dialog and the tool page. */
export function EuropassImportPanel({
    onDone,
    onCancel,
    onBusyChange,
    labelledBy,
    persistResume = persistImportedResume,
}: EuropassImportPanelProps) {
    const { t, tn } = useTranslation();

    const [step, setStep] = useState<PanelStep>("guide");
    const [parsed, setParsed] = useState<ParsedEuropassFile | null>(null);
    const [failureClass, setFailureClass] = useState<EuropassImportFailureClass | null>(null);
    // A reset mid-parse bumps the session so late results are dropped.
    const sessionRef = useRef(0);

    useEffect(() => {
        onBusyChange?.(step === "importing");
    }, [onBusyChange, step]);

    const reset = useCallback(() => {
        sessionRef.current += 1;
        setStep("guide");
        setParsed(null);
        setFailureClass(null);
    }, []);

    const showFailure = useCallback((cls: EuropassImportFailureClass) => {
        setParsed(null);
        setFailureClass(cls);
        setStep("error");
    }, []);

    const handleFile = useCallback(async (file: File) => {
        const session = sessionRef.current;
        setStep("parsing");
        try {
            const result = await parseEuropassFile(file);
            if (session !== sessionRef.current) return;
            setParsed(result);
            setFailureClass(null);
            setStep("preview");
        } catch (error) {
            if (session !== sessionRef.current) return;
            showFailure(error instanceof EuropassImportError ? error.failureClass : "corrupt-file");
        }
    }, [showFailure]);

    const confirmImport = useCallback(async () => {
        if (!parsed) return;
        setStep("importing");
        try {
            const id = await persistResume(mapEuropassToResume(parsed.cv));
            onDone(id);
        } catch {
            showFailure("corrupt-file");
        }
    }, [onDone, parsed, persistResume, showFailure]);

    const cancel = onCancel ?? reset;
    const cv = parsed?.cv;
    const person = cv?.person;
    const fullName = person ? [person.givenName, person.familyName].filter(Boolean).join(" ") : "";
    const otherSectionCount = cv ? cv.activitySections.length + cv.textSections.length : 0;

    return (
        <div aria-labelledby={labelledBy} role={labelledBy ? "region" : undefined} data-testid="europass-import-panel">
            {step === "guide" && (
                <div className="space-y-4">
                    <EuropassGuide />
                    <EuropassDropZone
                        onFile={(file) => void handleFile(file)}
                        onTooLarge={() => showFailure("too-large")}
                    />
                </div>
            )}

            {(step === "parsing" || step === "importing") && (
                <div className="flex min-h-40 items-center justify-center rounded-xl border border-edge bg-surface-1 p-8 text-center">
                    <div>
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />
                        <p className="mt-4 text-sm text-bright">
                            {step === "importing" ? t("europassImport.importing") : t("europassImport.parsing")}
                        </p>
                    </div>
                </div>
            )}

            {step === "preview" && parsed && cv && person && (
                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold text-strong">{t("europassImport.previewTitle")}</h3>
                        <p className="mt-1 text-sm leading-6 text-dim">{t("europassImport.previewSubtitle")}</p>
                    </div>

                    {fullName ? (
                        <div
                            data-testid="europass-preview-profile"
                            className="flex items-center gap-3 rounded-xl border border-edge bg-surface-1 p-3.5"
                        >
                            {person.photo && (
                                // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
                                <img
                                    src={person.photo}
                                    alt={t("europassImport.previewPhotoAlt")}
                                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                                />
                            )}
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-strong">{fullName}</p>
                                {(person.headline || person.location) && (
                                    <p className="mt-0.5 text-xs text-mid">{person.headline || person.location}</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p
                            data-testid="europass-preview-empty-profile"
                            className="rounded-lg border border-warning-tint2 bg-warning-tint px-3 py-2 text-xs leading-5 text-warning"
                        >
                            {t("europassImport.previewEmptyProfile")}
                        </p>
                    )}

                    <ul data-testid="europass-preview-sections" className="grid gap-2 sm:grid-cols-2">
                        {PREVIEW_SECTIONS.filter((section) => section.count(cv) > 0).map((section) => (
                            <li
                                key={section.id}
                                data-testid={`europass-preview-section-${section.id}`}
                                className="flex items-center justify-between rounded-xl border border-edge bg-surface-1 px-3.5 py-2.5"
                            >
                                <span className="text-sm text-strong">{t(section.labelKey)}</span>
                                <span className="text-xs text-dim">
                                    {tn("europassImport.previewEntryCount", section.count(cv))}
                                </span>
                            </li>
                        ))}
                        {otherSectionCount > 0 && (
                            <li
                                data-testid="europass-preview-section-other"
                                className="flex items-center justify-between rounded-xl border border-edge bg-surface-1 px-3.5 py-2.5"
                            >
                                <span className="text-sm text-strong">{t("europassImport.previewSectionOther")}</span>
                                <span className="text-xs text-dim">
                                    {tn("europassImport.previewSectionCount", otherSectionCount)}
                                </span>
                            </li>
                        )}
                    </ul>

                    <p data-testid="europass-preview-source" className="text-xs leading-5 text-dim">
                        {t(parsed.source === "pdf" ? "europassImport.previewSourcePdf" : "europassImport.previewSourceXml")}
                        {cv.format === "legacy" && ` ${t("europassImport.previewLegacyFormat")}`}
                    </p>

                    <div className="flex flex-wrap justify-end gap-3">
                        <button
                            type="button"
                            onClick={cancel}
                            data-testid="europass-import-cancel"
                            className="rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                        >
                            {t("europassImport.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={() => void confirmImport()}
                            data-testid="europass-import-confirm"
                            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-soft"
                        >
                            {t("europassImport.confirm")}
                        </button>
                    </div>
                </div>
            )}

            {step === "error" && failureClass && (
                <div className="space-y-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <p data-testid="europass-import-error" className="text-sm leading-6 text-danger-soft">
                        {t(ERROR_MESSAGE_KEYS[failureClass])}
                    </p>
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={reset}
                            data-testid="europass-import-retry"
                            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-soft"
                        >
                            {t("europassImport.retry")}
                        </button>
                    </div>
                </div>
            )}

            <p
                data-testid="europass-trademark-disclaimer"
                className="mt-5 border-t border-edge pt-3 text-[11px] leading-4 text-faint"
            >
                {t("europassImport.trademarkDisclaimer")}
            </p>
        </div>
    );
}
