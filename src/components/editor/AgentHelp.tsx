"use client";

import { Check, ClipboardCopy } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { copyTextToClipboard } from "@/lib/export-clipboard";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { SKILL_URL } from "@/lib/agent/authoring/skill-urls";
import { isLinkingSupported } from "@/lib/workspace/fs-access";

type CopyKind = "install" | "prompt";

/**
 * Three steps for using a local AI agent on a CV file: link, tell the agent,
 * see the result. Works with a linked file where the browser supports it and
 * with export and import everywhere else.
 */
export function AgentHelp({ filePath }: { filePath?: string }) {
    const { t } = useTranslation();
    const headingId = useId();
    const [copied, setCopied] = useState<CopyKind | null>(null);
    const [fallback, setFallback] = useState<string | null>(null);
    const fallbackRef = useRef<HTMLTextAreaElement>(null);
    const supported = isLinkingSupported();

    const prompt = t("linkedFile.agentHelp.prompt", {
        url: SKILL_URL,
        path: filePath ?? t("linkedFile.agentHelp.pathPlaceholder"),
    });

    useEffect(() => {
        if (fallback !== null) fallbackRef.current?.select();
    }, [fallback]);

    const copy = async (kind: CopyKind, text: string) => {
        try {
            await copyTextToClipboard(text);
            setFallback(null);
            setCopied(kind);
        } catch {
            setCopied(null);
            setFallback(text);
        }
    };

    const buttonClass =
        "flex h-8 shrink-0 items-center gap-2 rounded-lg border border-edge px-2.5 text-xs text-mid transition-colors hover:bg-surface-4 hover:text-strong";

    return (
        <section aria-labelledby={headingId} className="space-y-3" data-testid="agent-help">
            <h3 id={headingId} className="text-sm font-medium text-strong">{t("linkedFile.agentHelp.title")}</h3>

            {!supported && <p className="text-xs leading-relaxed text-faint" data-testid="agent-help-no-linking">{t("linkedFile.agentHelp.noLinking")}</p>}

            <ol className="space-y-3 text-xs leading-relaxed text-mid">
                <li>
                    <span className="block font-medium text-strong">{t("linkedFile.agentHelp.step1.title")}</span>
                    {t("linkedFile.agentHelp.step1.text")}
                </li>
                <li>
                    <span className="block font-medium text-strong">{t("linkedFile.agentHelp.step2.title")}</span>
                    {t("linkedFile.agentHelp.step2.text")}
                    <span className="mt-1.5 block text-faint">{t("linkedFile.agentHelp.installLabel")}</span>
                    <code className="mt-0.5 block break-all rounded-md bg-surface-2 px-2 py-1 font-mono text-[11px]">{SKILL_URL}</code>
                    <span className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void copy("install", SKILL_URL)} className={buttonClass} data-testid="agent-help-copy-install">
                            {copied === "install" ? <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> : <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />}
                            {t("linkedFile.agentHelp.copyInstall")}
                        </button>
                        <button type="button" onClick={() => void copy("prompt", prompt)} className={buttonClass} data-testid="agent-help-copy-prompt">
                            {copied === "prompt" ? <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> : <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />}
                            {t("linkedFile.agentHelp.copyPrompt")}
                        </button>
                    </span>
                </li>
                <li>
                    <span className="block font-medium text-strong">{t("linkedFile.agentHelp.step3.title")}</span>
                    {t("linkedFile.agentHelp.step3.text")}
                </li>
            </ol>

            <p role="status" className="sr-only" data-testid="agent-help-status">{copied ? t("linkedFile.agentHelp.copied") : ""}</p>

            <p className="text-xs">
                <Link href="/linked-files" target="_blank" rel="noopener" className="text-accent underline-offset-2 hover:underline" data-testid="agent-help-how-it-works">
                    {t("linkedFile.howItWorks")}
                </Link>
            </p>

            {fallback !== null && (
                <div data-testid="agent-help-fallback">
                    <p className="mb-1.5 text-xs text-mid">{t("linkedFile.agentHelp.copyFailed")}</p>
                    <textarea
                        ref={fallbackRef}
                        readOnly
                        value={fallback}
                        rows={4}
                        aria-label={t("linkedFile.agentHelp.title")}
                        onFocus={(event) => event.currentTarget.select()}
                        className="w-full resize-y rounded-lg border border-edge bg-surface-2 px-2.5 py-2 font-mono text-[11px] leading-5 text-mid focus:outline-none"
                    />
                </div>
            )}
        </section>
    );
}
