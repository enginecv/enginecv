"use client";

import { ArrowDownToLine, ArrowUpFromLine, Bot, CircleAlert, FileText, Monitor } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Connector, DiagramFrame, Zone } from "./DiagramFrame";

const TO_CV_STEPS = [
  "diagram.sync.toCv.check",
  "diagram.sync.toCv.stable",
  "diagram.sync.toCv.validate",
  "diagram.sync.toCv.snapshot",
  "diagram.sync.toCv.apply",
] as const;
const TO_FILE_STEPS = ["diagram.sync.toFile.edit", "diagram.sync.toFile.wait", "diagram.sync.toFile.write"] as const;

function Steps({ keys, label }: { keys: readonly string[]; label: string }) {
    const { t } = useTranslation();
    return (
        <ol className="mt-3 space-y-2" aria-label={label}>
            {keys.map((key, index) => (
                <li key={key} className="flex items-start gap-2.5 text-sm leading-6 text-bright">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-edge-strong bg-surface-1 font-[family-name:var(--font-geist-mono)] text-[10px] text-mid" aria-hidden="true">
                        {index + 1}
                    </span>
                    <span className="min-w-0">{t(key)}</span>
                </li>
            ))}
        </ol>
    );
}

/** How a change travels between the file and the CV, in both directions, and what an invalid change does. */
export function SyncLoopDiagram() {
    const { t } = useTranslation();

    return (
        <DiagramFrame caption={t("diagram.sync.caption")} testId="diagram-sync-loop">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch" data-testid="diagram-sync-actors">
                <Zone title={t("diagram.sync.actors.agent")} icon={<Bot className="h-4 w-4" />}>
                    <p className="mt-2 text-xs leading-5 text-mid">{t("diagram.sync.actors.agentNote")}</p>
                </Zone>
                <Connector both />
                <Zone title={t("diagram.sync.actors.file")} tone="accent" icon={<FileText className="h-4 w-4" />}>
                    <p className="mt-2 text-xs leading-5 text-mid">{t("diagram.sync.actors.fileNote")}</p>
                </Zone>
                <Connector both />
                <Zone title={t("diagram.sync.actors.app")} icon={<Monitor className="h-4 w-4" />}>
                    <p className="mt-2 text-xs leading-5 text-mid">{t("diagram.sync.actors.appNote")}</p>
                </Zone>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <Zone title={t("diagram.sync.toCv.title")} icon={<ArrowDownToLine className="h-4 w-4" />} testId="diagram-sync-to-cv">
                    <Steps keys={TO_CV_STEPS} label={t("diagram.sync.toCv.title")} />
                </Zone>
                <div className="flex flex-col gap-3">
                    <Zone title={t("diagram.sync.toFile.title")} icon={<ArrowUpFromLine className="h-4 w-4" />} testId="diagram-sync-to-file">
                        <Steps keys={TO_FILE_STEPS} label={t("diagram.sync.toFile.title")} />
                    </Zone>
                    <Zone title={t("diagram.sync.invalid.title")} tone="warn" icon={<CircleAlert className="h-4 w-4" />} testId="diagram-sync-invalid">
                        <p className="mt-2 text-sm leading-6 text-bright">{t("diagram.sync.invalid.text")}</p>
                    </Zone>
                </div>
            </div>
        </DiagramFrame>
    );
}
