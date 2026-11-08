"use client";

import { Github, ShieldCheck, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import type { ImportProvider } from "@/lib/import/provider";
import type { Resume } from "@/lib/schema";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { GithubImportPanel } from "./GithubImportPanel";

export interface GithubImportDialogProps {
    open: boolean;
    onClose: () => void;
    provider?: ImportProvider;
    /**
     * Provider for confirm-on-type preview lookups. Defaults to `provider`
     * when given (tests), otherwise a dedicated instance per dialog session
     * so previews never consume the import's request budget.
     */
    previewProvider?: ImportProvider;
    persistResume?: (resume: Resume) => Promise<string>;
    onImported?: (id: string) => void;
}

export function GithubImportDialog({
    open,
    onClose,
    provider,
    previewProvider,
    persistResume,
    onImported,
}: GithubImportDialogProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    // Closing unmounts the panel, so reopening starts clean and late
    // responses from the closed session are dropped.
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
                aria-labelledby="github-import-title"
                data-testid="github-import-dialog"
                className="relative w-full max-w-2xl rounded-[1rem] border border-edge bg-surface-4 p-5 shadow-2xl sm:p-7"
            >
                <button
                    type="button"
                    onClick={close}
                    disabled={busy}
                    className="absolute right-4 top-4 text-faint transition-colors hover:text-strong disabled:opacity-40"
                    aria-label={t("githubImport.close")}
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="mb-5 flex items-start gap-3 pr-8">
                    <div className="rounded-xl bg-edge p-2.5">
                        <Github className="h-5 w-5 text-accent" />
                    </div>
                    <div className="min-w-0">
                        <h2 id="github-import-title" className="text-xl font-semibold text-strong">
                            {t("githubImport.title")}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-dim">
                            {t("githubImport.subtitle")}
                        </p>
                    </div>
                </div>

                <p data-testid="github-import-network-notice" className="mb-5 flex gap-2 rounded-xl border border-edge bg-surface-1 p-3 text-xs leading-5 text-mid">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {t("githubImport.networkNotice")}
                </p>

                <GithubImportPanel
                    onDone={done}
                    onCancel={close}
                    onBusyChange={setBusy}
                    provider={provider}
                    previewProvider={previewProvider}
                    persistResume={persistResume}
                />
            </div>
        </div>
    );
}
