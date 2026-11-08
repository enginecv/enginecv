"use client";

import { useEffect, useRef } from "react";
import { Globe, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { START_PATHS, type StartPathId } from "@/lib/onboarding/start-paths";

const LAYOUT_CLASS = {
    grid: "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
    stack: "space-y-3",
} as const;

/** The start paths as buttons; rendered by the start panel and the create dialog. */
export function StartOptions({
    onSelect,
    layout,
    testIdPrefix,
    testIds,
    focusId,
    pendingId,
    disabled = false,
}: {
    onSelect: (id: StartPathId) => void;
    layout: keyof typeof LAYOUT_CLASS;
    /** Test id of each button is `${testIdPrefix}-${id}` unless `testIds` overrides it. */
    testIdPrefix: string;
    testIds?: Partial<Record<StartPathId, string>>;
    /** Focused once on mount (a `?start=json` link cannot open a file picker by itself). */
    focusId?: StartPathId | null;
    /** The option whose action is running; it shows a spinner. */
    pendingId?: StartPathId | null;
    disabled?: boolean;
}) {
    const { t } = useTranslation();
    const focusRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (focusId) focusRef.current?.focus();
    }, [focusId]);

    return (
        <ul className={LAYOUT_CLASS[layout]}>
            {START_PATHS.map((path) => {
                const Icon = pendingId === path.id ? Loader2 : path.icon;
                return (
                    <li key={path.id} className="flex">
                        <button
                            ref={path.id === focusId ? focusRef : undefined}
                            type="button"
                            onClick={() => onSelect(path.id)}
                            disabled={disabled}
                            aria-busy={pendingId === path.id || undefined}
                            data-testid={testIds?.[path.id] ?? `${testIdPrefix}-${path.id}`}
                            className="group flex w-full items-start gap-4 rounded-xl border border-edge bg-surface-1 p-4 text-left transition-all hover:border-faint hover:bg-edge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <span className="shrink-0 rounded-xl bg-edge p-2.5 transition-colors group-hover:bg-accent/20">
                                <Icon
                                    className={`h-5 w-5 text-faint transition-colors group-hover:text-accent${pendingId === path.id ? " animate-spin" : ""}`}
                                    aria-hidden="true"
                                />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-strong">{t(path.titleKey)}</span>
                                <span className="block text-xs text-faint">{t(path.hintKey)}</span>
                                {path.needsNetwork && (
                                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-faint">
                                        <Globe className="h-3 w-3" aria-hidden="true" />
                                        {t("onboarding.option.needsInternet")}
                                    </span>
                                )}
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
