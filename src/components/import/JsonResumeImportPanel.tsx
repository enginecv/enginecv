"use client";

import { FileJson, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { ConversionLossSummary } from "@/components/import/ConversionLossSummary";
import { isJsonResumeDocument } from "@/lib/agent/authoring/detect";
import { useTranslation } from "@/lib/i18n";
import { persistImportedResume } from "@/lib/import/persist-imported-resume";
import { readFileText } from "@/lib/import/read-file";
import { MAX_JSON_RESUME_BYTES } from "@/lib/json-resume/schema";
import { jsonResumeToResume, type JsonResumeImportResult } from "@/lib/json-resume/to-resume";
import type { Resume } from "@/lib/schema";

type PanelStep = "input" | "preview" | "importing" | "error";
type FailureClass = "too-large" | "not-json" | "not-json-resume" | "save-failed";

const ERROR_KEYS: Record<FailureClass, string> = {
    "too-large": "jsonResumeTool.errorTooLarge",
    "not-json": "jsonResumeTool.errorNotJson",
    "not-json-resume": "jsonResumeTool.errorNotJsonResume",
    "save-failed": "jsonResumeTool.errorSaveFailed",
};

/** Editor section ids a conversion reports counts for, in reading order, with their labels. */
const SECTIONS: ReadonlyArray<{ id: string; labelKey: string }> = [
    { id: "experience", labelKey: "editor.sectionExperience" },
    { id: "organisations", labelKey: "editor.sectionOrganisations" },
    { id: "education", labelKey: "editor.sectionEducation" },
    { id: "skills", labelKey: "editor.sectionSkills" },
    { id: "projects", labelKey: "editor.sectionProjects" },
    { id: "languages", labelKey: "editor.sectionLanguages" },
    { id: "certificates", labelKey: "editor.sectionCertificates" },
    { id: "awards", labelKey: "editor.sectionAwards" },
    { id: "publications", labelKey: "editor.sectionPublications" },
    { id: "interests", labelKey: "editor.sectionInterests" },
    { id: "references", labelKey: "editor.sectionReferences" },
];

export interface JsonResumeImportPanelProps {
    /** Called with the new resume id once it is saved. */
    onDone: (id: string) => void;
    /** Id of the element that names the panel, when it stands on a page. */
    labelledBy?: string;
    persistResume?: (resume: Resume) => Promise<string>;
}

/** Why a text is not a usable JSON Resume file, or the conversion when it is one. */
export function readJsonResumeText(text: string): { ok: true; result: JsonResumeImportResult } | { ok: false; failure: FailureClass } {
    // The size limit counts characters, as the editor's own import does.
    if (text.length > MAX_JSON_RESUME_BYTES) return { ok: false, failure: "too-large" };
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { ok: false, failure: "not-json" };
    }
    if (!isJsonResumeDocument(parsed)) return { ok: false, failure: "not-json-resume" };
    return { ok: true, result: jsonResumeToResume(parsed) };
}

