"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useTranslation } from "@/lib/i18n";

/**
 * A sentence for delete dialogs when tracked jobs use the document: as a working link or as the source
 * of a recorded copy. Deleting never touches those copies; the jobs show the original as deleted.
 * Empty when no job uses it, so the dialog reads as before.
 */
export function useTrackerUsageNote(documentId: string | null | undefined): string {
    const { t } = useTranslation();
    const count = useLiveQuery(async () => {
        if (!documentId) return 0;
        return db.jobApplications
            .filter((job) =>
                job.trashedAt === null && (
                    job.workingCvId === documentId
                    || job.workingLetterId === documentId
                    || job.submissions.some((submission) => [submission.cv, submission.letter].some((slot) => slot.status === "captured" && slot.sourceId === documentId))
                ))
            .count();
    }, [documentId]);
    return count ? t("jobs.usage.deleteNote", { count }) : "";
}
