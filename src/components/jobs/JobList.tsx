"use client";

import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import type { ApplicationStage, JobApplication } from "@/lib/jobs/schema";
import { WorkingDocuments, useWhereLine } from "./JobBoard";
import { StageMenu } from "./shared";

/** The latest date the person says something was sent, if any submission is recorded. */
function lastSent(application: JobApplication): string | null {
    return application.submissions.reduce<string | null>((latest, submission) => (latest === null || submission.sentOn > latest ? submission.sentOn : latest), null);
}

/**
 * One row per application, in the chosen order. On narrow screens the optional columns fold into the
 * first cell, so nothing required is clipped at 360 px.
 */
export function JobList({ applications, onOpen, onMove }: {
    applications: readonly JobApplication[];
    onOpen: (id: string) => void;
    onMove: (application: JobApplication, stage: ApplicationStage) => void;
}) {
    const { t, locale } = useTranslation();
    const where = useWhereLine();
    const day = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }), [locale]);
    const formatDay = (value: string | null) => (value ? day.format(Date.parse(`${value}T00:00:00Z`)) : "—");
    return (
        <table className="w-full table-fixed border-separate border-spacing-y-2 text-sm" data-testid="job-list">
            <thead className="text-left text-xs font-semibold text-faint">
                <tr>
                    <th scope="col" className="px-3">{t("jobs.list.job")}</th>
                    <th scope="col" className="w-40 px-3">{t("jobs.list.stage")}</th>
                    <th scope="col" className="hidden w-36 px-3 md:table-cell">{t("jobs.list.deadline")}</th>
                    <th scope="col" className="hidden w-36 px-3 md:table-cell">{t("jobs.list.lastSent")}</th>
                    <th scope="col" className="hidden w-24 px-3 sm:table-cell">{t("jobs.list.documents")}</th>
                </tr>
            </thead>
            <tbody>
                {applications.map((application) => {
                    const line = where(application);
                    return (
                        <tr key={application.id} className="bg-surface-3" data-testid="job-row">
                            <td className="rounded-l-xl px-3 py-2.5 align-top">
                                <button type="button" onClick={() => onOpen(application.id)} className="block w-full text-left" data-testid={`job-row-open-${application.id}`}>
                                    <span className="block break-words font-semibold text-strong">{application.role}</span>
                                    <span className="block break-words text-mid">{application.company}</span>
                                    {line && <span className="block text-xs text-faint">{line}</span>}
                                    {application.deadline && <span className="block text-xs text-faint md:hidden">{t("jobs.list.deadline")}: {formatDay(application.deadline)}</span>}
                                </button>
                            </td>
                            <td className="px-3 py-2.5 align-top sm:rounded-none max-sm:rounded-r-xl">
                                <StageMenu application={application} compact onChange={(stage) => onMove(application, stage)} testId={`job-row-stage-${application.id}`} />
                            </td>
                            <td className="hidden px-3 py-2.5 align-top text-mid md:table-cell">{formatDay(application.deadline)}</td>
                            <td className="hidden px-3 py-2.5 align-top text-mid md:table-cell">{formatDay(lastSent(application))}</td>
                            <td className="hidden rounded-r-xl px-3 py-2.5 align-top sm:table-cell"><WorkingDocuments application={application} /></td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
