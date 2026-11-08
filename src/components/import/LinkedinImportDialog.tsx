"use client";

import { Linkedin, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import type { Resume } from "@/lib/schema";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { LinkedinImportPanel } from "./LinkedinImportPanel";

export interface LinkedinImportDialogProps {
    open: boolean;
    onClose: () => void;
    persistResume?: (resume: Resume) => Promise<string>;
    onImported?: (id: string) => void;
}

export function LinkedinImportDialog({
    open,
    onClose,
    persistResume,
    onImported,
}: LinkedinImportDialogProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    // Closing unmounts the panel, which drops its state and any late parse result.
    const close = useCallback(() => {
        if (busy) return;
        onClose();
    }, [busy, onClose]);

    const done = useCallback((id: string) => {
        onImported?.(id);
        setBusy(false);
        onClose();
        router.push(`/editor/${id}`);
    }, [onClose, onImported, router]);

    const dialogRef = useDialogFocus<HTMLDivElement>(open, close);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[220] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-4"
            onClick={(event) => {
                if (event.target === event.currentTarget) close();
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="linkedin-import-title"
                data-testid="linkedin-import-dialog"
                className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[1rem] border border-edge bg-surface-4 p-5 shadow-2xl sm:p-7"
            >
                <button
                    type="button"
                    onClick={close}
                    disabled={busy}
                    className="absolute right-4 top-4 text-faint transition-colors hover:text-strong disabled:opacity-40"
                    aria-label={t("linkedinImport.close")}
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="mb-5 flex items-start gap-3 pr-8">
                    <div className="rounded-xl bg-edge p-2.5">
                        <Linkedin className="h-5 w-5 text-accent" />
                    </div>
                    <div className="min-w-0">
                        <h2 id="linkedin-import-title" className="text-xl font-semibold text-strong">
                            {t("linkedinImport.title")}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-dim">
                            {t("linkedinImport.subtitle")}
                        </p>
                    </div>
                </div>

                <LinkedinImportPanel
                    onDone={done}
                    onCancel={close}
                    onBusyChange={setBusy}
                    persistResume={persistResume}
                />
            </div>
        </div>
    );
}
