"use client";

import { Braces, ClipboardPaste, ExternalLink, Euro, FileText, Github, Linkedin, Loader2, Sparkles, Upload, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AUTHORING_SCHEMA_URL, MAX_AUTHORING_TEXT_BYTES, buildAiInstructions } from "@/lib/agent/authoring";
import { copyTextToClipboard } from "@/lib/export-clipboard";
import { createId } from "@/lib/id";
import type { ImportProvider } from "@/lib/import/provider";
import type { Resume } from "@/lib/schema";
import { GithubImportPanel } from "../GithubImportPanel";
import { LinkedinImportGuide } from "../LinkedinImportGuide";
import { useTranslation } from "@/lib/i18n";
import { SourceReadError, readAuthoringText, readSourceFile, type ReadSourceHelpers } from "@/lib/import/read-source";
import { IMPORT_SOURCES, type SourceId } from "@/lib/import/sources";
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

const TAB_ICONS: Record<SourceId, LucideIcon> = {
    enginecv: FileText,
    jsonresume: Braces,
    linkedin: Linkedin,
    europass: Euro,
    authoring: Sparkles,
    "paste-ai": ClipboardPaste,
    github: Github,
};

interface SourcePickerProps {
    onAdd: (batches: StagedBatch[]) => void;
    helpers: ReadSourceHelpers;
    /** Files handed in from outside, such as a file dropped on the dashboard. Read once, on mount. */
    initialFiles?: File[];
    /** How many staged batches each source has, for the badge on its tab. */
    stagedCounts?: Partial<Record<SourceId, number>>;
    /** Tests inject a fake GitHub provider. */
    githubProvider?: ImportProvider;
    /** The tab to open first (a deep link such as ?start=linkedin). */
    initialSource?: SourceId;
}


