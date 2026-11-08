"use client";

import type { ReactNode } from "react";
import { ArrowUpRight, Clock, Info, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";
import { formatResumeTimestamp } from "@/lib/resume-utils";

export type DashboardCardAction = {
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    variant?: "default" | "danger";
};

const DASHBOARD_PREVIEW_STAGE_CLASS = "mx-auto w-full max-w-[296px] rounded-2xl bg-gradient-to-br from-[#f7f7f8] via-[#ececef] to-[#d9dade] p-2 shadow-inner shadow-white/40";

export function DashboardCard({
    testId,
    preview,
    title,
    description,
    tags,
    infoContent,
    infoLabel,
    openLabel,
    onOpen,
    primaryActionLabel,
    primaryActionTestId,
    primaryLoading = false,
    actions,
    errorMessage,
    children,
}: {
    testId: string;
    preview: ReactNode;
    title: string;
    description?: string;
    tags?: string[];
    infoContent?: ReactNode;
    infoLabel?: string;
    openLabel: string;
    onOpen: () => void;
    primaryActionLabel?: string;
    primaryActionTestId?: string;
    primaryLoading?: boolean;
    actions?: DashboardCardAction[];
    errorMessage?: string | null;
    children?: ReactNode;
}) {
    const { t } = useTranslation();
    const visibleTags = (tags ?? []).slice(0, 4);
    const visibleActions = actions ?? [];

    return (
        <article
            data-testid={testId}
            className="group flex h-full flex-col rounded-2xl border border-edge bg-surface-4/80 p-4 transition-all duration-300 hover:border-accent/30 hover:bg-surface-5 hover:shadow-2xl hover:shadow-accent/5"
        >
            <button
                type="button"
                onClick={onOpen}
                disabled={primaryLoading}
                className={`block w-full text-left transition-transform duration-300 group-hover:scale-[1.01] ${DASHBOARD_PREVIEW_STAGE_CLASS}`}
                aria-label={openLabel}
            >
                {preview}
            </button>

            <div className="mt-6 flex min-w-0 flex-1 flex-col px-1">
                {children ?? (
                    <div className="flex flex-1 flex-col">
                        <div>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <h2 className="truncate text-base font-semibold tracking-tight text-strong group-hover:text-accent transition-colors">
                                        {title}
                                    </h2>
                                    {description && (
                                        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-mid">
                                            {description}
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={onOpen}
                                    disabled={primaryLoading}
                                    data-testid={primaryActionTestId}
                                    className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-edge text-bright transition-all duration-200 group-hover:border-accent/40 group-hover:bg-accent group-hover:text-surface-2 group-hover:shadow-lg group-hover:shadow-accent/20 disabled:cursor-wait disabled:opacity-70 ${primaryActionLabel ? "px-3" : "w-9"}`}
                                    aria-label={openLabel}
                                >
                                    {primaryActionLabel && (
                                        <span className="text-xs font-semibold">
                                            {primaryLoading ? t("templates.use.creating") : primaryActionLabel}
                                        </span>
                                    )}
                                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </div>

                            {visibleTags.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {visibleTags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="rounded-lg border border-edge bg-surface-1/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-faint"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {(visibleActions.length > 0 || infoContent) && (
                            <div className="mt-auto flex items-end justify-between gap-3 pt-6">
                                <div className="flex items-center gap-1.5">
                                    {visibleActions.map((action) => {
                                        const ActionIcon = action.icon;
                                        const isDanger = action.variant === "danger";

                                        return (
                                            <button
                                                key={action.label}
                                                type="button"
                                                onClick={action.onClick}
                                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-edge text-faint transition-all duration-200 ${
                                                    isDanger
                                                        ? "hover:border-red-500/40 hover:bg-red-500/10 hover:text-danger"
                                                        : "hover:border-faint hover:bg-edge hover:text-strong"
                                                }`}
                                                title={action.label}
                                                aria-label={action.label}
                                            >
                                                <ActionIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                            </button>
                                        );
                                    })}
                                </div>
                                {infoContent && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-edge text-faint transition-all duration-200 hover:border-faint hover:bg-edge hover:text-strong"
                                                aria-label={infoLabel}
                                            >
                                                <Info className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="end" className="glass-panel text-strong border-edge">
                                            {infoContent}
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                        )}
                    </div>
                )}
                {errorMessage && (
                    <p
                        role="alert"
                        className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-danger-soft"
                    >
                        {errorMessage}
                    </p>
                )}
            </div>
        </article>
    );
}

export function LastUpdatedTooltipContent({
    label,
    timestamp,
}: {
    label: string;
    timestamp: number;
}) {
    return (
        <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {label}: {formatResumeTimestamp(timestamp)}
        </span>
    );
}
