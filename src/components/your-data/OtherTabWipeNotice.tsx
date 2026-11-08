"use client";

import { useStorageMessages } from "@/lib/storage-registry/messages";

export default function OtherTabWipeNotice() {
    const { ts } = useStorageMessages();
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-surface-2/95 p-6 backdrop-blur-md" role="alertdialog" aria-modal="true" aria-labelledby="other-tab-wipe-title" data-testid="other-tab-wipe-notice">
            <div className="max-w-md space-y-3 text-center">
                <h2 id="other-tab-wipe-title" className="text-xl font-semibold text-strong">{ts("yourData.otherTab.title")}</h2>
                <p className="text-mid">{ts("yourData.otherTab.body")}</p>
            </div>
        </div>
    );
}
