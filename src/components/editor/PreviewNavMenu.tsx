"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CornerUpRight, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface PreviewNavMenuProps {
    x: number;
    y: number;
    kind: string;
    onGo: () => void;
    onCustomize?: () => void;
    onClose: () => void;
}

/**
 * Small element-selection menu opened by clicking an element in the live
 * preview. Rendered to document.body so it escapes the zoomed/panned page.
 */
export function PreviewNavMenu({ x, y, kind, onGo, onCustomize, onClose }: PreviewNavMenuProps) {
    const { t } = useTranslation();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        const onScroll = () => onClose();
        window.addEventListener("keydown", onKey);
        // Capture scrolls on any ancestor so the menu doesn't detach from the page.
        window.addEventListener("scroll", onScroll, true);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", onScroll, true);
        };
    }, [onClose]);

    if (typeof document === "undefined") return null;

    const left = Math.min(x, window.innerWidth - 220);
    const top = Math.min(y, window.innerHeight - 90);

    return createPortal(
        <>
            <div className="fixed inset-0 z-[130]" onMouseDown={onClose} />
            <div
                className="fixed z-[131] min-w-[190px] rounded-xl border border-edge bg-surface-1 p-1.5 shadow-xl"
                style={{ left, top }}
            >
                <button
                    type="button"
                    onClick={onGo}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-strong hover:bg-edge transition-colors"
                >
                    <CornerUpRight className="w-4 h-4 text-accent shrink-0" />
                    {kind === "heading" ? t("editor.goToSection") : t("editor.goToEntry")}
                </button>
                {onCustomize ? (
                    <button
                        type="button"
                        onClick={onCustomize}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-strong hover:bg-edge transition-colors"
                    >
                        <SlidersHorizontal className="w-4 h-4 text-accent shrink-0" />
                        {t("editor.customizeSection")}
                    </button>
                ) : null}
            </div>
        </>,
        document.body,
    );
}
