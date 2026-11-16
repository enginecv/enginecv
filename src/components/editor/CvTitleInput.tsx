"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { renameLinkedCv } from "@/lib/linked-file/rename";
import { useResumeStore } from "@/lib/store";

/**
 * The CV name in the editor header. While the CV is linked to a file the name
 * is the file name, so a rename is committed once (Enter or leaving the field)
 * and is refused with a message: rename the file and relink instead.
 */
export function CvTitleInput() {
    const { t } = useTranslation();
    const title = useResumeStore((state) => state.resume.meta?.title || "");
    const resumeId = useResumeStore((state) => state.activeResumeId);
    const linked = useResumeStore((state) => state.linkedFile.status !== "none" && state.linkedFile.status !== "unsupported");
    const updateMeta = useResumeStore((state) => state.updateMeta);
    const [draft, setDraft] = useState(title);
    const [error, setError] = useState<string | null>(null);

    // Follow the stored title when it changes from outside (rename, restore, load).
    const [seenTitle, setSeenTitle] = useState(title);
    if (title !== seenTitle) {
        setSeenTitle(title);
        setDraft(title);
    }

    const commit = async () => {
        if (!linked || !resumeId || draft === title) {
            setError(null);
            return;
        }
        const result = await renameLinkedCv(resumeId, draft);
        if (result.ok) {
            updateMeta({ title: result.title });
            setDraft(result.title);
            setError(null);
        } else {
            setDraft(title);
            setError(t("linkedFile.error.renameLinked"));
        }
    };

    const shown = linked ? draft : title;
    return (
        <>
            <label className="group flex shrink-0 cursor-text items-center gap-1" title={t("dashboard.editMeta")}>
                <input
                    type="text"
                    value={shown}
                    placeholder={t("dashboard.cv")}
                    data-testid="cv-title-input"
                    onChange={(event) => (linked ? setDraft(event.target.value) : updateMeta({ title: event.target.value }))}
                    onBlur={() => void commit()}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape" && linked) {
                            setDraft(title);
                            event.currentTarget.blur();
                        }
                    }}
                    className="min-w-0 max-w-[34vw] flex-none truncate border-none bg-transparent p-0 text-sm font-medium sm:max-w-[16rem] text-strong/90 outline-none transition-colors placeholder:text-strong/50 focus:ring-0 group-hover:text-strong"
                    style={{ width: `${Math.max(3, Math.min(18, (shown || t("dashboard.cv")).length + 1))}ch` }}
                />
                <Pencil className="pointer-events-none h-3 w-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </label>
            {error && <span role="alert" className="min-w-0 truncate text-[11px] text-danger" data-testid="cv-title-error" title={error}>{error}</span>}
        </>
    );
}
