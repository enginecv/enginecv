"use client";

import { useEffect, useRef, useState } from "react";
import { ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { declineExportRating, submitExportComment, submitExportRating, useExportRatingPromptStore } from "@/lib/preferences/export-support";
import { MAX_COMMENT_LENGTH, type ExportRatingValue } from "@/lib/analytics/export-event";
import type { ResumeExportFormat } from "@/lib/export-formats";

const BUTTON =
    "inline-flex h-8 items-center gap-1.5 rounded-lg border border-edge px-3 text-xs font-semibold text-bright transition-colors hover:bg-surface-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const QUIET_BUTTON =
    "inline-flex h-8 items-center rounded-lg px-3 text-xs text-mid transition-colors hover:bg-surface-4 hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/**
 * Optional, non-blocking "how was that export?" card. Step one is a one-tap thumb,
 * counted anonymously (format and answer) the moment it is tapped. Step two is an
 * optional short comment. A live region, not a dialog: it never takes focus on its
 * own; focus moves to the comment box only after the person tapped a thumb, because
 * the button they pressed has just gone.
 */
export function ExportRatingCard() {
    const format = useExportRatingPromptStore((state) => state.format);

    return (
        <div role="status" aria-live="polite" className="print:hidden">
            {format && <RatingCardBody format={format} />}
        </div>
    );
}

/** Unmounts when the card is hidden, so each new card starts again at the thumbs. */
function RatingCardBody({ format }: { format: ResumeExportFormat }) {
    const { t } = useTranslation();
    const hide = useExportRatingPromptStore((state) => state.hide);
    const [answer, setAnswer] = useState<ExportRatingValue | null>(null);
    const [comment, setComment] = useState("");
    const commentRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (answer) commentRef.current?.focus();
    }, [answer]);

    const rate = (rating: ExportRatingValue) => {
        submitExportRating(rating, format);
        setAnswer(rating);
    };

    const sendComment = () => {
        if (answer) submitExportComment(answer, format, comment);
        hide();
    };

    return (
        <div
            data-testid="export-rating-card"
            className="fixed bottom-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-edge bg-surface-3 p-4 shadow-lg"
        >
            <div className="flex items-start gap-3">
                {answer ? (
                    <label htmlFor="export-rating-comment" className="text-sm leading-6 text-bright">
                        {t("export.ratingPrompt.commentLabel")}
                    </label>
                ) : (
                    <p className="text-sm leading-6 text-bright">{t("export.ratingPrompt.message")}</p>
                )}
                <button
                    type="button"
                    onClick={hide}
                    aria-label={t("export.ratingPrompt.close")}
                    data-testid="export-rating-close"
                    className="-mr-1 -mt-1 rounded-md p-1 text-faint transition-colors hover:bg-surface-4 hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
            {answer ? (
                <div className="mt-3">
                    <textarea
                        id="export-rating-comment"
                        ref={commentRef}
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        maxLength={MAX_COMMENT_LENGTH}
                        rows={3}
                        aria-describedby="export-rating-comment-hint"
                        data-testid="export-rating-comment"
                        className="w-full resize-none rounded-lg border border-edge bg-surface-2 p-2 text-sm text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    />
                    <p id="export-rating-comment-hint" className="mt-1 text-xs leading-relaxed text-faint">
                        {t("export.ratingPrompt.commentHint")}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button type="button" onClick={sendComment} disabled={comment.trim() === ""} data-testid="export-rating-comment-send" className={`${BUTTON} disabled:opacity-50`}>
                            {t("export.ratingPrompt.commentSend")}
                        </button>
                        <button type="button" onClick={hide} data-testid="export-rating-comment-skip" className={QUIET_BUTTON}>
                            {t("export.ratingPrompt.commentSkip")}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => rate("up")} data-testid="export-rating-up" className={BUTTON}>
                        <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                        {t("export.ratingPrompt.up")}
                    </button>
                    <button type="button" onClick={() => rate("down")} data-testid="export-rating-down" className={BUTTON}>
                        <ThumbsDown className="h-4 w-4" aria-hidden="true" />
                        {t("export.ratingPrompt.down")}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            declineExportRating();
                            hide();
                        }}
                        data-testid="export-rating-dismiss"
                        className={QUIET_BUTTON}
                    >
                        {t("export.ratingPrompt.dontAskAgain")}
                    </button>
                </div>
            )}
        </div>
    );
}
