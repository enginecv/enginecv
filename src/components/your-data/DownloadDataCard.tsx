"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/PasswordField";
import type { StorageTranslate } from "@/lib/storage-registry/messages";
import { useDataDownload } from "./useDataDownload";

export function DownloadDataCard({ ts, focusOnMount = false }: { ts: StorageTranslate; focusOnMount?: boolean }) {
    const { state, download } = useDataDownload(ts);
    const buttonRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (focusOnMount) buttonRef.current?.focus();
    }, [focusOnMount]);
    const [protect, setProtect] = useState(false);
    const [password, setPassword] = useState("");
    const busy = state.status === "preparing";

    return (
        <section aria-labelledby="your-data-download" className="space-y-4 rounded-xl border border-edge bg-surface-1 p-5" data-testid="your-data-download">
            <div className="space-y-1">
                <h2 id="your-data-download" className="text-lg font-semibold text-strong">{ts("yourData.download.title")}</h2>
                <p className="text-sm leading-6 text-mid">{ts("yourData.download.body")}</p>
            </div>

            <label className="flex items-center gap-2 text-sm text-bright">
                <input type="checkbox" checked={protect} onChange={(event) => setProtect(event.target.checked)} className="h-4 w-4 accent-accent" />
                {ts("yourData.download.protect")}
            </label>
            {protect && (
                <div className="space-y-1">
                    <PasswordField label={ts("yourData.download.password")} value={password} onChange={setPassword} autoComplete="new-password" />
                    <p className="text-xs text-faint">{ts("yourData.download.passwordHint")}</p>
                </div>
            )}

            <Button ref={buttonRef} type="button" onClick={() => void download(protect ? password : undefined)} disabled={busy || (protect && !password.trim())}>
                <Download className="h-4 w-4" aria-hidden />
                {busy ? ts("yourData.download.preparing") : ts("yourData.download.button")}
            </Button>

            <div aria-live="polite" className="text-sm">
                {state.status === "done" && <p className="text-success">{ts("yourData.download.done", { file: state.file })}</p>}
                {state.status === "failed" && (
                    <p role="alert" className="text-danger">
                        {ts("yourData.download.failed", { reason: state.reason })}{" "}
                        <button type="button" className="underline" onClick={() => void download(protect ? password : undefined)}>
                            {ts("yourData.download.retry")}
                        </button>
                    </p>
                )}
            </div>
        </section>
    );
}
