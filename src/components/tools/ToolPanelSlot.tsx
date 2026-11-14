"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useSyncExternalStore, type ComponentType } from "react";
import { WifiOff } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useRouteLocale } from "@/lib/i18n/route-locale";
import type { ToolPanelId } from "@/lib/tools/registry";

/** What a tool page passes to its embedded tool. */
export interface ToolPanelProps {
    /** Called with the id of the saved resume; the page opens the editor. */
    onDone: (id: string) => void;
    /** Id of the element that names the tool (the page h1). */
    labelledBy: string;
}

function PanelSkeleton() {
    const { t } = useTranslation();
    return (
        <div role="status" aria-live="polite" className="flex min-h-[22rem] items-center justify-center" data-testid="tool-panel-loading">
            <span className="text-sm text-faint">{t("tools.loading")}</span>
        </div>
    );
}

// Tool code (pdf.js, the ZIP reader, the CEFR form) loads after the page text, not with it.
const PANELS: Partial<Record<ToolPanelId, ComponentType<ToolPanelProps>>> = {
    europass: dynamic(() => import("@/components/import/EuropassImportPanel").then((m) => m.EuropassImportPanel), {
        ssr: false,
        loading: PanelSkeleton,
    }),
    linkedin: dynamic(() => import("@/components/import/LinkedinImportPanel").then((m) => m.LinkedinImportPanel), {
        ssr: false,
        loading: PanelSkeleton,
    }),
    github: dynamic(() => import("@/components/import/GithubImportPanel").then((m) => m.GithubImportPanel), {
        ssr: false,
        loading: PanelSkeleton,
    }),
    jsonresume: dynamic(() => import("@/components/import/JsonResumeImportPanel").then((m) => m.JsonResumeImportPanel), {
        ssr: false,
        loading: PanelSkeleton,
    }),
    cefr: dynamic(() => import("@/components/tools/CefrAssessmentPanel").then((m) => m.CefrAssessmentPanel), {
        ssr: false,
        loading: PanelSkeleton,
    }),
};

function subscribeOnline(onChange: () => void) {
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
    };
}

function useOnline() {
    return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

export function ToolPanelSlot({ panel, worksOffline, labelledBy }: { panel: ToolPanelId; worksOffline: boolean; labelledBy: string }) {
    const { t, setLocale } = useTranslation();
    const routeLocale = useRouteLocale();
    const router = useRouter();
    const online = useOnline();
    const Panel = PANELS[panel];

    // The editor follows the stored language, so store the page's language
    // only once the visitor actually opens the editor from here.
    const onDone = useCallback((id: string) => {
        if (routeLocale) setLocale(routeLocale);
        router.push(`/editor/${id}`);
    }, [routeLocale, router, setLocale]);

    return (
        <>
            {!worksOffline && !online && (
                <p role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-tint px-4 py-3 text-sm text-strong" data-testid="tool-offline-notice">
                    <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                    {t("tools.offlineNotice")}
                </p>
            )}
            {Panel ? <Panel onDone={onDone} labelledBy={labelledBy} /> : <PanelSkeleton />}
        </>
    );
}
