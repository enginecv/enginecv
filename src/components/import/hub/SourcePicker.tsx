"use client";

import { ExternalLink, Github, Loader2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { AUTHORING_SCHEMA_URL, MAX_AUTHORING_TEXT_BYTES, buildAiInstructions } from "@/lib/agent/authoring";
import { copyTextToClipboard } from "@/lib/export-clipboard";
import { createId } from "@/lib/id";
import type { ImportProvider } from "@/lib/import/provider";
import type { Resume } from "@/lib/schema";
import { GithubImportPanel } from "../GithubImportPanel";
import { LinkedinImportGuide } from "../LinkedinImportGuide";
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
    /** Tests inject a fake GitHub provider. */
    githubProvider?: ImportProvider;
    /** Opens the GitHub panel straight away. */
    initialGithubOpen?: boolean;
}

/** Sources listed as plain cards; GitHub has its own button and panel. */
function isListed(source: ImportSource): boolean {
    return source.kind === "file" || source.kind === "paste";
}

/** Lists the sources, takes dropped or chosen files and pasted AI answers, and stages what they hold. */
export function SourcePicker({ onAdd, helpers, initialFiles, githubProvider, initialGithubOpen = false }: SourcePickerProps) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pasted, setPasted] = useState("");
    const startedRef = useRef(false);
    const [copyState, setCopyState] = useState<"idle" | "copied" | "denied">("idle");
    const instructions = useMemo(() => buildAiInstructions(t), [t]);
    const [githubOpen, setGithubOpen] = useState(initialGithubOpen);
    const stagedGithub = useRef<Resume | null>(null);

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

    const copyInstructions = async () => {
        try {
            await copyTextToClipboard(instructions);
            setCopyState("copied");
        } catch {
            // Denied, or no clipboard at all: show the text to copy by hand.
            setCopyState("denied");
        }
    };

    const addPasted = async () => {
        setError(null);
        try {
            onAdd([readAuthoringText(pasted, t("importHub.paste.name"), "paste-ai")]);
            setPasted("");
            return;
        } catch {
            // A full EngineCV export pasted as text is read like the file would be.
        }
        try {
            const batches = await readSourceFile(new File([pasted], "pasted.json", { type: "application/json" }), helpers);
            onAdd(batches);
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

            <details className="rounded-xl border border-edge p-3" data-testid="import-hub-linkedin-guide">
                <summary className="cursor-pointer text-sm text-bright">{t("importHub.linkedin.howTo")}</summary>
                <div className="mt-3">
                    <LinkedinImportGuide />
                </div>
            </details>

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

            <section className="space-y-2" data-testid="import-hub-github">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm text-bright">{t("importHub.source.github")}</p>
                        <p className="text-xs text-faint">{t("importHub.source.github.desc")} {t("importHub.needsNetwork")}.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setGithubOpen((value) => !value)}
                        aria-expanded={githubOpen}
                        data-testid="import-hub-github-toggle"
                        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-edge px-4 text-sm text-bright outline-none transition-colors hover:bg-surface-4 focus-visible:ring-1 focus-visible:ring-accent"
                    >
                        <Github className="h-4 w-4" aria-hidden="true" />
                        {githubOpen ? t("importHub.github.cancel") : t("importHub.github.add")}
                    </button>
                </div>
                {githubOpen && (
                    <div className="rounded-xl border border-edge p-3">
                        <GithubImportPanel
                            provider={githubProvider}
                            onCancel={() => setGithubOpen(false)}
                            // Nothing is saved: the mapped CV is held as one more source.
                            persistResume={async (resume) => {
                                stagedGithub.current = resume;
                                return "staged";
                            }}
                            onDone={() => {
                                const resume = stagedGithub.current;
                                stagedGithub.current = null;
                                setGithubOpen(false);
                                if (!resume) return;
                                onAdd([{ id: createId(), sourceId: "github", label: resume.basics.name || t("importHub.source.github"), resume }]);
                            }}
                        />
                    </div>
                )}
            </section>

            <section className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                    <label htmlFor="import-hub-paste" className="min-w-0 flex-1 text-sm text-bright">{t("importHub.paste.label")}</label>
                    <button
                        type="button"
                        onClick={() => void copyInstructions()}
                        data-testid="paste-from-ai-copy-instructions"
                        className="min-h-11 rounded-md px-2 text-xs text-accent outline-none hover:underline focus-visible:ring-1 focus-visible:ring-accent"
                    >
                        {t("authoring.copyInstructions")}
                    </button>
                </div>
                <a
                    href={new URL(AUTHORING_SCHEMA_URL).pathname}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="paste-from-ai-format-link"
                    className="inline-flex items-center gap-1.5 text-xs text-faint underline-offset-4 hover:text-strong hover:underline"
                >
                    {t("authoring.formatLink")}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
                <p role="status" data-testid="paste-from-ai-copy-status" className={copyState === "copied" ? "text-xs text-accent" : "sr-only"}>
                    {copyState === "copied" ? t("authoring.copyInstructionsDone") : ""}
                </p>
                {copyState === "denied" && (
                    <div>
                        <p className="mb-1 text-xs text-faint">{t("authoring.copyInstructionsFallback")}</p>
                        <textarea
                            readOnly
                            value={instructions}
                            rows={4}
                            aria-label={t("authoring.copyInstructions")}
                            onFocus={(event) => event.currentTarget.select()}
                            className="w-full rounded-md border border-edge bg-surface-1 p-2 text-xs text-bright"
                        />
                    </div>
                )}
                <textarea
                    id="import-hub-paste"
                    data-testid="paste-from-ai-input"
                    maxLength={MAX_AUTHORING_TEXT_BYTES * 2}
                    value={pasted}
                    onChange={(event) => setPasted(event.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-edge bg-surface-1 p-2 text-sm text-bright outline-none focus-visible:ring-1 focus-visible:ring-accent"
                />
                <button
                    type="button"
                    disabled={!pasted.trim()}
                    onClick={() => void addPasted()}
                    data-testid="paste-from-ai-add"
                    className="min-h-11 rounded-md border border-edge px-4 text-sm text-bright outline-none transition-colors hover:bg-surface-4 focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
                >
                    {t("importHub.paste.add")}
                </button>
            </section>

            <div className="space-y-1 border-t border-edge pt-3 text-[11px] leading-4 text-faint">
                <p data-testid="linkedin-trademark-disclaimer">{t("linkedinImport.trademarkDisclaimer")}</p>
                <p data-testid="europass-trademark-disclaimer">{t("europassImport.trademarkDisclaimer")}</p>
            </div>
        </div>
    );
}
