"use client";

import { FileText, Mail, Plus } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { ACTIVE_STAGES, TERMINAL_STAGES, type ApplicationStage, type JobApplication } from "@/lib/jobs/schema";
import { StageDot, StageMenu, useStageLabel } from "./shared";

export interface ViewProps {
    groups: Record<ApplicationStage, JobApplication[]>;
    onOpen: (id: string) => void;
    onMove: (application: JobApplication, stage: ApplicationStage) => void;
}

/** What a card says about where and how, if anything was entered. */
export function useWhereLine() {
    const { t } = useTranslation();
    return (application: JobApplication) => [application.location, application.workMode !== "unspecified" ? t(`jobs.workMode.${application.workMode}`) : null].filter(Boolean).join(" · ");
}

/** Working-document indicators. These are links being worked on, never a claim about what was sent. */
export function WorkingDocuments({ application }: { application: JobApplication }) {
    const { t } = useTranslation();
    if (!application.workingCvId && !application.workingLetterId) return null;
    return (
        <span className="flex items-center gap-1.5 text-faint">
            {application.workingCvId && <span title={t("jobs.workingCv")}><FileText className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">{t("jobs.workingCv")}</span></span>}
            {application.workingLetterId && <span title={t("jobs.workingLetter")}><Mail className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">{t("jobs.workingLetter")}</span></span>}
        </span>
    );
}

function Card({ application, onOpen, onMove }: { application: JobApplication } & Pick<ViewProps, "onOpen" | "onMove">) {
    const where = useWhereLine();
    const line = where(application);
    return (
        <li className="rounded-xl border border-edge bg-surface-3 p-3 transition-colors hover:border-faint" data-testid="job-card">
            <button type="button" onClick={() => onOpen(application.id)} className="block w-full text-left" data-testid={`job-card-open-${application.id}`}>
                <span className="block break-words text-sm font-semibold text-strong">{application.role}</span>
                <span className="block break-words text-sm text-mid">{application.company}</span>
                {line && <span className="mt-1 block text-xs text-faint">{line}</span>}
            </button>
            <div className="mt-2 flex items-center justify-between gap-2">
                <StageMenu application={application} compact onChange={(stage) => onMove(application, stage)} testId={`job-card-stage-${application.id}`} />
                <WorkingDocuments application={application} />
            </div>
        </li>
    );
}

/**
 * Five active columns; the three closed stages join only when asked. Columns scroll sideways on narrow
 * screens. Cards keep the order of the chosen sort; there is no hidden manual order.
 */
export function JobBoard({ groups, onOpen, onMove, showClosed, onToggleClosed, onAdd }: ViewProps & {
    showClosed: boolean;
    onToggleClosed: () => void;
    onAdd: (stage: ApplicationStage) => void;
}) {
    const { t } = useTranslation();
    const stageLabel = useStageLabel();
    const stages: readonly ApplicationStage[] = showClosed ? [...ACTIVE_STAGES, ...TERMINAL_STAGES] : ACTIVE_STAGES;
    const closedSummary = TERMINAL_STAGES.map((stage) => `${stageLabel(stage)} ${groups[stage].length}`).join(" · ");
    return (
        <div data-testid="job-board">
            <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                <div className="flex gap-4">
                    {stages.map((stage) => (
                        <section key={stage} aria-labelledby={`job-column-${stage}`} className="flex w-72 shrink-0 flex-col rounded-2xl border border-edge bg-surface-1 p-3" data-testid={`job-column-${stage}`}>
                            <h3 id={`job-column-${stage}`} className="flex items-center gap-2 px-1 text-sm font-semibold text-strong">
                                <StageDot stage={stage} />
                                {stageLabel(stage)}
                                <span className="ml-auto tabular-nums text-faint" aria-label={t("jobs.columnCount", { count: groups[stage].length })}>{groups[stage].length}</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => onAdd(stage)}
                                aria-label={t("jobs.addToStage", { stage: stageLabel(stage) })}
                                className="mt-2 flex items-center gap-1.5 rounded-lg px-1 py-1.5 text-xs font-medium text-mid hover:text-strong"
                                data-testid={`job-column-add-${stage}`}
                            >
                                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                {t("jobs.add.button")}
                            </button>
                            <ul className="mt-2 space-y-2">
                                {groups[stage].map((application) => <Card key={application.id} application={application} onOpen={onOpen} onMove={onMove} />)}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mid">
                <span>{t("jobs.closedSummary", { summary: closedSummary })}</span>
                <button type="button" onClick={onToggleClosed} aria-pressed={showClosed} className="font-medium text-accent hover:underline" data-testid="job-board-toggle-closed">
                    {showClosed ? t("jobs.hideClosed") : t("jobs.showClosed")}
                </button>
            </p>
        </div>
    );
}
