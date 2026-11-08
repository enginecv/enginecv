"use client";

import { ArrowDownToLine, Eye, FileJson2, HardDrive, PencilLine } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const EXPORT_FORMATS = ["PDF", "HTML", "PNG", "SVG", "JSON"];
const SAMPLE_PROFILE = {
    name: "Alex Carter",
    headline: "Senior Product Designer",
    summary: "Accessible products and scalable design systems.",
};

export function ProductStory() {
    const { t } = useTranslation();

    const steps = [
        {
            number: "01",
            title: t("landing.howItWorks.step1Title"),
            description: t("landing.howItWorks.step1Desc"),
            visual: <LocalVisual />,
        },
        {
            number: "02",
            title: t("landing.howItWorks.step2Title"),
            description: t("landing.howItWorks.step2Desc"),
            visual: <PreviewVisual />,
        },
        {
            number: "03",
            title: t("landing.howItWorks.step3Title"),
            description: t("landing.howItWorks.step3Desc"),
            visual: <ExportVisual />,
        },
    ];

    return (
        <section id="features" className="border-b border-edge px-6 py-24 sm:py-32">
            <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)] lg:gap-20">
                <div className="lg:sticky lg:top-28 lg:self-start">
                    <p className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-accent">
                        01—03 / {t("howItWorks.title")}
                    </p>
                    <h2 className="mt-5 max-w-lg text-4xl font-black leading-[0.98] tracking-[-0.045em] text-strong sm:text-5xl lg:text-6xl">
                        {t("landing.story.title")}
                    </h2>
                    <p className="mt-6 max-w-md text-lg leading-8 text-mid">
                        {t("landing.howItWorks.subtitle")}
                    </p>
                </div>

                <div>
                    {steps.map((step) => (
                        <article
                            key={step.number}
                            className="grid gap-7 border-t border-edge py-10 first:pt-0 sm:grid-cols-[minmax(0,0.8fr)_minmax(260px,1.2fr)] sm:items-center sm:gap-10"
                        >
                            <div>
                                <span className="font-[family-name:var(--font-geist-mono)] text-xs text-accent">
                                    {step.number}
                                </span>
                                <h3 className="mt-3 text-2xl font-bold tracking-tight text-strong sm:text-3xl">
                                    {step.title}
                                </h3>
                                <p className="mt-4 leading-7 text-mid">
                                    {step.description}
                                </p>
                            </div>
                            {step.visual}
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}

function LocalVisual() {
    const { t } = useTranslation();

    return (
        <div className="relative overflow-hidden rounded-xl border border-edge bg-surface-0 p-5">
            <div className="flex items-center justify-between border-b border-edge pb-4">
                <span className="flex items-center gap-2 text-sm font-medium text-strong">
                    <HardDrive className="h-4 w-4 text-accent" aria-hidden="true" />
                    EngineCVDatabase
                </span>
                <span className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-success">
                    {t("landing.workbench.localStatus")}
                </span>
            </div>
            <div className="space-y-3 pt-4 font-[family-name:var(--font-geist-mono)] text-xs">
                <div className="flex items-center justify-between text-mid">
                    <span>resume.json</span>
                    <span className="text-faint">24.8 KB</span>
                </div>
                <div className="flex items-center justify-between text-mid">
                    <span>history/07</span>
                    <span className="text-faint">{t("landing.workbench.localStatus")}</span>
                </div>
            </div>
            <div className="pointer-events-none absolute -bottom-12 -right-8 h-28 w-28 rounded-full bg-accent/15 blur-2xl" />
        </div>
    );
}

function PreviewVisual() {
    const { t } = useTranslation();

    return (
        <div
            className="grid grid-cols-1 overflow-hidden rounded-xl border border-edge bg-surface-0 sm:grid-cols-[0.75fr_1.25fr]"
            data-testid="landing-story-editor-visual"
        >
            <div className="min-w-0 space-y-3 border-b border-edge p-4 sm:border-b-0 sm:border-r">
                <span className="flex items-center gap-2 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-faint">
                    <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("landing.workbench.contentTab")}
                </span>
                <SampleField
                    label={t("landing.workbench.nameLabel")}
                    testId="landing-story-sample-name"
                    value={SAMPLE_PROFILE.name}
                />
                <SampleField
                    active
                    label={t("landing.workbench.headlineLabel")}
                    testId="landing-story-sample-headline"
                    value={SAMPLE_PROFILE.headline}
                />
                <SampleField
                    label={t("preview.summary")}
                    multiline
                    testId="landing-story-sample-summary"
                    value={SAMPLE_PROFILE.summary}
                />
            </div>
            <div
                className="relative flex min-w-0 items-center justify-center bg-surface-2 p-4 sm:p-5"
                data-testid="landing-story-preview-pane"
            >
                <div
                    className="aspect-[0.707] w-24 bg-white p-3 shadow-xl sm:w-32 sm:p-4 lg:w-40 lg:p-5"
                    data-testid="landing-story-preview-document"
                >
                    <div className="truncate text-[6px] font-bold leading-none text-slate-900 sm:text-[7px] lg:text-[9px]">
                        {SAMPLE_PROFILE.name}
                    </div>
                    <div className="mt-1.5 truncate text-[4px] leading-none text-slate-500 sm:mt-2 sm:text-[4.5px] lg:text-[5.5px]">
                        {SAMPLE_PROFILE.headline}
                    </div>
                    <div className="mt-5 h-px w-full bg-[#ff8a66] sm:mt-6 lg:mt-8" />
                    <div className="mt-2 sm:mt-2.5 lg:mt-3">
                        <div className="text-[4px] font-bold uppercase tracking-wide text-slate-700 sm:text-[5px] lg:text-[6px]">
                            {t("preview.summary")}
                        </div>
                        <p className="mt-1 text-[3.5px] leading-[1.35] text-slate-500 sm:text-[4px] lg:text-[5px]">
                            {SAMPLE_PROFILE.summary}
                        </p>
                    </div>
                </div>
                <Eye className="absolute bottom-3 right-3 h-4 w-4 text-faint" aria-hidden="true" />
            </div>
        </div>
    );
}

function SampleField({
    active = false,
    label,
    multiline = false,
    testId,
    value,
}: {
    active?: boolean;
    label: string;
    multiline?: boolean;
    testId: string;
    value: string;
}) {
    return (
        <div
            className={`rounded-md border bg-surface-2 px-2.5 py-2 ${
                active
                    ? "border-accent/50 shadow-[0_0_0_2px_rgba(255,138,102,0.08)]"
                    : "border-edge"
            }`}
            data-testid={testId}
        >
            <span className="block font-[family-name:var(--font-geist-mono)] text-[8px] uppercase tracking-wider text-faint">
                {label}
            </span>
            <span className={`mt-1 block text-[10px] leading-4 text-bright ${multiline ? "line-clamp-2" : "truncate"}`}>
                {value}
            </span>
        </div>
    );
}

function ExportVisual() {
    return (
        <div className="rounded-xl border border-edge bg-surface-0 p-5">
            <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-sm font-medium text-strong">
                    <ArrowDownToLine className="h-4 w-4 text-accent" aria-hidden="true" />
                    alex-carter-resume
                </span>
                <FileJson2 className="h-4 w-4 text-faint" aria-hidden="true" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
                {EXPORT_FORMATS.map((format) => (
                    <span
                        key={format}
                        className="border border-edge bg-surface-2 px-3 py-2 font-[family-name:var(--font-geist-mono)] text-[11px] text-mid"
                    >
                        .{format.toLowerCase()}
                    </span>
                ))}
            </div>
        </div>
    );
}
