"use client";

import { FileArchive } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { MAX_IMPORT_BYTES } from "@/lib/import/linkedin/archive";

export interface LinkedinArchiveDropZoneProps {
    onFiles: (files: File[]) => void;
    /** Called instead of onFiles when the selection exceeds the size cap. */
    onTooLarge: () => void;
}

export function LinkedinArchiveDropZone({ onFiles, onTooLarge }: LinkedinArchiveDropZoneProps) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const handleFiles = useCallback(
        (list: FileList | null) => {
            const files = Array.from(list ?? []);
            if (files.length === 0) return;
            const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
            if (totalBytes > MAX_IMPORT_BYTES) {
                onTooLarge();
                return;
            }
            onFiles(files);
        },
        [onFiles, onTooLarge],
    );

    return (
        <>
            <div
                role="button"
                tabIndex={0}
                data-testid="linkedin-drop-zone"
                aria-label={t("linkedinImport.dropZoneLabel")}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        inputRef.current?.click();
                    }
                }}
                onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(false);
                    handleFiles(event.dataTransfer.files);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                    dragOver
                        ? "border-accent bg-accent/5"
                        : "border-edge bg-surface-1 hover:border-faint"
                }`}
            >
                <FileArchive className="h-6 w-6 text-accent" />
                <p className="text-sm font-medium text-strong">{t("linkedinImport.dropZoneLabel")}</p>
                <p className="text-xs text-faint">{t("linkedinImport.dropZoneHint")}</p>
                <span className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-bright">
                    {t("linkedinImport.dropZoneBrowse")}
                </span>
            </div>
            <input
                ref={inputRef}
                type="file"
                accept=".zip,.csv"
                multiple
                data-testid="linkedin-file-input"
                // Opened through the drop zone button and kept outside it, out of the tab
                // order and accessibility tree, so the button stays the only control.
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                onChange={(event) => {
                    handleFiles(event.target.files);
                    event.target.value = "";
                }}
            />
        </>
    );
}
