"use client";

import { CalendarDays, CalendarPlus } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { dateOnlyFormatter } from "@/lib/jobs/dates";
import { completeTask } from "@/lib/jobs/operations";
import type { JobApplication } from "@/lib/jobs/schema";
import { nextActionGroups, type InterviewEntry, type TaskEntry } from "@/lib/jobs/selectors";
import { downloadCalendar } from "./calendar-download";
import { BUTTON_CLASS, applicationTitle, runCommand, useCommandError } from "./shared";
import { useNow, useToday } from "./useToday";

/**
 * Overdue, today's and upcoming tasks, and scheduled interviews, across current applications. Reminders
 * show here when EngineCV is open; nothing is emailed or pushed. An interview stays until its outcome is
 * recorded, even after its time has passed.
 */
export function NextActions({ applications, onOpen, onAnnounce }: { applications: readonly JobApplication[]; onOpen: (id: string) => void; onAnnounce: (message: string) => void }) {
    const { t, locale } = useTranslation();
    const today = useToday();
    const commandError = useCommandError();
    const formatDay = useMemo(() => dateOnlyFormatter(locale), [locale]);
    const groups = useMemo(() => nextActionGroups(applications, today), [applications, today]);
    const empty = groups.overdue.length + groups.today.length + groups.upcoming.length + groups.interviews.length === 0;
    const now = useNow();
    const calendar = groups.interviews.filter(({ interview }) => interview.startsAt !== null && interview.startsAt >= now);

    const complete = async ({ application, task }: TaskEntry) => {
        const outcome = await runCommand(application, (current, ctx) => completeTask(current, task.id, ctx));
        onAnnounce(outcome.ok ? t("jobs.announce.taskDone") : commandError(outcome.reason));
    };

    const taskList = (key: "overdue" | "today" | "upcoming", entries: TaskEntry[]) => entries.length > 0 && (
        <section aria-labelledby={`actions-${key}`} data-testid={`actions-${key}`}>
            <h3 id={`actions-${key}`} className={`text-sm font-semibold ${key === "overdue" ? "text-danger" : "text-strong"}`}>{t(`jobs.actions.${key}`)} <span className="font-normal text-faint">{entries.length}</span></h3>
            <ul className="mt-2 space-y-2">
                {entries.map((entry) => (
                    <li key={entry.task.id} className="flex items-start gap-3 rounded-xl border border-edge bg-surface-3 p-3" data-testid="action-task">
                        <button type="button" onClick={() => void complete(entry)} aria-label={t("jobs.task.complete", { task: entry.task.title })} className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-faint hover:border-accent" data-testid="action-task-complete" />
                        <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-medium text-strong">{entry.task.title}</p>
                            <button type="button" onClick={() => onOpen(entry.application.id)} className="break-words text-left text-xs text-mid hover:text-strong hover:underline">{applicationTitle(entry.application)}</button>
                        </div>
                        <span className="shrink-0 text-xs text-faint">{entry.task.dueOn ? formatDay(entry.task.dueOn) : t("jobs.task.noDate")}</span>
                    </li>
                ))}
            </ul>
        </section>
    );

    const interviewItem = ({ application, interview }: InterviewEntry) => {
        const when = interview.startsAt === null
            ? t("jobs.interview.unscheduled")
            : new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: interview.timeZone, timeZoneName: "short" }).format(interview.startsAt);
        const passed = interview.startsAt !== null && interview.startsAt < now;
        return (
            <li key={interview.id} className="flex items-start gap-3 rounded-xl border border-edge bg-surface-3 p-3" data-testid="action-interview">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-faint" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-strong">{interview.label}</p>
                    <button type="button" onClick={() => onOpen(application.id)} className="break-words text-left text-xs text-mid hover:text-strong hover:underline">{applicationTitle(application)}</button>
                    {passed && <p className="text-xs text-warning">{t("jobs.actions.recordOutcome")}</p>}
                </div>
                <span className="shrink-0 text-right text-xs text-faint">{when}</span>
            </li>
        );
    };

    return (
        <div className="space-y-6" data-testid="next-actions">
            <p className="text-sm text-mid">{t("jobs.task.reminderNote")}</p>
            {empty ? (
                <p className="rounded-xl border border-edge bg-surface-1 p-6 text-center text-sm text-mid" data-testid="actions-empty">{t("jobs.actions.empty")}</p>
            ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-6">
                        {taskList("overdue", groups.overdue)}
                        {taskList("today", groups.today)}
                        {taskList("upcoming", groups.upcoming)}
                    </div>
                    {groups.interviews.length > 0 && (
                        <section aria-labelledby="actions-interviews" data-testid="actions-interviews">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 id="actions-interviews" className="text-sm font-semibold text-strong">{t("jobs.actions.interviews")} <span className="font-normal text-faint">{groups.interviews.length}</span></h3>
                                {calendar.length > 0 && (
                                    <button type="button" className={BUTTON_CLASS} onClick={() => void downloadCalendar(calendar, null)} data-testid="actions-calendar">
                                        <CalendarPlus className="h-4 w-4" aria-hidden="true" />{t("jobs.interview.calendarAll")}
                                    </button>
                                )}
                            </div>
                            <ul className="mt-2 space-y-2">{groups.interviews.map(interviewItem)}</ul>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
