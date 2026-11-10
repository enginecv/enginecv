"use client";

import { Lightbulb } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { getGuideForSection } from "@/lib/guides/registry";
import { guidePath } from "@/lib/site";

/**
 * Get Tips: opens the section's guide in a new tab so the editor and its
 * unsaved state are never navigated. Renders nothing when the section has no
 * published guide, so the control can never lead to a missing page.
 */
export function GetTipsLink({ sectionId, className }: { sectionId: string; className: string }) {
    const { t } = useTranslation();
    const guide = getGuideForSection(sectionId);
    if (!guide) return null;

    return (
        <a
            href={guidePath(guide.slug)}
            target="_blank"
            rel="noopener"
            data-testid="get-tips-link"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-edge text-strong hover:bg-edge transition-colors shadow-sm ${className}`}
        >
            <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />
            {t("editor.getTips")}
        </a>
    );
}
