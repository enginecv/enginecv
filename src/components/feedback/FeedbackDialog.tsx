"use client";

import { useEffect, useMemo, useState } from "react";
import { Bug, Lightbulb, Sparkles, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
    buildFeedbackMailto,
    buildFeedbackUrl,
    type FeedbackContext,
    type FeedbackKind,
    type RedactionFlags,
} from "@/lib/feedback/buildFeedbackUrl";
import { FEEDBACK_MAILTO, FEEDBACK_REPO } from "@/lib/feedback/constants";
import { detectUserAgent } from "@/lib/feedback/userAgent";
import { APP_VERSION } from "@/lib/app-version";
import { useDialogFocus } from "@/hooks/useDialogFocus";

interface Props {
    onClose: () => void;
}

type RedactionKey = keyof RedactionFlags;

export function FeedbackDialog({ onClose }: Props) {
    const { t, locale } = useTranslation();
    const [kind, setKind] = useState<FeedbackKind | null>(null);
    const [redactions, setRedactions] = useState<RedactionFlags>({});
    const [resolvedUA, setResolvedUA] = useState<string>(() =>
        typeof navigator !== "undefined" ? navigator.userAgent : "",
    );

    useEffect(() => {
        let cancelled = false;
        detectUserAgent().then((ua) => {
            if (!cancelled && ua) setResolvedUA(ua);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const ctx = useMemo<FeedbackContext>(() => {
        if (typeof window === "undefined") {
            return { version: APP_VERSION, userAgent: "", viewport: "", route: "", locale };
        }
        return {
            version: APP_VERSION,
            userAgent: resolvedUA,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            route: window.location.pathname,
            locale,
        };
    }, [locale, resolvedUA]);

    const toggle = (key: RedactionKey) =>
        setRedactions((prev) => ({ ...prev, [key]: !prev[key] }));

    const handleOpenGithub = () => {
        if (!kind) return;
        const url = buildFeedbackUrl(kind, ctx, FEEDBACK_REPO, redactions);
        window.open(url, "_blank", "noopener");
        onClose();
    };

    const handleOpenEmail = () => {
        if (!kind) return;
        const url = buildFeedbackMailto(kind, ctx, FEEDBACK_MAILTO, redactions);
        window.location.href = url;
        onClose();
    };

    const kindCards: { id: FeedbackKind; icon: typeof Bug; label: string; desc: string }[] = [
        { id: "bug", icon: Bug, label: t("feedback.kindBug"), desc: t("feedback.kindBugDesc") },
        { id: "quirk", icon: Sparkles, label: t("feedback.kindQuirk"), desc: t("feedback.kindQuirkDesc") },
        { id: "feature", icon: Lightbulb, label: t("feedback.kindIdea"), desc: t("feedback.kindIdeaDesc") },
    ];

    const contextRows: { id: RedactionKey; label: string; value: string }[] = [
        { id: "version", label: t("feedback.fieldVersion"), value: ctx.version },
        { id: "userAgent", label: t("feedback.fieldBrowser"), value: ctx.userAgent },
        { id: "viewport", label: t("feedback.fieldViewport"), value: ctx.viewport },
        { id: "route", label: t("feedback.fieldRoute"), value: ctx.route },
        { id: "locale", label: t("feedback.fieldLocale"), value: ctx.locale },
    ];

    const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="feedback-dialog-title"
                className="relative bg-surface-4 border border-edge rounded-[1rem] p-6 max-w-xl w-full mx-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t("feedback.cancel")}
                    className="absolute top-4 right-4 text-faint hover:text-strong transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 id="feedback-dialog-title" className="text-lg font-semibold text-strong mb-1">
                    {t("feedback.dialogTitle")}
                </h2>
                <p className="text-sm text-faint mb-5 leading-relaxed">
                    {t("feedback.dialogSubtitle")}
                </p>

                {!kind ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {kindCards.map((card) => {
                            const Icon = card.icon;
                            return (
                                <button
                                    key={card.id}
                                    type="button"
                                    onClick={() => setKind(card.id)}
                                    data-testid={`feedback-kind-${card.id}`}
                                    className="text-left p-4 rounded-xl border border-edge bg-surface-1 hover:border-faint transition-colors"
                                >
                                    <Icon className="w-5 h-5 text-accent mb-2" />
                                    <p className="text-sm font-semibold text-strong">{card.label}</p>
                                    <p className="text-xs text-faint mt-1 leading-relaxed">
                                        {card.desc}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <>
                        <div className="mb-5">
                            <p className="text-xs uppercase tracking-wider text-faint mb-2">
                                {t("feedback.contextHeading")}
                            </p>
                            <p className="text-xs text-faint mb-3 leading-relaxed">
                                {t("feedback.contextDescription")}
                            </p>
                            {kind === "feature" ? (
                                <p className="text-sm text-faint p-3 rounded-lg bg-surface-1 border border-edge">
                                    {t("feedback.featureNoContext")}
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {contextRows.map((row) => (
                                        <label
                                            key={row.id}
                                            className="flex items-start gap-3 p-3 rounded-lg bg-surface-1 border border-edge cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={!redactions[row.id]}
                                                onChange={() => toggle(row.id)}
                                                className="mt-0.5 accent-accent"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-faint">{row.label}</p>
                                                <p className="text-sm text-strong truncate" title={row.value}>
                                                    {row.value || "—"}
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setKind(null)}
                                className="px-4 py-2 rounded-xl text-sm text-faint hover:text-strong hover:bg-edge transition-colors"
                            >
                                {t("feedback.back")}
                            </button>
                            <button
                                type="button"
                                onClick={handleOpenEmail}
                                className="px-4 py-2 rounded-xl text-sm text-bright hover:text-strong border border-edge hover:border-faint transition-colors"
                            >
                                {t("feedback.openEmail")}
                            </button>
                            <button
                                type="button"
                                onClick={handleOpenGithub}
                                data-testid="feedback-open-github"
                                className="px-5 py-2 rounded-xl text-sm font-medium bg-accent text-surface-2 hover:bg-accent-soft transition-colors"
                            >
                                {t("feedback.openGithub")}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
