"use client";

import { Pencil } from "lucide-react";
import { DocStateBadge } from "@/components/workspace/DocStateBadge";
import { useTranslation } from "@/lib/i18n";
import { useResumeStore } from "@/lib/store";

/** The CV name in the editor header, with the workspace folder's state next to it. */
export function CvTitleInput() {
    const { t } = useTranslation();
    const title = useResumeStore((state) => state.resume.meta?.title || "");
    const resumeId = useResumeStore((state) => state.activeResumeId);
    const updateMeta = useResumeStore((state) => state.updateMeta);

    return (
        <>
            <label className="group flex shrink-0 cursor-text items-center gap-1" title={t("dashboard.editMeta")}>
                <input
                    type="text"
                    value={title}
                    placeholder={t("dashboard.cv")}
                    data-testid="cv-title-input"
                    onChange={(event) => updateMeta({ title: event.target.value })}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    className="min-w-0 max-w-[34vw] flex-none truncate border-none bg-transparent p-0 text-sm font-medium sm:max-w-[16rem] text-strong/90 outline-none transition-colors placeholder:text-strong/50 focus:ring-0 group-hover:text-strong"
                    style={{ width: `${Math.max(3, Math.min(18, (title || t("dashboard.cv")).length + 1))}ch` }}
                />
                <Pencil className="pointer-events-none h-3 w-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </label>
            <DocStateBadge docId={resumeId} />
        </>
    );
}
