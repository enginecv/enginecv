"use client";

import {
    DndContext,
    DragOverlay,
    MouseSensor,
    TouchSensor,
    pointerWithin,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import { FileText, GripVertical, Mail, Plus, Send } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { ACTIVE_STAGES, TERMINAL_STAGES, type ApplicationStage, type JobApplication } from "@/lib/jobs/schema";
import { StageDot, StageMenu, useStageLabel } from "./shared";
import { useToday } from "./useToday";
import { dateOnlyFormatter } from "@/lib/jobs/dates";
import { nextAction } from "@/lib/jobs/selectors";

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
    const sent = application.submissions.length > 0;
    if (!application.workingCvId && !application.workingLetterId && !sent) return null;
    return (
        <span className="flex items-center gap-1.5 text-faint">
            {application.workingCvId && <span title={t("jobs.workingCv")}><FileText className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">{t("jobs.workingCv")}</span></span>}
            {application.workingLetterId && <span title={t("jobs.workingLetter")}><Mail className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">{t("jobs.workingLetter")}</span></span>}
            {sent && <span title={t("jobs.recordedCount", { count: application.submissions.length })} className="text-success"><Send className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">{t("jobs.recordedCount", { count: application.submissions.length })}</span></span>}
        </span>
    );
}

function CardBody({ application }: { application: JobApplication }) {
    const where = useWhereLine();
    const line = where(application);
    const next = useNextActionLine(application);
    return (
        <>
            <span className="block break-words text-sm font-semibold text-strong">{application.role}</span>
            <span className="block break-words text-sm text-mid">{application.company}</span>
            {line && <span className="mt-1 block text-xs text-faint">{line}</span>}
            {next && <span className={`mt-1 block break-words text-xs ${next.className}`} data-testid="job-card-next">{next.text}</span>}
        </>
    );
}

/** "Next: …" for a card or row: the earliest open task or scheduled interview. */
export function useNextActionLine(application: JobApplication): { text: string; className: string } | null {
    const { t, locale } = useTranslation();
    const today = useToday();
    const action = nextAction(application, today);
    if (!action) return null;
    if (action.kind === "interview") {
        const when = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: action.interview.timeZone }).format(action.interview.startsAt!);
        return { text: t("jobs.next.interview", { label: action.interview.label, when }), className: "text-info" };
    }
    const due = action.task.dueOn ? dateOnlyFormatter(locale)(action.task.dueOn) : null;
    const text = due ? t("jobs.next.taskDue", { task: action.task.title, date: due }) : t("jobs.next.task", { task: action.task.title });
    return { text, className: action.due === "overdue" ? "text-danger" : action.due === "today" ? "text-warning" : "text-mid" };
}

/**
 * A card can be dragged by mouse or (after a short press) by touch to another column. Keyboard and
 * assistive-technology users move it with the stage menu, which does exactly the same thing.
 */
function Card({ application, onOpen, onMove }: { application: JobApplication } & Pick<ViewProps, "onOpen" | "onMove">) {
    const { setNodeRef, listeners, isDragging } = useDraggable({ id: application.id, data: { application } });
    return (
        <li
            ref={setNodeRef}
            {...listeners}
            className={`group rounded-xl border border-edge bg-surface-3 p-3 transition-colors hover:border-faint ${isDragging ? "opacity-40" : ""} touch-manipulation`}
            data-testid="job-card"
        >
            <div className="flex items-start gap-1">
                <button type="button" onClick={() => onOpen(application.id)} className="block min-w-0 flex-1 text-left" data-testid={`job-card-open-${application.id}`}>
                    <CardBody application={application} />
                </button>
                <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-faint opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
                <StageMenu application={application} compact onChange={(stage) => onMove(application, stage)} testId={`job-card-stage-${application.id}`} />
                <WorkingDocuments application={application} />
            </div>
        </li>
    );
}

function Column({ stage, applications, onOpen, onMove, onAdd }: { stage: ApplicationStage; applications: JobApplication[]; onAdd: (stage: ApplicationStage) => void } & Pick<ViewProps, "onOpen" | "onMove">) {
    const { t } = useTranslation();
    const stageLabel = useStageLabel();
    const { setNodeRef, isOver, active } = useDroppable({ id: stage });
    const fromHere = (active?.data.current?.application as JobApplication | undefined)?.stage === stage;
    const highlight = isOver && !fromHere;
    return (
        <section
            ref={setNodeRef}
            aria-labelledby={`job-column-${stage}`}
            className={`flex min-w-0 flex-col rounded-2xl border p-3 transition-colors ${highlight ? "border-accent bg-surface-3" : "border-edge bg-surface-1"}`}
            data-testid={`job-column-${stage}`}
        >
            <h3 id={`job-column-${stage}`} className="flex items-center gap-2 px-1 text-sm font-semibold text-strong">
                <StageDot stage={stage} />
                <span className="min-w-0 break-words">{stageLabel(stage)}</span>
                <span className="ml-auto tabular-nums text-faint" aria-label={t("jobs.columnCount", { count: applications.length })}>{applications.length}</span>
            </h3>
            <ul className="mt-2 min-h-12 space-y-2">
                {applications.map((application) => <Card key={application.id} application={application} onOpen={onOpen} onMove={onMove} />)}
            </ul>
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
        </section>
    );
}

/**
 * Five active columns that wrap to the available width, so nothing scrolls sideways; the three closed
 * stages join as their own row when asked. Cards keep the order of the chosen sort: dragging changes the
 * stage only, never a hidden manual order.
 */
export function JobBoard({ groups, onOpen, onMove, showClosed, onToggleClosed, onAdd }: ViewProps & {
    showClosed: boolean;
    onToggleClosed: () => void;
    onAdd: (stage: ApplicationStage) => void;
}) {
    const { t } = useTranslation();
    const stageLabel = useStageLabel();
    const [dragging, setDragging] = useState<JobApplication | null>(null);
    // A short travel for the mouse keeps clicks working; touch waits for a press so the page still scrolls.
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    );
    const closedSummary = TERMINAL_STAGES.map((stage) => `${stageLabel(stage)} ${groups[stage].length}`).join(" · ");

    const handleStart = (event: DragStartEvent) => setDragging((event.active.data.current?.application as JobApplication | undefined) ?? null);
    const handleEnd = (event: DragEndEvent) => {
        setDragging(null);
        const application = event.active.data.current?.application as JobApplication | undefined;
        const target = event.over?.id as ApplicationStage | undefined;
        if (application && target && target !== application.stage) onMove(application, target);
    };

    const column = (stage: ApplicationStage) => <Column key={stage} stage={stage} applications={groups[stage]} onOpen={onOpen} onMove={onMove} onAdd={onAdd} />;

    return (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleStart} onDragEnd={handleEnd} onDragCancel={() => setDragging(null)}>
            <div data-testid="job-board" className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {ACTIVE_STAGES.map(column)}
                </div>
                {showClosed && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="job-board-closed">
                        {TERMINAL_STAGES.map(column)}
                    </div>
                )}
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mid">
                    <span>{t("jobs.closedSummary", { summary: closedSummary })}</span>
                    <button type="button" onClick={onToggleClosed} aria-pressed={showClosed} className="font-medium text-accent hover:underline" data-testid="job-board-toggle-closed">
                        {showClosed ? t("jobs.hideClosed") : t("jobs.showClosed")}
                    </button>
                </p>
            </div>
            <DragOverlay dropAnimation={null}>
                {dragging && (
                    <div className="w-56 cursor-grabbing rounded-xl border border-accent bg-surface-3 p-3 shadow-2xl">
                        <CardBody application={dragging} />
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
}
