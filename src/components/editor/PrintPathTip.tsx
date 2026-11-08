"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, Printer } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { markPrintTipSeen } from "@/lib/preferences/onboarding";
import { useClientPreferencesStore } from "@/lib/preferences/store";

const TIP_KEYS = [
    "onboarding.printTip.chrome",
    "onboarding.printTip.windows",
    "onboarding.printTip.settings",
    "onboarding.printTip.others",
] as const;

/**
 * PDF export goes through the browser's print dialog, which covers the editor
 * once it opens. So the export dialog explains it beforehand: in full until the
 * first PDF export (or "Got it"), then one click away. Never takes focus.
 */
export function PrintPathTip() {
    const { t } = useTranslation();
    const seen = useClientPreferencesStore((state) => state.preferences.onboarding.printTipSeen);
    const [expanded, setExpanded] = useState(false);
    const contentId = useId();
    // "Got it" removes itself; focus moves to the toggle that replaces it.
    const focusToggleRef = useRef(false);

    const content = (
        <div id={contentId} className="space-y-1.5 text-xs leading-relaxed text-mid">
            <p className="text-strong">{t("onboarding.printTip.lead")}</p>
            <ul className="list-disc space-y-1 pl-4">
                {TIP_KEYS.map((key) => <li key={key}>{t(key)}</li>)}
            </ul>
        </div>
    );

    if (seen) {
        return (
            <div className="mb-3 px-2" data-testid="print-tip-collapsed">
                <button
                    ref={(element) => {
                        if (element && focusToggleRef.current) {
                            focusToggleRef.current = false;
                            element.focus();
                        }
                    }}
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    aria-expanded={expanded}
                    aria-controls={expanded ? contentId : undefined}
                    data-testid="print-tip-toggle"
                    className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-mid transition-colors hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("onboarding.printTip.show")}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform${expanded ? " rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {expanded && <div className="mt-2" data-testid="print-tip">{content}</div>}
            </div>
        );
    }

    return (
        <section aria-label={t("onboarding.printTip.title")} data-testid="print-tip" className="mb-3 rounded-xl border border-edge bg-surface-1 p-3">
            <div className="mb-2 flex items-center gap-2">
                <Printer className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <h3 className="text-sm font-medium text-strong">{t("onboarding.printTip.title")}</h3>
            </div>
            {content}
            <button
                type="button"
                onClick={() => {
                    focusToggleRef.current = true;
                    markPrintTipSeen();
                }}
                data-testid="print-tip-dismiss"
                className="mt-2 inline-flex h-7 items-center rounded-lg px-2.5 text-xs font-medium text-mid transition-colors hover:bg-surface-4 hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
                {t("onboarding.printTip.gotIt")}
            </button>
        </section>
    );
}
