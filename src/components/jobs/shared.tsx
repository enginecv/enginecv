"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from "@/lib/i18n";
import { defaultContext, type OperationContext } from "@/lib/jobs/operations";
import { StaleApplicationError, updateApplication } from "@/lib/jobs/repository";
import { APPLICATION_STAGES, isTerminalStage, type ApplicationStage, type JobApplication } from "@/lib/jobs/schema";

export const FIELD_CLASS = "h-10 w-full rounded-xl border border-edge bg-surface-4 px-3 text-sm text-strong placeholder:text-faint focus:border-faint focus:outline-none";
export const TEXTAREA_CLASS = "min-h-28 w-full rounded-xl border border-edge bg-surface-4 px-3 py-2 text-sm text-strong placeholder:text-faint focus:border-faint focus:outline-none";
export const LABEL_CLASS = "mb-1 block text-xs font-semibold text-mid";
export const BUTTON_CLASS = "flex h-10 items-center justify-center gap-2 rounded-xl border border-edge bg-surface-4 px-3 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong disabled:opacity-60";
export const PRIMARY_BUTTON_CLASS = "flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-surface-2 transition-colors hover:bg-accent-soft disabled:opacity-60";

/** Stage colours are a hint only; every stage is also named in text. */
export const STAGE_DOT_CLASS: Record<ApplicationStage, string> = {
    saved: "bg-faint",
    preparing: "bg-info-violet",
    applied: "bg-info",
    interviewing: "bg-warning",
    offer: "bg-success",
    accepted: "bg-success",
    rejected: "bg-danger",
    withdrawn: "bg-dim",
};

export function StageDot({ stage }: { stage: ApplicationStage }) {
    return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${STAGE_DOT_CLASS[stage]}`} aria-hidden="true" />;
}

export function useStageLabel() {
    const { t } = useTranslation();
    return useCallback((stage: ApplicationStage) => t(`jobs.stage.${stage}`), [t]);
}

/** Display name of an application, as one line. */
export function applicationTitle(application: Pick<JobApplication, "role" | "company">): string {
    return `${application.role} · ${application.company}`;
}

/**
 * Changes a stage by menu: works with mouse, keyboard and touch alike. Drag and drop is never the only way.
 */
export function StageMenu({ application, onChange, compact = false, testId }: {
    application: JobApplication;
    onChange: (stage: ApplicationStage) => void;
    compact?: boolean;
    testId: string;
}) {
    const { t } = useTranslation();
    const stageLabel = useStageLabel();
    const [open, setOpen] = useState(false);
    const current = stageLabel(application.stage);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={t("jobs.stageMenu", { role: application.role, company: application.company, stage: current })}
                    data-testid={testId}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg border border-edge bg-surface-4 text-xs font-medium text-bright transition-colors hover:border-faint hover:text-strong ${compact ? "h-8 px-2" : "h-10 px-3"}`}
                >
                    <StageDot stage={application.stage} />
                    <span>{current}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-52 p-1.5">
                <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-faint">{t("jobs.moveTo")}</p>
                {APPLICATION_STAGES.map((stage) => {
                    const active = stage === application.stage;
                    return (
                        <button
                            key={stage}
                            type="button"
                            aria-pressed={active}
                            data-testid={`${testId}-${stage}`}
                            onClick={() => {
                                setOpen(false);
                                if (!active) onChange(stage);
                            }}
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${active ? "bg-surface-4 text-strong" : "text-mid hover:bg-surface-4/70 hover:text-strong"}`}
                        >
                            {active ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" /> : <StageDot stage={stage} />}
                            <span>{stageLabel(stage)}</span>
                            {isTerminalStage(stage) && <span className="ml-auto text-[10px] uppercase tracking-wider text-faint">{t("jobs.closed")}</span>}
                        </button>
                    );
                })}
            </PopoverContent>
        </Popover>
    );
}

export type CommandResult = { ok: true; application: JobApplication } | { ok: false; reason: "stale" | "failed" };

/**
 * Runs one operation against the record the person is looking at. A record changed elsewhere since it was
 * shown is refused (never overwritten); the caller explains and the live query already shows the latest.
 */
export async function runCommand(
    application: JobApplication,
    operation: (current: JobApplication, ctx: OperationContext) => JobApplication,
): Promise<CommandResult> {
    try {
        const ctx = defaultContext();
        const saved = await updateApplication(application.id, application.revision, (current) => operation(current, ctx), ctx.now);
        return { ok: true, application: saved };
    } catch (error) {
        if (error instanceof StaleApplicationError) return { ok: false, reason: "stale" };
        console.error("[EngineCV] Could not save the application.", error);
        return { ok: false, reason: "failed" };
    }
}

/** The message for a failed command, for the tab's status region. */
export function useCommandError() {
    const { t } = useTranslation();
    return useCallback((reason: "stale" | "failed") => (reason === "stale" ? t("jobs.error.stale") : t("jobs.error.save")), [t]);
}
