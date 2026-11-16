"use client";

import { useEffect } from "react";
import { detachLink, restoreLink } from "@/lib/linked-file/controller";
import { useResumeStore } from "@/lib/store";

/**
 * Binds the linked file (if any) to the CV that is open. Resume mode only:
 * pass `enabled: false` for templates and read-only documents.
 */
export function useLinkedFile(resumeId: string | null, enabled: boolean) {
    useEffect(() => {
        if (!enabled || !resumeId) return;
        let cancelled = false;
        void restoreLink(resumeId).catch(() => {
            if (!cancelled) useResumeStore.getState().setLinkedFile({ status: "broken" });
        });
        return () => {
            cancelled = true;
            detachLink();
            useResumeStore.getState().resetLinkedFile();
        };
    }, [resumeId, enabled]);
}
