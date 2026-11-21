"use client";

import { ExternalLink, Lightbulb } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from "@/lib/i18n";
import { SECTION_TIPS, letterTipHref, type LetterTipSection } from "@/lib/letters/tips";

/**
 * Get Tips for a letter section: a button, styled like the CV editor's, that lists the
 * articles worth reading for it. Links open in a new tab so the unsaved editor is never left.
 */
export function LetterTipsLink({ section }: { section: LetterTipSection }) {
    const { t } = useTranslation();
    const tips = SECTION_TIPS[section];
    if (tips.length === 0) return null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    data-testid={`letter-tips-${section}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-edge bg-surface-4 px-3 py-1.5 text-xs font-semibold text-strong shadow-sm transition-colors hover:bg-edge"
                >
                    <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("editor.getTips")}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-1 p-2" data-testid={`letter-tips-${section}-list`}>
                {tips.map((id) => (
                    <a
                        key={id}
                        href={letterTipHref(id)}
                        target="_blank"
                        rel="noopener"
                        data-testid={`letter-tip-${id}`}
                        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-strong transition-colors hover:bg-edge"
                    >
                        {t(`letters.tips.${id}`)}
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
                        <span className="sr-only">{t("editor.opensInNewTab")}</span>
                    </a>
                ))}
            </PopoverContent>
        </Popover>
    );
}
