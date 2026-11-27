"use client";

import { CalendarDays, CalendarPlus, Check, Pencil, Plus, RotateCcw, Trash2, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { dateOnlyFormatter } from "@/lib/jobs/dates";
import {
    addContact, addInterview, addTask, cancelTask, completeTask, isOpenTask, removeContact, removeInterview, removeTask, reopenTask, updateContact, updateInterview,
    type ContactInput,
} from "@/lib/jobs/operations";
import { exportableInterviews } from "@/lib/jobs/calendar";
import type { ApplicationContact, ApplicationInterview, ApplicationTask, JobApplication } from "@/lib/jobs/schema";
import { dueState } from "@/lib/jobs/selectors";
import { downloadCalendar } from "./calendar-download";
import { InterviewDialog } from "./InterviewDialog";
import { BUTTON_CLASS, FIELD_CLASS, LABEL_CLASS, runCommand, useCommandError } from "./shared";
import { useToday } from "./useToday";

const ICON_BUTTON = "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint hover:bg-surface-4 hover:text-strong";
const DUE_CLASS = { overdue: "text-danger", today: "text-warning", upcoming: "text-mid", undated: "text-faint" } as const;

type Run = (operation: Parameters<typeof runCommand>[1], message?: string) => Promise<boolean>;

function Section({ title, action, children, testId }: { title: string; action?: React.ReactNode; children: React.ReactNode; testId: string }) {
    return (
        <section className="rounded-xl border border-edge bg-surface-2 p-3" data-testid={testId}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-strong">{title}</h3>
                <div className="flex flex-wrap gap-2">{action}</div>
            </div>
            <div className="mt-2">{children}</div>
        </section>
    );
}

function TaskRow({ task, run }: { task: ApplicationTask; run: Run }) {
    const { t, locale } = useTranslation();
    const today = useToday();
    const formatDay = useMemo(() => dateOnlyFormatter(locale), [locale]);
    const open = isOpenTask(task);
    const due = dueState(task.dueOn, today);
    return (
        <li className="flex items-start gap-2 py-1.5" data-testid="task">
            {open ? (
                <button type="button" className={ICON_BUTTON} onClick={() => void run((current, ctx) => completeTask(current, task.id, ctx), t("jobs.announce.taskDone"))} aria-label={t("jobs.task.complete", { task: task.title })} data-testid="task-complete">
                    <span className="h-4 w-4 rounded-full border-2 border-faint" aria-hidden="true" />
                </button>
            ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center text-success" aria-hidden="true">{task.completedAt ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}</span>
            )}
            <div className="min-w-0 flex-1 pt-1.5">
                <p className={`break-words text-sm ${open ? "text-strong" : "text-faint line-through"}`}>{task.title}</p>
                <p className={`text-xs ${open ? DUE_CLASS[due] : "text-faint"}`}>
                    {!open ? t(task.completedAt ? "jobs.task.done" : "jobs.task.cancelled") : task.dueOn ? t(`jobs.task.due.${due}`, { date: formatDay(task.dueOn) }) : t("jobs.task.noDate")}
                </p>
            </div>
            {open ? (
                <button type="button" className={ICON_BUTTON} onClick={() => void run((current, ctx) => cancelTask(current, task.id, ctx))} aria-label={t("jobs.task.cancel", { task: task.title })} data-testid="task-cancel"><X className="h-4 w-4" aria-hidden="true" /></button>
            ) : (
                <button type="button" className={ICON_BUTTON} onClick={() => void run((current) => reopenTask(current, task.id))} aria-label={t("jobs.task.reopen", { task: task.title })}><RotateCcw className="h-4 w-4" aria-hidden="true" /></button>
            )}
            <button type="button" className={ICON_BUTTON} onClick={() => void run((current) => removeTask(current, task.id))} aria-label={t("jobs.task.remove", { task: task.title })}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
        </li>
    );
}

function TaskForm({ run }: { run: Run }) {
    const { t } = useTranslation();
    const [title, setTitle] = useState("");
    const [dueOn, setDueOn] = useState("");
    return (
        <form
            className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={async (event) => {
                event.preventDefault();
                if (!title.trim()) return;
                if (await run((current, ctx) => addTask(current, { title, dueOn: dueOn || null }, ctx))) {
                    setTitle("");
                    setDueOn("");
                }
            }}
        >
            <div className="min-w-0 flex-1">
                <label htmlFor="task-title" className={LABEL_CLASS}>{t("jobs.task.new")}</label>
                <input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("jobs.task.newHint")} className={FIELD_CLASS} data-testid="task-title" />
            </div>
            <div>
                <label htmlFor="task-due" className={LABEL_CLASS}>{t("jobs.task.dueOn")}</label>
                <input id="task-due" type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} className={FIELD_CLASS} data-testid="task-due" />
            </div>
            <button type="submit" disabled={!title.trim()} className={BUTTON_CLASS} data-testid="task-add"><Plus className="h-4 w-4" aria-hidden="true" />{t("jobs.task.add")}</button>
        </form>
    );
}

