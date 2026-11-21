"use client";

import { Check, Globe, HardDrive, ShieldCheck, TriangleAlert, FileText } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Connector, DiagramFrame, Item, Zone } from "./DiagramFrame";

// Names developer tools show; the same in every language.
const BROWSER_CODES = {
    cvs: "IndexedDB › resumes, resumeHistory",
    templates: "IndexedDB › templates",
    settings: "localStorage › enginecv-preferences · cookie › enginecv-locale",
    links: "IndexedDB › workspace, workspaceDocs",
};

/** Where a CV lives, and the only ways it leaves the device. */
export function DataMapDiagram({ detailed = false }: { detailed?: boolean }) {
    const { t } = useTranslation();
    const keep = <Check className="h-3.5 w-3.5 text-success" />;
    const warn = <TriangleAlert className="h-3.5 w-3.5 text-warning" />;

    return (
        <DiagramFrame caption={t("diagram.dataMap.caption")} testId="diagram-data-map">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/5 px-3 py-1 text-xs font-medium text-success" data-testid="diagram-no-server">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t("diagram.dataMap.noServer")}
            </p>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
                <Zone title={t("diagram.dataMap.browser.title")} icon={<HardDrive className="h-4 w-4" />} testId="diagram-zone-browser">
                    <ul className="mt-3 space-y-2">
                        <Item icon={keep} code={detailed ? BROWSER_CODES.cvs : undefined}>{t("diagram.dataMap.browser.cvs")}</Item>
                        <Item icon={keep} code={detailed ? BROWSER_CODES.templates : undefined}>{t("diagram.dataMap.browser.templates")}</Item>
                        <Item icon={keep} code={detailed ? BROWSER_CODES.settings : undefined}>{t("diagram.dataMap.browser.settings")}</Item>
                        <Item icon={keep} code={detailed ? BROWSER_CODES.links : undefined}>{t("diagram.dataMap.browser.links")}</Item>
                    </ul>
                </Zone>

                <Connector both label={t("diagram.dataMap.sync")} />

                <Zone title={t("diagram.dataMap.computer.title")} tag={t("diagram.dataMap.computer.tag")} tone="accent" icon={<FileText className="h-4 w-4" />} testId="diagram-zone-computer">
                    <ul className="mt-3 space-y-2">
                        <Item icon={keep}>{t("diagram.dataMap.computer.file")}</Item>
                        <Item icon={keep}>{t("diagram.dataMap.computer.edit")}</Item>
                        <Item icon={keep}>{t("diagram.dataMap.computer.stays")}</Item>
                    </ul>
                </Zone>

                <Connector label={t("diagram.dataMap.export")} />

                <Zone title={t("diagram.dataMap.leaves.title")} tone="warn" icon={<Globe className="h-4 w-4" />} testId="diagram-zone-leaves">
                    <ul className="mt-3 space-y-2">
                        <Item icon={warn}>{t("diagram.dataMap.leaves.exports")}</Item>
                        <Item icon={warn}>{t("diagram.dataMap.leaves.github")}</Item>
                        <Item icon={warn}>{t("diagram.dataMap.leaves.fonts")}</Item>
                        <Item icon={warn}>{t("diagram.dataMap.leaves.agent")}</Item>
                    </ul>
                </Zone>
            </div>
        </DiagramFrame>
    );
}
