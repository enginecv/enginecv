"use client";

import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

/**
 * The offer to move CVs that are still linked to a single file into the workspace folder. Inline in the
 * first-sync dialog it only explains (the choice is on each row); as a banner in the panel it asks.
 * Nothing is moved without a click, and the old file is never touched.
 */
export function MigrationPrompt({ count, variant, busy = false, failed = 0, onMove, onLater }: {
    count: number;
    variant: "inline" | "banner";
    busy?: boolean;
    failed?: number;
    onMove?: () => void;
    onLater?: () => void;
}) {
    const { t } = useTranslation();
    if (count <= 0) return null;
    const body = t(count === 1 ? "workspace.migrate.body" : "workspace.migrate.bodyMany", { count });

    if (variant === "inline") {
        return (
            <p className="mt-2 rounded-lg border border-accent/30 bg-surface-1 px-3 py-2 text-xs text-mid" data-testid="migration-inline">
                {body}
            </p>
        );
    }
    return (
        <section aria-label={t("workspace.migrate.title")} className="rounded-xl border border-accent/30 bg-surface-1 p-3 text-sm" data-testid="migration-banner">
            <h3 className="font-bold text-strong">{t("workspace.migrate.title")}</h3>
            <p className="mt-1 text-xs text-mid">{body}</p>
            {failed > 0 && <p role="alert" className="mt-1 text-xs text-danger" data-testid="migration-failed">{t("workspace.migrate.failed", { count: failed })}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={onMove} data-testid="migration-move" className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-surface-2 hover:bg-accent-soft disabled:opacity-60">
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                    {busy ? t("workspace.migrate.working") : t("workspace.migrate.move")}
                </button>
                <button type="button" disabled={busy} onClick={onLater} data-testid="migration-later" className="rounded-lg border border-edge bg-surface-4 px-3 py-1.5 text-xs font-bold text-mid hover:border-faint hover:text-strong disabled:opacity-60">{t("workspace.migrate.later")}</button>
            </div>
        </section>
    );
}
