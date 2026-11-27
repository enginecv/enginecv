"use client";

import { Download, FileSpreadsheet, HardDriveDownload, Upload } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { APP_VERSION } from "@/lib/app-version";
import { db } from "@/lib/db";
import { useTranslation } from "@/lib/i18n";
import { serializeTrackerBackup, trackerBackupFileName } from "@/lib/jobs/backup";
import { buildCsv, csvFileName } from "@/lib/jobs/csv";
import { localDateOnly } from "@/lib/jobs/dates";
import { readTrackerBackup } from "@/lib/jobs/repository";
import { cvTitle, letterTitle } from "@/lib/jobs/submissions";
import { RestoreDialog } from "./RestoreDialog";
import { useStageLabel } from "./shared";

async function save(content: string, type: string, fileName: string) {
    const { downloadBlob } = await import("@/lib/export");
    downloadBlob(new Blob([content], { type }), fileName);
}

/**
 * Local copies of the tracker: the complete backup (every job and the exact recorded copies, for restoring)
 * and a CSV summary (for reading in a spreadsheet). Both are downloads on this device; nothing is uploaded.
 */
export function BackupMenu({ onAnnounce }: { onAnnounce: (message: string) => void }) {
    const { t } = useTranslation();
    const stageLabel = useStageLabel();
    const [open, setOpen] = useState(false);
    const [restoring, setRestoring] = useState(false);

    const downloadBackup = async () => {
        setOpen(false);
        try {
            await save(serializeTrackerBackup(await readTrackerBackup(APP_VERSION)), "application/json", trackerBackupFileName());
        } catch (error) {
            console.error("[EngineCV] Could not build the tracker backup.", error);
            onAnnounce(t("jobs.backup.failed"));
        }
    };

    const downloadCsv = async () => {
        setOpen(false);
        try {
            const [applications, cvs, letters] = await Promise.all([db.jobApplications.toArray(), db.resumes.toArray(), db.coverLetters.toArray()]);
            const cvNames = new Map(cvs.map((cv) => [cv.id as string, cvTitle(cv)]));
            const letterNames = new Map(letters.map((letter) => [letter.id, letterTitle(letter)]));
            const csv = buildCsv(applications, {
                headers: {
                    company: t("jobs.field.company"), role: t("jobs.field.role"), jobUrl: t("jobs.csv.link"), stage: t("jobs.list.stage"), location: t("jobs.field.location"),
                    deadline: t("jobs.field.deadline"), lastSent: t("jobs.list.lastSent"), nextAction: t("jobs.sort.next"), cv: t("jobs.documents.cv"), letter: t("jobs.documents.letter"),
                    tags: t("jobs.field.tags"), archived: t("jobs.scope.archived"), created: t("jobs.csv.created"), updated: t("jobs.csv.updated"),
                },
                stage: stageLabel,
                yes: t("jobs.csv.yes"),
            }, { cv: (id) => cvNames.get(id) ?? null, letter: (id) => letterNames.get(id) ?? null }, localDateOnly());
            await save(csv, "text/csv;charset=utf-8", csvFileName());
        } catch (error) {
            console.error("[EngineCV] Could not build the CSV summary.", error);
            onAnnounce(t("jobs.backup.failed"));
        }
    };

    const item = "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-mid transition-colors hover:bg-surface-4/70 hover:text-strong";
    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button type="button" className="flex items-center gap-1.5 text-mid hover:text-strong" data-testid="jobs-backup-menu">
                        <HardDriveDownload className="h-4 w-4" aria-hidden="true" />
                        {t("jobs.backup.menu")}
                    </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-1.5">
                    <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-faint">{t("jobs.backup.menu")}</p>
                    <button type="button" className={item} onClick={() => void downloadBackup()} data-testid="jobs-backup-download">
                        <Download className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span><span className="block font-medium text-strong">{t("jobs.backup.download")}</span><span className="block text-xs text-faint">{t("jobs.backup.downloadHint")}</span></span>
                    </button>
                    <button type="button" className={item} onClick={() => { setOpen(false); setRestoring(true); }} data-testid="jobs-backup-restore">
                        <Upload className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span><span className="block font-medium text-strong">{t("jobs.backup.restore")}</span><span className="block text-xs text-faint">{t("jobs.backup.restoreHint")}</span></span>
                    </button>
                    <button type="button" className={item} onClick={() => void downloadCsv()} data-testid="jobs-backup-csv">
                        <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span><span className="block font-medium text-strong">{t("jobs.backup.csv")}</span><span className="block text-xs text-faint">{t("jobs.backup.csvHint")}</span></span>
                    </button>
                </PopoverContent>
            </Popover>
            {restoring && <RestoreDialog onClose={() => setRestoring(false)} onAnnounce={onAnnounce} />}
        </>
    );
}
