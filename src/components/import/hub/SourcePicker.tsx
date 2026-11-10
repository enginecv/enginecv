"use client";

import { Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "@/lib/i18n";
import { SourceReadError, readAuthoringText, readSourceFile, type ReadSourceHelpers } from "@/lib/import/read-source";
import { IMPORT_SOURCES, type ImportSource } from "@/lib/import/sources";
import type { StagedBatch } from "@/lib/import/staging/types";

const LINKEDIN_ERRORS: Record<string, string> = {
    "too-large": "linkedinImport.errorTooLarge",
    "unrecognized-file": "linkedinImport.errorUnrecognizedFile",
    "corrupt-archive": "linkedinImport.errorCorruptArchive",
    "no-profile-data": "linkedinImport.errorNoProfileData",
};

const EUROPASS_ERRORS: Record<string, string> = {
    "too-large": "europassImport.errorTooLarge",
    "unrecognized-file": "europassImport.errorUnrecognizedFile",
    "no-europass-data": "europassImport.errorNoEuropassData",
    "corrupt-file": "europassImport.errorCorruptFile",
};

interface SourcePickerProps {
    onAdd: (batches: StagedBatch[]) => void;
    helpers: ReadSourceHelpers;
    /** Files handed in from outside, such as a file dropped on the dashboard. Read once, on mount. */
    initialFiles?: File[];
}

/** Sources the picker can read today; the others join as their phases ship. */
function isListed(source: ImportSource): boolean {
    return source.kind === "file" || source.kind === "paste";
}

/** Lists the sources, takes dropped or chosen files and pasted AI answers, and stages what they hold. */
export function SourcePicker({ onAdd, helpers, initialFiles }: SourcePickerProps) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pasted, setPasted] = useState("");
    const startedRef = useRef(false);

    const messageFor = (cause: unknown): string => {
        if (cause instanceof SourceReadError) {
            if (cause.code === "unsupported") return t("importHub.error.unsupported");
            if (cause.code === "linkedin-failure") return t(LINKEDIN_ERRORS[cause.failureClass ?? ""] ?? "importHub.error.unreadable");
            if (cause.code === "europass-failure") return t(EUROPASS_ERRORS[cause.failureClass ?? ""] ?? "importHub.error.unreadable");
        }
        return t("importHub.error.unreadable");
    };

    const readFiles = async (files: File[]) => {
        if (files.length === 0) return;
        setError(null);
        setBusy(true);
        const staged: StagedBatch[] = [];
        let failure: string | null = null;
        // One bad file never blocks the others.
        for (const file of files) {
            try {
                staged.push(...(await readSourceFile(file, helpers)));
            } catch (cause) {
                failure = `${file.name}: ${messageFor(cause)}`;
            }
        }
        onAdd(staged);
        setError(failure);
        setBusy(false);
    };

    useEffect(() => {
        if (!initialFiles || initialFiles.length === 0 || startedRef.current) return;
        startedRef.current = true;
        // Deferred so the first paint is not blocked by reading the file.
        void Promise.resolve().then(() => readFiles(initialFiles));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the files handed in on mount, once
    }, [initialFiles]);

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragging(false);
        void readFiles(Array.from(event.dataTransfer.files));
    };

    const addPasted = () => {
        setError(null);
        try {
            onAdd([readAuthoringText(pasted, t("importHub.paste.name"), "paste-ai")]);
            setPasted("");
        } catch {
            setError(t("importHub.paste.invalid"));
        }
    };

    return (
        <div className="space-y-4">
            <div
                data-testid="import-hub-dropzone"
                onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors ${dragging ? "border-accent bg-accent/5" : "border-edge bg-surface-1"}`}
            >
                {busy ? <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" /> : <Upload className="h-5 w-5 text-faint" aria-hidden="true" />}
                <p className="text-sm text-bright">
                    {busy ? t("importHub.reading") : t("importHub.drop")}
                </p>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept=".json,.zip,.csv,.pdf,.xml,.txt"
                    data-testid="import-hub-file-input"
                    aria-label={t("importHub.chooseFile")}
                    className="hidden"
                    onChange={(event) => {
                        void readFiles(Array.from(event.target.files ?? []));
                        event.target.value = "";
                    }}
                />
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                    className="min-h-11 rounded-md border border-edge px-4 text-sm text-bright outline-none transition-colors hover:bg-surface-4 focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
                >
                    {t("importHub.chooseFile")}
                </button>
            </div>

            {error && (
                <p role="alert" data-testid="import-hub-error" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-danger-soft">
                    {error}
                </p>
            )}

            <section aria-label={t("importHub.supported")}>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">{t("importHub.supported")}</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                    {IMPORT_SOURCES.filter(isListed).map((source) => (
                        <li key={source.id} className="rounded-lg border border-edge p-3" data-testid={`import-hub-source-${source.id}`}>
                            <p className="text-sm text-bright">{t(source.labelKey)}</p>
                            <p className="text-xs text-faint">{t(source.descriptionKey)}</p>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="space-y-2">
                <label htmlFor="import-hub-paste" className="block text-sm text-bright">{t("importHub.paste.label")}</label>
                <textarea
                    id="import-hub-paste"
                    value={pasted}
                    onChange={(event) => setPasted(event.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-edge bg-surface-1 p-2 text-sm text-bright outline-none focus-visible:ring-1 focus-visible:ring-accent"
                />
                <button
                    type="button"
                    disabled={!pasted.trim()}
                    onClick={addPasted}
                    className="min-h-11 rounded-md border border-edge px-4 text-sm text-bright outline-none transition-colors hover:bg-surface-4 focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
                >
                    {t("importHub.paste.add")}
                </button>
            </section>
        </div>
    );
}
