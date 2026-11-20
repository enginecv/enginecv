"use client";

import { Check, Circle, ListChecks, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { hideChecklist } from "@/lib/preferences/onboarding";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { useResumeStore } from "@/lib/store";

interface Step {
    id: "name" | "entry" | "customize" | "export";
    done: boolean;
    onClick?: () => void;
}

/**
 * A short, quiet getting-started checklist at the top of the content sidebar.
 * Steps tick themselves from what the person does; it never blocks anything,
 * goes away when finished, and can be hidden and brought back (command palette).
 */
export function EditorChecklist() {
    const { t } = useTranslation();
    const hidden = useClientPreferencesStore((state) => state.preferences.onboarding.checklistHidden);
    const customizeSeen = useClientPreferencesStore((state) => state.preferences.onboarding.customizeSeen);
    const exported = useClientPreferencesStore((state) => state.preferences.support.successfulExportCount > 0);
    const hasName = useResumeStore((state) => state.resume.basics.name.trim() !== "");
    const hasEntry = useResumeStore((state) => {
        const { experience, education, projects, courses, certificates, awards } = state.resume;
        return [experience, education, projects, courses, certificates, awards].some((list) => list.length > 0);
    });
    const requestContentSection = useResumeStore((state) => state.requestContentSection);
    const setSidebarTab = useResumeStore((state) => state.setSidebarTab);

    const steps: Step[] = [
        { id: "name", done: hasName, onClick: () => requestContentSection("basics", "open") },
        { id: "entry", done: hasEntry, onClick: () => requestContentSection("experience", "add") },
        { id: "customize", done: customizeSeen, onClick: () => setSidebarTab("customize") },
        { id: "export", done: exported },
    ];
    const done = steps.filter((step) => step.done).length;

    if (hidden || done === steps.length) return null;

    return (
        <section
            aria-label={t("onboarding.checklist.title")}
            data-testid="editor-checklist"
            className="mx-1 mt-2 rounded-md border border-edge bg-surface-1 px-2.5 py-2.5"
        >
            <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-strong">{t("onboarding.checklist.title")}</h2>
                <span className="shrink-0 text-[11px] tabular-nums text-faint" data-testid="editor-checklist-progress">
                    {t("onboarding.checklist.progress", { done, total: steps.length })}
                </span>
                <button
                    type="button"
                    onClick={hideChecklist}
                    aria-label={t("onboarding.checklist.hide")}
                    title={t("onboarding.checklist.hideHint")}
                    data-testid="editor-checklist-hide"
                    className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint transition-colors hover:bg-surface-4 hover:text-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            </div>
            <ul className="mt-2 space-y-0.5">
                {steps.map((step) => {
                    const label = t(`onboarding.checklist.${step.id}`);
                    const icon = step.done
                        ? <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                        : <Circle className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />;
                    const text = (
                        <span className={step.done ? "text-faint line-through" : "text-bright"}>
                            {label}
                            <span className="sr-only">{`: ${t(step.done ? "onboarding.checklist.stepDone" : "onboarding.checklist.stepOpen")}`}</span>
                        </span>
                    );
                    return (
                        <li key={step.id} data-testid={`editor-checklist-${step.id}`} data-done={step.done}>
                            {step.onClick && !step.done ? (
                                <button
                                    type="button"
                                    onClick={step.onClick}
                                    className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-xs transition-colors hover:bg-surface-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                                >
                                    {icon}
                                    {text}
                                </button>
                            ) : (
                                <span className="flex items-center gap-2 px-1 py-1 text-xs">
                                    {icon}
                                    {text}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
