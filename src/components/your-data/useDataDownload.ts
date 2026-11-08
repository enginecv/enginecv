"use client";

import { useCallback, useState } from "react";
import { APP_VERSION } from "@/lib/app-version";
import { createEncryptedJsonExport, downloadBlob } from "@/lib/export";
import { useTranslation } from "@/lib/i18n";
import { buildDataExport, dataExportFileName } from "@/lib/storage-registry/export-file";
import { collectInventory } from "@/lib/storage-registry/inventory";
import type { StorageTranslate } from "@/lib/storage-registry/messages";

export type DownloadState =
    | { status: "idle" }
    | { status: "preparing" }
    | { status: "done"; file: string }
    | { status: "failed"; reason: string };

/** Builds and saves the "Download my data" file; shared by the page card and the delete dialog. */
export function useDataDownload(ts: StorageTranslate) {
    const { t, locale } = useTranslation();
    const [state, setState] = useState<DownloadState>({ status: "idle" });

    const download = useCallback(async (password?: string): Promise<boolean> => {
        setState({ status: "preparing" });
        try {
            // Read fresh, so the file matches the browser at the moment of download.
            const inventory = await collectInventory();
            const now = new Date();
            const file = buildDataExport(inventory, { ts, locale, appVersion: APP_VERSION, origin: window.location.origin, now });
            const payload = password
                ? await createEncryptedJsonExport(file, password, {
                    secureEncryptedExportUnavailable: t("export.secureEncryptedExportUnavailable"),
                    encryptionKeyRequired: t("export.encryptionKeyRequired"),
                })
                : file;
            const name = dataExportFileName(now);
            downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), name);
            setState({ status: "done", file: name });
            return true;
        } catch (error) {
            setState({ status: "failed", reason: error instanceof Error ? error.message : "" });
            return false;
        }
    }, [locale, t, ts]);

    return { state, download };
}
