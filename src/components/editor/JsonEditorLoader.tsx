"use client";
import { Component, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useResumeStore } from "@/lib/store";
import { getJsonEditorSlot, subscribeJsonEditorSlot } from "./json-editor-slot";
import dynamic from "next/dynamic";
import { useTranslation } from "@/lib/i18n";

function Loading() { const { t } = useTranslation(); return <p role="status" className="animate-pulse p-4 text-sm text-mid">{t("jsonEditor.loading")}</p>; }
const Panel = dynamic(() => import("./json/JsonEditorPanel"), { ssr: false, loading: Loading });
function LoadError() {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);
    const retry = async () => {
        setBusy(true); setSaveFailed(false);
        try {
            if (useResumeStore.getState().isSaving) await new Promise<void>(resolve => {
                const unsubscribe = useResumeStore.subscribe(state => { if (!state.isSaving) { unsubscribe(); resolve(); } });
                if (!useResumeStore.getState().isSaving) { unsubscribe(); resolve(); }
            });
            if (useResumeStore.getState().isDirty) await useResumeStore.getState().saveToDb("manual");
            // Failed module promises remain cached by browser bundlers. A fresh
            // document retries every chunk and reopens this tab without storage.
            const url = new URL(window.location.href); url.searchParams.set("json-editor", "retry");
            window.location.assign(url.href);
        } catch { setSaveFailed(true); setBusy(false); }
    };
    return <div role="alert" className="p-4 text-sm"><p>{t(saveFailed ? "jsonEditor.saveError" : "jsonEditor.loadError")}</p><button type="button" disabled={busy} onClick={() => void retry()} className="mt-3 text-accent underline">{t(busy ? "jsonEditor.loading" : "jsonEditor.retry")}</button></div>;
}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? <LoadError /> : this.props.children; }
}
export function JsonEditorLoader() {
    return <Boundary><Panel /></Boundary>;
}

/** Stable portal container survives sidebar forms, mobile panes and resizing. */
export function JsonEditorHost() {
    const active = useResumeStore(state => state.sidebarTab === "json");
    const [container, setContainer] = useState<HTMLDivElement | null>(null);
    // Allocate once on first open; the detached node is attached only in effect.
    if (active && !container && typeof document !== "undefined") {
        const next = document.createElement("div"); next.className = "flex flex-1 min-h-0 min-w-0 flex-col";
        setContainer(next);
    }
    useEffect(() => {
        if (!container) return;
        const move = (slot: HTMLDivElement | null) => { if (slot) slot.appendChild(container); else container.remove(); };
        move(getJsonEditorSlot());
        const unsubscribe = subscribeJsonEditorSlot(move);
        return () => { unsubscribe(); container.remove(); };
    }, [container]);
    return container ? createPortal(<JsonEditorLoader />, container) : null;
}
