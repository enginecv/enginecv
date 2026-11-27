"use client";

import { useCallback, useState, type ReactNode } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useTranslation } from "@/lib/i18n";
import { cancelOpenTasks, changeStage, isOpenTask } from "@/lib/jobs/operations";
import { isTerminalStage, type ApplicationStage, type JobApplication } from "@/lib/jobs/schema";
import { applicationTitle, runCommand, useCommandError, useStageLabel } from "./shared";

/**
 * Stage changes from the board, list and details. Moving to a closed stage with open tasks asks whether
 * to cancel them too; keeping them is the default, and dismissing the question leaves the stage as it was.
 */
export function useStageChange(onAnnounce: (message: string) => void): { requestStage: (application: JobApplication, stage: ApplicationStage) => void; stageDialog: ReactNode } {
    const { t } = useTranslation();
    const stageLabel = useStageLabel();
    const commandError = useCommandError();
    const [pending, setPending] = useState<{ application: JobApplication; stage: ApplicationStage; open: number } | null>(null);

    const apply = useCallback(async (application: JobApplication, stage: ApplicationStage, cancelTasks: boolean) => {
        setPending(null);
        const outcome = await runCommand(application, (current, ctx) => {
            const moved = changeStage(current, stage, ctx);
            return cancelTasks ? cancelOpenTasks(moved, ctx) : moved;
        });
        onAnnounce(outcome.ok ? t("jobs.announce.moved", { job: applicationTitle(application), stage: stageLabel(stage) }) : commandError(outcome.reason));
    }, [commandError, onAnnounce, stageLabel, t]);

    const requestStage = useCallback((application: JobApplication, stage: ApplicationStage) => {
        const open = application.tasks.filter(isOpenTask).length;
        if (isTerminalStage(stage) && !isTerminalStage(application.stage) && open > 0) setPending({ application, stage, open });
        else void apply(application, stage, false);
    }, [apply]);

    const stageDialog = (
        <ConfirmModal
            open={pending !== null}
            title={t("jobs.closeTasks.title", { stage: pending ? stageLabel(pending.stage) : "" })}
            description={t("jobs.closeTasks.description", { count: pending?.open ?? 0 })}
            confirmLabel={t("jobs.closeTasks.keep")}
            secondaryAction={pending ? { label: t("jobs.closeTasks.cancel", { count: pending.open }), onClick: () => void apply(pending.application, pending.stage, true) } : undefined}
            onConfirm={() => pending && void apply(pending.application, pending.stage, false)}
            onCancel={() => setPending(null)}
        />
    );
    return { requestStage, stageDialog };
}