/** Lists the sources, takes dropped or chosen files and pasted AI answers, and stages what they hold. */
export function SourcePicker({ onAdd, helpers, initialFiles, githubProvider, initialSource, stagedCounts = {} }: SourcePickerProps) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pasted, setPasted] = useState("");
    const startedRef = useRef(false);
    const [copyState, setCopyState] = useState<"idle" | "copied" | "denied">("idle");
    const instructions = useMemo(() => buildAiInstructions(t), [t]);
    const [active, setActive] = useState<SourceId>(initialSource ?? "enginecv");
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const stagedGithub = useRef<Resume | null>(null);
    // The GitHub panel stays on its "importing" step after it hands over a CV; a new key starts it fresh.
    const [githubRun, setGithubRun] = useState(0);

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

    const moveTab = (event: ReactKeyboardEvent, index: number) => {
        const keys: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        const step = keys[event.key];
        if (event.key === "Home" || event.key === "End" || step !== undefined) {
            event.preventDefault();
            const last = IMPORT_SOURCES.length - 1;
            const next = event.key === "Home" ? 0 : event.key === "End" ? last : (index + step + IMPORT_SOURCES.length) % IMPORT_SOURCES.length;
            const source = IMPORT_SOURCES[next];
            setActive(source.id);
            tabRefs.current[source.id]?.focus();
        }
    };

    const dropZone = (accept: string) => (
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
                accept={accept}
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
            <p className="font-[family-name:var(--font-geist-mono)] text-[11px] text-faint">{accept.split(",").join("  ")}</p>
        </div>
    );

    const errorBox = error && (
        <p role="alert" data-testid="import-hub-error" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-danger-soft">
            {error}
        </p>
    );

    // On a phone the tabs scroll sideways: keep the chosen one in view.
    useEffect(() => {
        tabRefs.current[active]?.scrollIntoView?.({ inline: "nearest", block: "nearest" });
    }, [active]);

    const activeSource = IMPORT_SOURCES.find((source) => source.id === active) ?? IMPORT_SOURCES[0];

    const panel = (() => {
        switch (active) {
            case "linkedin":
                return (
                    <>
                        {dropZone(".zip,.csv")}
                        {errorBox}
                        <div data-testid="import-hub-linkedin-guide" className="space-y-2">
                            <h4 className="text-sm font-medium text-strong">{t("importHub.linkedin.howTo")}</h4>
                            <LinkedinImportGuide />
                        </div>
                    </>
                );
            case "europass":
                return (
                    <>
                        {dropZone(".pdf,.xml")}
                        {errorBox}
                        <ol className="space-y-3" data-testid="import-hub-europass-guide">
                            {([1, 2, 3] as const).map((step) => (
                                <li key={step} className="rounded-xl border border-edge bg-surface-1 p-3.5">
                                    <p className="text-sm font-medium text-strong">{step}. {t(`europassImport.guideStep${step}Title`)}</p>
                                    <p className="mt-1 text-sm leading-6 text-mid">{t(`europassImport.guideStep${step}Body`)}</p>
                                </li>
                            ))}
                        </ol>
                    </>
                );
            case "paste-ai":
                return (
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
                            rows={10}
                            className="w-full rounded-md border border-edge bg-surface-1 p-2 text-sm text-bright outline-none focus-visible:ring-1 focus-visible:ring-accent"
                        />
                        {errorBox}
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
                );
            case "github":
                return (
                    <section data-testid="import-hub-github" className="space-y-3">
                        <p className="text-sm text-mid">{t("importHub.needsNetwork")}.</p>
                        <GithubImportPanel
                            key={githubRun}
                            provider={githubProvider}
                            onCancel={() => setActive("enginecv")}
                            // Nothing is saved: the mapped CV is held as one more source.
                            persistResume={async (resume) => {
                                stagedGithub.current = resume;
                                return "staged";
                            }}
                            onDone={() => {
                                const resume = stagedGithub.current;
                                stagedGithub.current = null;
                                setGithubRun((run) => run + 1);
                                if (!resume) return;
                                onAdd([{ id: createId(), sourceId: "github", label: resume.basics.name || t("importHub.source.github"), resume }]);
                            }}
                        />
                    </section>
                );
            default:
                return (
                    <>
                        {dropZone(".json,.txt")}
                        {errorBox}
                    </>
                );
        }
    })();

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[14.5rem_minmax(0,1fr)]">
                <div
                    role="tablist"
                    aria-orientation="vertical"
                    aria-label={t("importHub.supported")}
                    className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0"
                >
                    {IMPORT_SOURCES.map((source, index) => {
                        const Icon = TAB_ICONS[source.id];
                        const selected = source.id === active;
                        const staged = stagedCounts[source.id] ?? 0;
                        return (
                            <button
                                key={source.id}
                                ref={(node) => { tabRefs.current[source.id] = node; }}
                                type="button"
                                role="tab"
                                id={`import-hub-tab-${source.id}`}
                                aria-selected={selected}
                                aria-label={t(source.labelKey)}
                                aria-controls="import-hub-panel"
                                tabIndex={selected ? 0 : -1}
                                data-testid={`import-hub-source-${source.id}`}
                                onClick={() => setActive(source.id)}
                                onKeyDown={(event) => moveTab(event, index)}
                                className={`flex shrink-0 items-start gap-3 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent md:w-full ${selected ? "border-accent bg-accent/5" : "border-transparent hover:bg-surface-4"}`}
                            >
                                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? "text-accent" : "text-faint"}`} aria-hidden="true" />
                                <span className="min-w-0 flex-1">
                                    <span className="block whitespace-nowrap text-sm font-medium text-strong md:whitespace-normal">{t(source.labelKey)}</span>
                                    {selected && <span className="hidden text-xs leading-5 text-mid md:block">{t(source.descriptionKey)}</span>}
                                </span>
                                {staged > 0 && (
                                    <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-surface-2" aria-hidden="true">
                                        {staged}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div
                    role="tabpanel"
                    id="import-hub-panel"
                    aria-labelledby={`import-hub-tab-${active}`}
                    tabIndex={0}
                    className="min-w-0 space-y-4 outline-none"
                >
                    <header>
                        <h3 className="text-lg font-semibold text-strong">{t(activeSource.labelKey)}</h3>
                        <p className="mt-1 text-sm leading-6 text-mid">{t(activeSource.descriptionKey)}</p>
                    </header>
                    {panel}
                </div>
            </div>

            <div className="space-y-1 border-t border-edge pt-3 text-[11px] leading-4 text-faint">
                <p data-testid="linkedin-trademark-disclaimer">{t("linkedinImport.trademarkDisclaimer")}</p>
                <p data-testid="europass-trademark-disclaimer">{t("europassImport.trademarkDisclaimer")}</p>
            </div>
        </div>
    );
}
