"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useKeepRouteLocale } from "@/lib/i18n/keep-route-locale";
import { createResumeFromTemplate } from "@/lib/templates/use-template";

export function useTemplateResume() {
    const router = useRouter();
    const { t } = useTranslation();
    const keepRouteLocale = useKeepRouteLocale();
    const pendingRef = useRef<string | null>(null);
    const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const useTemplate = useCallback(async (templateId: string) => {
        if (pendingRef.current) {
            return;
        }

        pendingRef.current = templateId;
        setPendingTemplateId(templateId);
        setError(null);

        try {
            const resumeId = await createResumeFromTemplate(templateId);
            keepRouteLocale();
            router.push(`/editor/${resumeId}`);
        } catch (cause) {
            console.error("[EngineCV] Template resume creation failed.", cause);
            setError(t("templates.use.error"));
        } finally {
            pendingRef.current = null;
            setPendingTemplateId(null);
        }
    }, [keepRouteLocale, router, t]);

    return {
        error,
        pendingTemplateId,
        useTemplate,
        clearError: () => setError(null),
    };
}
