"use client";

import { CheckCircle2, TriangleAlert } from "lucide-react";
import type { StorageTranslate } from "@/lib/storage-registry/messages";
import type { DeletionResult } from "@/lib/storage-registry/wipe";

export function DeletionResultView({ result, ts, onRetry }: { result: DeletionResult; ts: StorageTranslate; onRetry: () => void }) {
    const complete = result.status === "complete";
    return (
        <div className="space-y-4" data-testid="deletion-result" data-status={result.status}>
            <div className={`flex items-start gap-3 ${complete ? "text-success" : "text-warning"}`} role="status">
                {complete ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /> : <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />}
                <p className="font-semibold">{ts(complete ? "yourData.result.complete" : "yourData.result.partial")}</p>
            </div>

            {result.remaining.length > 0 && (
                <div className="space-y-2 text-sm">
                    <p className="font-medium text-strong">{ts("yourData.result.remaining")}</p>
                    <ul className="space-y-1 pl-5 text-mid list-disc">
                        {result.remaining.map((item) => (
                            <li key={`${item.location}:${item.name}`}>
                                <code className="text-strong">{item.name}</code>: {ts(`yourData.result.reason.${item.reason}`)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <p className="text-sm text-mid">{ts(`yourData.result.server.${result.serverClear}`)}</p>

            {result.mayRemain.length > 0 && (
                <div className="space-y-2 text-sm">
                    <p className="font-medium text-strong">{ts("yourData.result.mayRemain")}</p>
                    <ul className="space-y-1 pl-5 text-mid list-disc">
                        {result.mayRemain.map((entry) => (
                            <li key={entry.id}>
                                <code className="text-strong">{entry.name}</code>: {ts(`storage.how.${entry.removable}`)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                {!complete && (
                    <button type="button" onClick={onRetry} className="rounded-xl border border-edge px-4 py-2 text-sm font-medium text-strong hover:border-faint">
                        {ts("yourData.result.retry")}
                    </button>
                )}
                <button
                    type="button"
                    // A full navigation, so the app starts again as on a first visit.
                    onClick={() => window.location.assign("/")}
                    className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-surface-1 hover:bg-accent-soft"
                    data-autofocus
                >
                    {ts("yourData.result.continue")}
                </button>
            </div>
        </div>
    );
}
