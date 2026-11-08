"use client";

import { Coffee, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { dismissExportSupportPrompt, useExportSupportPromptStore } from "@/lib/preferences/export-support";
import { getKofiUrl } from "@/lib/support";

/**
 * Non-blocking thank-you card shown after a successful export milestone.
 * A live region, not a dialog: it never takes focus and never sits in the export flow.
 */
export function ExportSupportCard() {
    const { t } = useTranslation();
    const visible = useExportSupportPromptStore((state) => state.visible);
    const hide = useExportSupportPromptStore((state) => state.hide);

    return (
        <div role="status" aria-live="polite" className="print:hidden">
            {visible && (
                <div
                    data-testid="export-support-card"
                    className="fixed bottom-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-edge bg-surface-3 p-4 shadow-lg"
                >
                    <div className="flex items-start gap-3">
                        <Coffee className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                        <p className="text-sm leading-6 text-bright">{t("export.supportPrompt.message")}</p>
                        <button
                            type="button"
                            onClick={hide}
                            aria-label={t("export.supportPrompt.close")}
                            data-testid="export-support-close"
                            className="-mr-1 -mt-1 rounded-md p-1 text-faint transition-colors hover:bg-surface-4 hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
                        <a
                            href={getKofiUrl("export")}
                            target="_blank"
                            rel="noreferrer"
                            onClick={hide}
                            data-testid="export-support-kofi"
                            className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-xs font-semibold text-surface-0 transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-3"
                        >
                            {t("export.supportPrompt.link")}
                        </a>
                        <button
                            type="button"
                            onClick={() => {
                                dismissExportSupportPrompt();
                                hide();
                            }}
                            data-testid="export-support-dismiss"
                            className="inline-flex h-8 items-center rounded-lg px-3 text-xs text-mid transition-colors hover:bg-surface-4 hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                            {t("export.supportPrompt.dontShowAgain")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
