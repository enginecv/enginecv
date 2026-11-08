"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Download, Loader2, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { Resume } from "@/lib/schema";
import { toDocumentModel } from "@/lib/document-model";
import { ClipboardDeniedError, copyTextToClipboard } from "@/lib/export-clipboard";
import { getResumeExportBaseName } from "@/lib/resume-export";
import { deliverFile } from "@/lib/share";
import { toGithubReadme } from "@/lib/github-readme/markdown";
import { toReadmeCard, type ReadmeCardVariant } from "@/lib/github-readme/card";
import { buildReadmePackage, README_FILES } from "@/lib/github-readme/package";
import {
    defaultReadmeOptions,
    loadReadmeCredit,
    README_LIMITS,
    README_SECTION_TOGGLES,
    saveReadmeCredit,
    type ReadmeOptions,
} from "@/lib/github-readme/options";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";

interface GithubReadmeDialogProps {
    resume: Resume;
    /** Back to the format list. */
    onBack: () => void;
    onClose: () => void;
}

type Status = "idle" | "working" | "copied" | "downloaded";
type ErrorKind = "clipboard" | "download" | null;

const STATUS_RESET_MS = 2000;

/** Mounted only while open, so every option but the remembered credit starts at its default. */
export function GithubReadmeDialog({ resume, onBack, onClose }: GithubReadmeDialogProps) {
    const { t } = useTranslation();
    const [options, setOptions] = useState<ReadmeOptions>(() => defaultReadmeOptions(loadReadmeCredit()));
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<ErrorKind>(null);
    const [view, setView] = useState<"rendered" | "source">("rendered");
    const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose);

    const model = useMemo(() => toDocumentModel(resume), [resume]);
    const markdown = useMemo(() => toGithubReadme(model, options), [model, options]);
    const missingName = !model.basics.name;
    const busy = status === "working";

    useEffect(() => {
        if (status !== "copied" && status !== "downloaded") return;
        const timer = window.setTimeout(() => setStatus("idle"), STATUS_RESET_MS);
        return () => window.clearTimeout(timer);
    }, [status]);

    const update = (patch: Partial<ReadmeOptions>) => {
        setOptions((current) => ({ ...current, ...patch }));
        setError(null);
    };

    const toggleCredit = () => {
        const next = !options.credit;
        saveReadmeCredit(next);
        update({ credit: next });
    };

    const handleCopy = async () => {
        setError(null);
        setStatus("working");
        try {
            await copyTextToClipboard(markdown);
            setStatus("copied");
        } catch (copyError) {
            setStatus("idle");
            if (copyError instanceof ClipboardDeniedError) setView("source");
            setError(copyError instanceof ClipboardDeniedError ? "clipboard" : "download");
        }
    };

    const download = async (blob: Blob, filename: string) => {
        setError(null);
        setStatus("working");
        try {
            await deliverFile(blob, filename);
            setStatus("downloaded");
        } catch {
            setStatus("idle");
            setError("download");
        }
    };

    const handlePackage = () => {
        const zip = buildReadmePackage({
            markdown,
            cardLight: toReadmeCard(model, "light"),
            cardDark: toReadmeCard(model, "dark"),
        });
        // Copy into a fresh ArrayBuffer-backed view so Blob accepts it under strict lib types.
        const bytes = new Uint8Array(zip);
        void download(new Blob([bytes], { type: "application/zip" }), `github-readme-${getResumeExportBaseName(resume)}.zip`);
    };

    const handleCard = (variant: ReadmeCardVariant) => {
        const svg = toReadmeCard(model, variant);
        const filename = variant === "light" ? README_FILES.cardLight : README_FILES.cardDark;
        void download(new Blob([svg], { type: "image/svg+xml" }), filename);
    };

    const limitInput = (key: keyof typeof README_LIMITS, label: string) => (
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-mid">
            {label}
            <input
                type="number"
                inputMode="numeric"
                min={README_LIMITS[key].min}
                max={README_LIMITS[key].max}
                value={options[key]}
                onChange={(event) => update({ [key]: event.target.valueAsNumber } as Partial<ReadmeOptions>)}
                data-testid={`github-readme-${key}`}
                className="h-8 w-full rounded-lg border border-edge bg-surface-2 px-2 text-sm text-strong focus:border-accent focus:outline-none"
            />
        </label>
    );

    const toggleRow = (checked: boolean, onToggle: () => void, title: string, description: string, testId: string) => (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={onToggle}
            data-testid={testId}
            className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2"
        >
            <span className={`relative mt-0.5 h-4 w-7 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-edge"}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-surface-1 transition-all ${checked ? "left-3.5" : "left-0.5"}`} />
            </span>
            <span className="min-w-0">
                <span className="block text-sm text-strong">{title}</span>
                <span className="block text-xs leading-relaxed text-faint">{description}</span>
            </span>
        </button>
    );

    const secondaryButton = "flex h-8 items-center gap-1.5 rounded-lg border border-edge px-2.5 text-xs text-mid transition-colors hover:bg-surface-4 hover:text-strong disabled:cursor-not-allowed disabled:opacity-40";

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[6vh]">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onClose} />

            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="github-readme-title"
                data-testid="github-readme-dialog"
                className="relative flex h-[80vh] max-h-[calc(100vh-2rem)] min-h-[24rem] w-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-edge bg-surface-1 shadow-2xl sm:w-[48rem] sm:min-w-[32rem] sm:resize"
            >
                <div className="flex shrink-0 items-start gap-2 px-5 pt-5">
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label={t("export.title")}
                        data-testid="github-readme-back"
                        className="mt-0.5 rounded-md p-0.5 text-faint transition-colors hover:text-strong"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="min-w-0 flex-1 pr-6">
                        <h2 id="github-readme-title" className="text-base font-semibold tracking-tight text-strong">
                            {t("githubReadme.title")}
                        </h2>
                        <p className="mt-1 text-xs leading-relaxed text-mid">{t("githubReadme.subtitle")}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t("dashboard.cancel")}
                        className="absolute right-4 top-4 text-faint transition-colors hover:text-strong"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
                    <div className="min-w-0 space-y-4">
                        <fieldset>
                            <legend className="px-2 text-xs font-medium uppercase tracking-wide text-faint">{t("githubReadme.sections")}</legend>
                            <div className="mt-2 flex flex-wrap gap-1.5 px-2">
                                {README_SECTION_TOGGLES.map((key) => {
                                    const on = options.sections[key];
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => update({ sections: { ...options.sections, [key]: !on } })}
                                            data-testid={`github-readme-section-${key}`}
                                            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                                                on ? "border-accent/40 bg-accent/10 text-accent" : "border-edge text-faint hover:text-strong"
                                            }`}
                                        >
                                            {t(`githubReadme.section.${key}`)}
                                        </button>
                                    );
                                })}
                            </div>
                        </fieldset>

                        <fieldset>
                            <legend className="px-2 text-xs font-medium uppercase tracking-wide text-faint">{t("githubReadme.limits")}</legend>
                            <div className="mt-2 flex gap-2 px-2">
                                {limitInput("maxRoles", t("githubReadme.maxRoles"))}
                                {limitInput("maxProjects", t("githubReadme.maxProjects"))}
                                {limitInput("maxSkills", t("githubReadme.maxSkills"))}
                            </div>
                        </fieldset>

                        <div className="space-y-0.5">
                            {toggleRow(
                                options.skillStyle === "badges",
                                () => update({ skillStyle: options.skillStyle === "badges" ? "text" : "badges" }),
                                t("githubReadme.skillStyleBadges"),
                                t("githubReadme.skillStyleBadgesHint"),
                                "github-readme-badges",
                            )}
                            {toggleRow(
                                options.includeCard,
                                () => update({ includeCard: !options.includeCard }),
                                t("githubReadme.includeCard"),
                                t("githubReadme.includeCardHint"),
                                "github-readme-card",
                            )}
                            {toggleRow(
                                options.includeContact,
                                () => update({ includeContact: !options.includeContact }),
                                t("githubReadme.includeContact"),
                                t("githubReadme.includeContactHint"),
                                "github-readme-contact",
                            )}
                            {toggleRow(
                                options.includeFullCv,
                                () => update({ includeFullCv: !options.includeFullCv }),
                                t("githubReadme.includeFullCv"),
                                t("githubReadme.includeFullCvHint"),
                                "github-readme-full-cv",
                            )}
                            {options.includeFullCv && (
                                <label className="ml-12 flex flex-col gap-1 pb-2 pr-2 text-xs text-mid">
                                    {t("githubReadme.fullCvFile")}
                                    <input
                                        type="text"
                                        value={options.fullCvFile}
                                        onChange={(event) => update({ fullCvFile: event.target.value })}
                                        data-testid="github-readme-full-cv-file"
                                        className="h-8 rounded-lg border border-edge bg-surface-2 px-2 text-sm text-strong focus:border-accent focus:outline-none"
                                    />
                                </label>
                            )}
                            {toggleRow(
                                options.credit,
                                toggleCredit,
                                t("githubReadme.credit"),
                                t("githubReadme.creditHint"),
                                "github-readme-credit",
                            )}
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-col gap-2">
                        <div role="tablist" aria-label={t("githubReadme.preview")} className="flex gap-1">
                            {(["rendered", "source"] as const).map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={view === key}
                                    onClick={() => setView(key)}
                                    data-testid={`github-readme-view-${key}`}
                                    className={`rounded-md px-2 py-1 text-xs font-medium uppercase tracking-wide transition-colors ${
                                        view === key ? "bg-surface-3 text-strong" : "text-faint hover:text-strong"
                                    }`}
                                >
                                    {t(key === "rendered" ? "githubReadme.preview" : "githubReadme.source")}
                                </button>
                            ))}
                        </div>
                        {missingName && (
                            <p data-testid="github-readme-missing-name" className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs text-mid">
                                {t("githubReadme.missingName")}
                            </p>
                        )}
                        {view === "rendered" && (
                            <div
                                data-testid="github-readme-rendered"
                                className="min-h-0 flex-1 overflow-y-auto break-words rounded-lg border border-edge bg-surface-2 p-4 text-sm leading-relaxed text-strong [&_a]:text-info [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_img]:inline-block [&_img]:max-w-full [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                            >
                                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{markdown}</ReactMarkdown>
                            </div>
                        )}
                        {/* Stays mounted on the rendered tab: it is the manual-copy source and what tests compare against. */}
                        <textarea
                            id="github-readme-preview"
                            aria-label={t("githubReadme.source")}
                            hidden={view !== "source"}
                            readOnly
                            value={markdown}
                            onFocus={(event) => event.currentTarget.select()}
                            data-testid="github-readme-preview"
                            spellCheck={false}
                            className="min-h-64 w-full flex-1 resize-none rounded-lg border border-edge bg-surface-2 p-3 font-mono text-xs leading-relaxed text-strong focus:border-accent focus:outline-none"
                        />
                        {error && (
                            <p role="alert" data-testid="github-readme-error" className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-danger-soft">
                                {t(error === "clipboard" ? "githubReadme.copyFailed" : "githubReadme.downloadFailed")}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-edge px-5 py-3">
                    <span aria-live="polite" className="mr-auto text-xs text-accent">
                        {status === "copied" ? t("githubReadme.copied") : status === "downloaded" ? t("githubReadme.downloaded") : ""}
                    </span>
                    <button type="button" onClick={() => handleCard("light")} disabled={missingName || busy} data-testid="github-readme-card-light" className={secondaryButton}>
                        <Download className="h-3.5 w-3.5" />
                        {t("githubReadme.downloadLight")}
                    </button>
                    <button type="button" onClick={() => handleCard("dark")} disabled={missingName || busy} data-testid="github-readme-card-dark" className={secondaryButton}>
                        <Download className="h-3.5 w-3.5" />
                        {t("githubReadme.downloadDark")}
                    </button>
                    <button type="button" onClick={handlePackage} disabled={missingName || busy} data-testid="github-readme-package" className={secondaryButton}>
                        <Download className="h-3.5 w-3.5" />
                        {t("githubReadme.downloadPackage")}
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleCopy()}
                        disabled={missingName || busy}
                        data-testid="github-readme-copy"
                        className="flex h-8 items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-2.5 text-xs font-medium text-accent transition-colors hover:border-accent/50 hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status === "copied" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {t("githubReadme.copy")}
                    </button>
                </div>
            </div>
        </div>
    );
}
