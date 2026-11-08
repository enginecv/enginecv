"use client";

import { Check, ClipboardCopy, Loader2, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { copyTextToClipboard } from "@/lib/export-clipboard";
import { useTranslation } from "@/lib/i18n";
import type { Resume } from "@/lib/schema";

type AuthoringModule = typeof import("@/lib/agent/authoring");

// Loaded when the export dialog opens, not with the editor, and ready before
// the click: Safari drops the user gesture across an await before writeText.
let modulePromise: Promise<AuthoringModule> | null = null;
function loadAuthoring() {
    modulePromise ??= import("@/lib/agent/authoring");
    return modulePromise;
}

/**
 * The CV as an `enginecv.authoring/v1` document, for pasting into a chat
 * assistant (FR-019). Sensitive personal details stay out unless the user
 * opts in (research R7). Ids are left out: nothing matches entries until #84.
 */
export function serializeForAi(authoring: AuthoringModule, resume: Resume, personal: boolean): string {
    return authoring.serializeAuthoring(authoring.resumeToAuthoring(resume, { ids: false, personal }), "pretty");
}

export function CopyForAiPanel({ resume }: { resume: Resume }) {
    const { t } = useTranslation();
    const checkboxId = useId();
    const [personal, setPersonal] = useState(false);
    const [status, setStatus] = useState<"idle" | "copying" | "copied" | "denied">("idle");
    const [fallbackText, setFallbackText] = useState("");
    const moduleRef = useRef<AuthoringModule | null>(null);
    const fallbackRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        let alive = true;
        void loadAuthoring().then((loaded) => {
            if (alive) moduleRef.current = loaded;
        }).catch(() => undefined);
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        if (status === "denied") fallbackRef.current?.select();
    }, [status]);

    const copy = async () => {
        setStatus("copying");
        // Serialize synchronously when the module is ready (the usual case).
        const authoring = moduleRef.current ?? await loadAuthoring();
        const text = serializeForAi(authoring, resume, personal);
        try {
            await copyTextToClipboard(text);
            setStatus("copied");
        } catch {
            setFallbackText(text);
            setStatus("denied");
        }
    };

    return (
        <div className="mb-4 rounded-xl border border-edge px-3 py-2.5" data-testid="export-copy-for-ai">
            <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-strong">{t("authoring.copyForAi.title")}</span>
                    <span className="block text-xs leading-relaxed text-faint">{t("authoring.copyForAi.desc")}</span>
                </span>
                <button
                    type="button"
                    onClick={() => void copy()}
                    disabled={status === "copying"}
                    data-testid="export-copy-for-ai-button"
                    className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-edge px-2.5 text-xs text-mid transition-colors hover:bg-surface-4 hover:text-strong disabled:cursor-wait disabled:opacity-50"
                >
                    {status === "copied" ? <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                        : status === "copying" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        : <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />}
                    {status === "copied" ? t("authoring.copyForAi.done") : t("authoring.copyForAi.button")}
                </button>
            </div>

            <label htmlFor={checkboxId} className="mt-2 flex cursor-pointer items-start gap-2 pl-7 text-xs text-mid">
                <input
                    id={checkboxId}
                    type="checkbox"
                    checked={personal}
                    onChange={(event) => {
                        setPersonal(event.target.checked);
                        setStatus("idle");
                    }}
                    data-testid="export-copy-for-ai-personal"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent"
                />
                <span>
                    <span className="block text-strong">{t("authoring.copyForAi.personal")}</span>
                    <span className="block leading-relaxed text-faint">{t("authoring.copyForAi.personalDesc")}</span>
                </span>
            </label>

            <p role="status" className="sr-only" data-testid="export-copy-for-ai-status">{status === "copied" ? t("authoring.copyForAi.copied") : ""}</p>

            {status === "denied" && (
                <div className="mt-3" data-testid="export-copy-for-ai-fallback">
                    <p className="mb-1.5 text-xs text-mid">{t("authoring.copyForAi.fallback")}</p>
                    <textarea
                        ref={fallbackRef}
                        readOnly
                        value={fallbackText}
                        rows={6}
                        aria-label={t("authoring.copyForAi.title")}
                        onFocus={(event) => event.currentTarget.select()}
                        className="w-full resize-y rounded-lg border border-edge bg-surface-2 px-2.5 py-2 font-mono text-[11px] leading-5 text-mid focus:outline-none"
                    />
                </div>
            )}
        </div>
    );
}