/** The JSON Resume import flow for the tool page: drop or paste, preview with a loss report, save. */
export function JsonResumeImportPanel({ onDone, labelledBy, persistResume = persistImportedResume }: JsonResumeImportPanelProps) {
    const { t, tn } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<PanelStep>("input");
    const [result, setResult] = useState<JsonResumeImportResult | null>(null);
    const [failure, setFailure] = useState<FailureClass | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [pasted, setPasted] = useState("");

    const reset = useCallback(() => {
        setStep("input");
        setResult(null);
        setFailure(null);
    }, []);

    const handleText = useCallback((text: string) => {
        const read = readJsonResumeText(text);
        if (!read.ok) {
            setFailure(read.failure);
            setStep("error");
            return;
        }
        setResult(read.result);
        setStep("preview");
    }, []);

    const handleFile = useCallback(async (file: File) => {
        if (file.size > MAX_JSON_RESUME_BYTES) {
            setFailure("too-large");
            setStep("error");
            return;
        }
        handleText(await readFileText(file));
    }, [handleText]);

    const confirm = useCallback(async () => {
        if (!result) return;
        setStep("importing");
        try {
            onDone(await persistResume(result.resume));
        } catch {
            setFailure("save-failed");
            setStep("error");
        }
    }, [onDone, persistResume, result]);

    const fullName = result?.resume.basics.name?.trim() ?? "";
    const rows = result ? SECTIONS.filter((section) => (result.counts[section.id] ?? 0) > 0) : [];

    return (
        <div aria-labelledby={labelledBy} role={labelledBy ? "region" : undefined} data-testid="json-resume-panel">
            {step === "input" && (
                <div className="space-y-4">
                    <div
                        role="button"
                        tabIndex={0}
                        data-testid="json-resume-drop-zone"
                        aria-label={t("jsonResumeTool.dropZoneLabel")}
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
                            const file = event.dataTransfer.files[0];
                            if (file) void handleFile(file);
                        }}
                        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                            dragOver ? "border-accent bg-accent/5" : "border-edge bg-surface-1 hover:border-faint"
                        }`}
                    >
                        <FileJson className="h-6 w-6 text-accent" aria-hidden="true" />
                        <p className="text-sm font-medium text-strong">{t("jsonResumeTool.dropZoneLabel")}</p>
                        <p className="text-xs text-faint">{t("jsonResumeTool.dropZoneHint")}</p>
                        <span className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-bright">
                            {t("jsonResumeTool.dropZoneBrowse")}
                        </span>
                    </div>
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".json,application/json"
                        data-testid="json-resume-file-input"
                        // Opened through the drop zone button and kept out of the tab order, so the button stays the only control.
                        tabIndex={-1}
                        aria-hidden="true"
                        className="sr-only"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void handleFile(file);
                            event.target.value = "";
                        }}
                    />

                    <div>
                        <label htmlFor="json-resume-paste" className="text-sm font-medium text-strong">
                            {t("jsonResumeTool.pasteLabel")}
                        </label>
                        <textarea
                            id="json-resume-paste"
                            data-testid="json-resume-paste"
                            value={pasted}
                            onChange={(event) => setPasted(event.target.value)}
                            placeholder={t("jsonResumeTool.pastePlaceholder")}
                            rows={5}
                            spellCheck={false}
                            className="mt-2 w-full rounded-xl border border-edge bg-surface-1 p-3 font-mono text-xs text-strong placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        />
                        <div className="mt-2 flex justify-end">
                            <button
                                type="button"
                                disabled={pasted.trim() === ""}
                                onClick={() => handleText(pasted)}
                                data-testid="json-resume-paste-submit"
                                className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {t("jsonResumeTool.pasteSubmit")}
                            </button>
                        </div>
                    </div>

                    <p className="text-xs leading-5 text-dim">{t("jsonResumeTool.ownDataNote")}</p>
                </div>
            )}

            {step === "importing" && (
                <div className="flex min-h-40 items-center justify-center rounded-xl border border-edge bg-surface-1 p-8 text-center">
                    <div>
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" aria-hidden="true" />
                        <p role="status" className="mt-4 text-sm text-bright">{t("jsonResumeTool.importing")}</p>
                    </div>
                </div>
            )}

            {step === "preview" && result && (
                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold text-strong">{t("jsonResumeTool.previewTitle")}</h3>
                        <p className="mt-1 text-sm leading-6 text-dim">{t("jsonResumeTool.previewSubtitle")}</p>
                    </div>

                    {fullName ? (
                        <p data-testid="json-resume-preview-name" className="rounded-xl border border-edge bg-surface-1 p-3.5 text-sm font-semibold text-strong">
                            {fullName}
                        </p>
                    ) : (
                        <p data-testid="json-resume-preview-no-name" className="rounded-lg border border-warning-tint2 bg-warning-tint px-3 py-2 text-xs leading-5 text-warning">
                            {t("jsonResumeTool.previewNoName")}
                        </p>
                    )}

                    {rows.length > 0 ? (
                        <ul data-testid="json-resume-preview-sections" className="grid gap-2 sm:grid-cols-2">
                            {rows.map((section) => (
                                <li
                                    key={section.id}
                                    data-testid={`json-resume-preview-section-${section.id}`}
                                    className="flex items-center justify-between rounded-xl border border-edge bg-surface-1 px-3.5 py-2.5"
                                >
                                    <span className="text-sm text-strong">{t(section.labelKey)}</span>
                                    <span className="text-xs text-dim">{tn("jsonResumeTool.previewEntryCount", result.counts[section.id])}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p data-testid="json-resume-preview-empty" className="text-sm text-mid">{t("jsonResumeTool.previewEmpty")}</p>
                    )}

                    <ConversionLossSummary report={result.report} defaultOpen />

                    <div className="flex flex-wrap justify-end gap-3">
                        <button
                            type="button"
                            onClick={reset}
                            data-testid="json-resume-cancel"
                            className="rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                        >
                            {t("jsonResumeTool.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={() => void confirm()}
                            data-testid="json-resume-confirm"
                            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-soft"
                        >
                            {t("jsonResumeTool.confirm")}
                        </button>
                    </div>
                </div>
            )}

            {step === "error" && failure && (
                <div className="space-y-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <p data-testid="json-resume-error" role="alert" className="text-sm leading-6 text-danger-soft">
                        {t(ERROR_KEYS[failure])}
                    </p>
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={reset}
                            data-testid="json-resume-retry"
                            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-soft"
                        >
                            {t("jsonResumeTool.retry")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
