"use client";

import { Copy, Download, Edit2, Trash2 } from "lucide-react";
import { templateDisplayMeta } from "@/lib/templates/template-display";
import type { TemplateDocument } from "@/lib/templates/template-schema";
import { TemplatePreviewCard } from "@/components/templates/TemplatePreviewCard";
import { useTemplateResume } from "@/components/templates/useTemplateResume";
import { useTranslation } from "@/lib/i18n";
import { DashboardCard, LastUpdatedTooltipContent, type DashboardCardAction } from "./DashboardCard";

export function DashboardTemplateCard({
    template,
    onDuplicate,
    onDownload,
    onEdit,
    onDelete,
}: {
    template: TemplateDocument;
    onDuplicate: () => void;
    onDownload?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}) {
    const { t } = useTranslation();
    const meta = templateDisplayMeta(template, t);
    const templateAction = useTemplateResume();
    const openLabel = t("templates.use.named", { name: meta.name });
    const updatedAtLabel = t("dashboard.updatedAtLabel");
    const preview = (
        <TemplatePreviewCard
            template={template}
            variant="catalog"
            showName={false}
            testId="dashboard-template-preview"
            className="[&>div]:!rounded-none [&>div]:!border-0 [&>div]:!shadow-2xl [&>div]:!shadow-black/20"
        />
    );
    const actions: DashboardCardAction[] = [
        { label: t("templates.actions.duplicate"), icon: Copy, onClick: onDuplicate },
    ];

    if (onDownload) {
        actions.push({ label: t("templates.actions.download"), icon: Download, onClick: onDownload });
    }

    if (onEdit) {
        actions.push({ label: t("templates.actions.editDesign"), icon: Edit2, onClick: onEdit });
    }

    if (onDelete) {
        actions.push({ label: t("templates.actions.delete"), icon: Trash2, onClick: onDelete, variant: "danger" });
    }

    return (
        <DashboardCard
            testId="templates-catalog-card"
            preview={preview}
            title={meta.name}
            description={meta.description}
            tags={meta.tags}
            infoLabel={updatedAtLabel}
            infoContent={<LastUpdatedTooltipContent label={updatedAtLabel} timestamp={template.updatedAt} />}
            openLabel={openLabel}
            onOpen={() => void templateAction.useTemplate(template.id)}
            primaryActionLabel={t("templates.use.action")}
            primaryActionTestId="dashboard-template-use"
            primaryLoading={templateAction.pendingTemplateId === template.id}
            actions={actions}
            errorMessage={templateAction.error}
        />
    );
}