function InterviewRow({ application, interview, onEdit, run }: { application: JobApplication; interview: ApplicationInterview; onEdit: () => void; run: Run }) {
    const { t, locale } = useTranslation();
    const when = interview.startsAt === null
        ? t("jobs.interview.unscheduled")
        : new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: interview.timeZone, timeZoneName: "short" }).format(interview.startsAt);
    const names = interview.contactIds.map((id) => application.contacts.find((contact) => contact.id === id)?.name).filter(Boolean).join(", ");
    return (
        <li className="flex items-start gap-2 py-1.5" data-testid="interview">
            <CalendarDays className="mt-2 h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
            <div className="min-w-0 flex-1 pt-1">
                <p className="break-words text-sm font-medium text-strong">{interview.label} <span className="font-normal text-faint">· {t(`jobs.interview.outcomeValue.${interview.outcome}`)}</span></p>
                <p className="break-words text-xs text-mid">{[when, interview.location, names].filter(Boolean).join(" · ")}</p>
            </div>
            <button type="button" className={ICON_BUTTON} onClick={onEdit} aria-label={t("jobs.interview.editNamed", { label: interview.label })} data-testid="interview-edit"><Pencil className="h-4 w-4" aria-hidden="true" /></button>
            <button type="button" className={ICON_BUTTON} onClick={() => void run((current) => removeInterview(current, interview.id))} aria-label={t("jobs.interview.remove", { label: interview.label })}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
        </li>
    );
}

const EMPTY_CONTACT: ContactInput = { name: "", role: null, email: null, phone: null, notes: null };

function ContactForm({ initial, onSave, onCancel }: { initial: ContactInput; onSave: (input: ContactInput) => void; onCancel: () => void }) {
    const { t } = useTranslation();
    const [form, setForm] = useState({ name: initial.name, role: initial.role ?? "", email: initial.email ?? "", phone: initial.phone ?? "" });
    const field = (key: keyof typeof form, label: string, type = "text") => (
        <div>
            <label htmlFor={`contact-${key}`} className={LABEL_CLASS}>{label}</label>
            <input id={`contact-${key}`} type={type} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className={FIELD_CLASS} data-testid={`contact-${key}`} />
        </div>
    );
    return (
        <form
            className="mt-2 grid gap-2 sm:grid-cols-2"
            onSubmit={(event) => {
                event.preventDefault();
                if (!form.name.trim()) return;
                onSave({ name: form.name, role: form.role.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null, notes: initial.notes });
            }}
        >
            {field("name", t("jobs.contact.name"))}
            {field("role", t("jobs.contact.role"))}
            {field("email", t("jobs.contact.email"), "email")}
            {field("phone", t("jobs.contact.phone"), "tel")}
            <div className="flex gap-2 sm:col-span-2">
                <button type="submit" disabled={!form.name.trim()} className={BUTTON_CLASS} data-testid="contact-save">{t("jobs.contact.save")}</button>
                <button type="button" onClick={onCancel} className={BUTTON_CLASS}>{t("dashboard.cancel")}</button>
            </div>
        </form>
    );
}

function ContactRow({ contact, onEdit, run }: { contact: ApplicationContact; onEdit: () => void; run: Run }) {
    const { t } = useTranslation();
    return (
        <li className="flex items-start gap-2 py-1.5" data-testid="contact">
            <UserRound className="mt-2 h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
            <div className="min-w-0 flex-1 pt-1 text-sm">
                <p className="break-words font-medium text-strong">{contact.name}{contact.role && <span className="font-normal text-mid"> · {contact.role}</span>}</p>
                <p className="flex flex-wrap gap-x-3 text-xs">
                    {contact.email && <a href={`mailto:${contact.email}`} className="text-accent hover:underline">{contact.email}</a>}
                    {contact.phone && <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="text-accent hover:underline">{contact.phone}</a>}
                </p>
            </div>
            <button type="button" className={ICON_BUTTON} onClick={onEdit} aria-label={t("jobs.contact.edit", { name: contact.name })}><Pencil className="h-4 w-4" aria-hidden="true" /></button>
            <button type="button" className={ICON_BUTTON} onClick={() => void run((current) => removeContact(current, contact.id))} aria-label={t("jobs.contact.remove", { name: contact.name })}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
        </li>
    );
}

/**
 * Tasks, interview rounds and contacts for one application. Each change saves on its own against the
 * revision on screen. Reminders are shown when EngineCV is open; nothing is pushed or emailed.
 */
