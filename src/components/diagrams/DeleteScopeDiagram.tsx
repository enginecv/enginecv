"use client";

import { HardDrive, FileText, Minus, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { DiagramFrame, Item, Zone } from "./DiagramFrame";

/** What "Delete all my data" removes, and what it leaves where it is. */
export function DeleteScopeDiagram() {
    const { t } = useTranslation();
    const removed = <X className="h-3.5 w-3.5 text-danger" />;
    const stays = <Minus className="h-3.5 w-3.5 text-mid" />;

    return (
        <DiagramFrame caption={t("diagram.delete.caption")} testId="diagram-delete-scope">
            <div className="grid gap-3 sm:grid-cols-2">
                <Zone title={t("diagram.delete.removes.title")} icon={<HardDrive className="h-4 w-4" />} testId="diagram-delete-removes">
                    <ul className="mt-3 space-y-2">
                        <Item icon={removed}>{t("diagram.delete.removes.cvs")}</Item>
                        <Item icon={removed}>{t("diagram.delete.removes.templates")}</Item>
                        <Item icon={removed}>{t("diagram.delete.removes.settings")}</Item>
                        <Item icon={removed}>{t("diagram.delete.removes.links")}</Item>
                    </ul>
                </Zone>
                <Zone title={t("diagram.delete.stays.title")} tone="accent" icon={<FileText className="h-4 w-4" />} testId="diagram-delete-stays">
                    <ul className="mt-3 space-y-2">
                        <Item icon={stays}>{t("diagram.delete.stays.files")}</Item>
                        <Item icon={stays}>{t("diagram.delete.stays.exports")}</Item>
                        <Item icon={stays}>{t("diagram.delete.stays.agent")}</Item>
                    </ul>
                    <p className="mt-3 text-xs leading-5 text-mid">{t("diagram.delete.stays.hint")}</p>
                </Zone>
            </div>
        </DiagramFrame>
    );
}
