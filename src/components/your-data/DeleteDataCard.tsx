"use client";

import { Radiation } from "lucide-react";
import { useState } from "react";
import type { StorageTranslate } from "@/lib/storage-registry/messages";
import { LazyDeleteAllDataDialog } from "./LazyDeleteAllDataDialog";

export function DeleteDataCard({ ts, initiallyOpen = false }: { ts: StorageTranslate; initiallyOpen?: boolean }) {
    const [open, setOpen] = useState(initiallyOpen);
    return (
        <section aria-labelledby="your-data-delete" className="space-y-4 rounded-xl border border-danger/30 bg-surface-1 p-5" data-testid="your-data-delete">
            <div className="space-y-1">
                <h2 id="your-data-delete" className="text-lg font-semibold text-strong">{ts("yourData.delete.title")}</h2>
                <p className="text-sm leading-6 text-mid">{ts("yourData.delete.body")}</p>
            </div>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-danger/40 bg-danger-tint px-5 text-sm font-medium text-danger-soft transition-colors hover:border-danger"
            >
                <Radiation className="h-4 w-4" aria-hidden />
                {ts("yourData.delete.button")}
            </button>
            {open && <LazyDeleteAllDataDialog open={open} onClose={() => setOpen(false)} />}
        </section>
    );
}