export function NextSteps({ application, onAnnounce }: { application: JobApplication; onAnnounce: (message: string) => void }) {
    const { t } = useTranslation();
    const commandError = useCommandError();
    const [interviewDialog, setInterviewDialog] = useState<ApplicationInterview | "new" | null>(null);
    const [contactForm, setContactForm] = useState<ApplicationContact | "new" | null>(null);
    const [showDone, setShowDone] = useState(false);

    const run: Run = async (operation, message) => {
        const outcome = await runCommand(application, operation);
        if (!outcome.ok) onAnnounce(commandError(outcome.reason));
        else if (message) onAnnounce(message);
        return outcome.ok;
    };

    const open = application.tasks.filter(isOpenTask).sort((a, b) => (a.dueOn ?? "~").localeCompare(b.dueOn ?? "~") || a.createdAt - b.createdAt);
    const closed = application.tasks.filter((task) => !isOpenTask(task));
    const calendarEntries = exportableInterviews(application).map((interview) => ({ application, interview }));

    return (
        <div className="space-y-3" data-testid="next-steps">
            <Section title={t("jobs.task.title")} testId="tasks">
                {open.length === 0 && <p className="text-sm text-mid">{t("jobs.task.empty")}</p>}
                <ul>{open.map((task) => <TaskRow key={task.id} task={task} run={run} />)}</ul>
                {closed.length > 0 && (
                    <>
                        <button type="button" onClick={() => setShowDone((value) => !value)} aria-expanded={showDone} className="mt-1 text-xs font-medium text-accent hover:underline">{t(showDone ? "jobs.task.hideDone" : "jobs.task.showDone", { count: closed.length })}</button>
                        {showDone && <ul>{closed.map((task) => <TaskRow key={task.id} task={task} run={run} />)}</ul>}
                    </>
                )}
                <TaskForm run={run} />
                <p className="mt-2 text-xs text-faint">{t("jobs.task.reminderNote")}</p>
            </Section>

            <Section
                title={t("jobs.interview.title")}
                testId="interviews"
                action={(
                    <>
                        {calendarEntries.length > 0 && (
                            <button type="button" className={BUTTON_CLASS} onClick={() => void downloadCalendar(calendarEntries, application)} data-testid="interviews-calendar">
                                <CalendarPlus className="h-4 w-4" aria-hidden="true" />{t("jobs.interview.calendar")}
                            </button>
                        )}
                        <button type="button" className={BUTTON_CLASS} onClick={() => setInterviewDialog("new")} data-testid="interview-add"><Plus className="h-4 w-4" aria-hidden="true" />{t("jobs.interview.add")}</button>
                    </>
                )}
            >
                {application.interviews.length === 0 ? <p className="text-sm text-mid">{t("jobs.interview.empty")}</p> : (
                    <ul>{[...application.interviews].sort((a, b) => (a.startsAt ?? Infinity) - (b.startsAt ?? Infinity)).map((interview) => <InterviewRow key={interview.id} application={application} interview={interview} onEdit={() => setInterviewDialog(interview)} run={run} />)}</ul>
                )}
            </Section>

            <Section title={t("jobs.contact.title")} testId="contacts" action={contactForm === null && <button type="button" className={BUTTON_CLASS} onClick={() => setContactForm("new")} data-testid="contact-add"><Plus className="h-4 w-4" aria-hidden="true" />{t("jobs.contact.add")}</button>}>
                {application.contacts.length === 0 && contactForm === null && <p className="text-sm text-mid">{t("jobs.contact.empty")}</p>}
                <ul>
                    {application.contacts.map((contact) => (contactForm !== "new" && contactForm?.id === contact.id
                        ? <li key={contact.id}><ContactForm initial={contact} onCancel={() => setContactForm(null)} onSave={async (input) => { if (await run((current) => updateContact(current, contact.id, input))) setContactForm(null); }} /></li>
                        : <ContactRow key={contact.id} contact={contact} onEdit={() => setContactForm(contact)} run={run} />))}
                </ul>
                {contactForm === "new" && <ContactForm initial={EMPTY_CONTACT} onCancel={() => setContactForm(null)} onSave={async (input) => { if (await run((current, ctx) => addContact(current, input, ctx))) setContactForm(null); }} />}
            </Section>

            {interviewDialog && (
                <InterviewDialog
                    application={application}
                    interview={interviewDialog === "new" ? null : interviewDialog}
                    onClose={() => setInterviewDialog(null)}
                    onSave={async (input, options) => {
                        const editing = interviewDialog === "new" ? null : interviewDialog;
                        const ok = await run(
                            (current, ctx) => (editing ? updateInterview(current, editing.id, input, ctx) : addInterview(current, input, ctx, options)),
                            t("jobs.announce.interviewSaved"),
                        );
                        if (ok) setInterviewDialog(null);
                        return ok;
                    }}
                />
            )}
        </div>
    );
}
