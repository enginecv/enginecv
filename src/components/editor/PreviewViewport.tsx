"use client";

import { Maximize, Minimize, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PREVIEW_PAGE_GAP_PX } from "@/components/editor/preview/preview-constants";
import { useTranslation } from "@/lib/i18n";
import { clampPan, computePanBounds } from "@/lib/preview/pan-bounds";
import { useClientPreferencesStore } from "@/lib/preferences/store";

/**
 * The viewport of the document preview, as the CV editor has it: pages scaled to fit the pane,
 * zoom (buttons or Ctrl/Cmd + wheel, remembered between visits), panning (middle mouse button, or
 * Space + drag), a fullscreen mode closed with Escape or a click outside the page, and the same
 * hover controls. It knows nothing about what the pages hold, so a cover letter uses it unchanged.
 *
 * The CV preview carries the same behavior inline in `ResumePreview`, a 4,500-line component that
 * also renders the resume itself; this is that viewport on its own, with the same limits, step,
 * persisted preference and translations.
 */

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.15;
const BASE_SCALE_EPSILON = 1e-4;

// 0.15 is not exact in binary, so stepping repeatedly drifts and the drifted value would be saved.
const clampZoom = (value: number) => Math.round(Math.min(Math.max(value, ZOOM_MIN), ZOOM_MAX) * 100) / 100;

export function PreviewViewport({ paperWidth, paperHeight, pageCount, onResize, children }: {
    paperWidth: number;
    paperHeight: number;
    pageCount: number;
    /** Called when the pane gets a size (it is 0 while hidden), so pages can be re-cut then. */
    onResize?: () => void;
    /** Receives the scale to draw the pages at (fit-to-pane times zoom); apply it as CSS `zoom`. */
    children: (scale: number) => ReactNode;
}) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const [baseScale, setBaseScale] = useState(1);
    const [fullscreen, setFullscreen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [hasRestoredPreferredZoom, setHasRestoredPreferredZoom] = useState(false);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const panRef = useRef({ x: 0, y: 0 });
    const isPanning = useRef(false);
    const didDrag = useRef(false);
    const spaceHeld = useRef(false);
    const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const isMobile = useRef(false);
    const viewportRef = useRef({ width: 0, height: 0 });
    const contentSizeRef = useRef({ width: 0, height: 0 });
    const onResizeRef = useRef(onResize);
    useEffect(() => {
        onResizeRef.current = onResize;
    }, [onResize]);

    const preferencesHydrated = useClientPreferencesStore((state) => state.hydrated);
    const preferredZoom = useClientPreferencesStore((state) => state.preferences.preview.zoom);
    const updateClientPreferenceSection = useClientPreferencesStore((state) => state.updateSection);

    const scale = baseScale * zoom;

    useEffect(() => {
        isMobile.current = window.innerWidth < 1024 || "ontouchstart" in window;
    }, []);

    const resetPan = useCallback(() => {
        const origin = { x: 0, y: 0 };
        panRef.current = origin;
        setPan(origin);
    }, []);

    const resetView = useCallback(() => {
        setZoom(1);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- recentre when the paper geometry changes
        resetPan();
    }, [resetPan]);

    const zoomIn = useCallback(() => setZoom((value) => clampZoom(value + ZOOM_STEP)), []);
    const zoomOut = useCallback(() => setZoom((value) => clampZoom(value - ZOOM_STEP)), []);
    const isZoomedOrPanned = zoom !== 1 || pan.x !== 0 || pan.y !== 0;

    // Ctrl/Cmd + wheel zooms (desktop only).
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const handleWheel = (event: WheelEvent) => {
            if (isMobile.current) return;
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            setZoom((value) => clampZoom(value + (event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)));
        };
        container.addEventListener("wheel", handleWheel, { passive: false });
        return () => container.removeEventListener("wheel", handleWheel);
    }, [fullscreen]);

    useEffect(() => {
        panRef.current = pan;
    }, [pan]);

    // The saved zoom only seeds the session; after that the local value owns it and is written back.
    useEffect(() => {
        if (!preferencesHydrated || hasRestoredPreferredZoom) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore once persisted preferences hydrate
        setZoom(preferredZoom);
        setHasRestoredPreferredZoom(true);
    }, [hasRestoredPreferredZoom, preferencesHydrated, preferredZoom]);

    useEffect(() => {
        if (!hasRestoredPreferredZoom || zoom === preferredZoom) return;
        updateClientPreferenceSection("preview", { zoom });
    }, [hasRestoredPreferredZoom, preferredZoom, updateClientPreferenceSection, zoom]);

    // Pan with the middle mouse button, or Space + left drag. Left click stays free for the page.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseDown = (event: MouseEvent) => {
            if (isMobile.current) return;
            const isMiddle = event.button === 1;
            const isSpaceLeft = event.button === 0 && spaceHeld.current;
            if (!isMiddle && !isSpaceLeft) return;
            if ((event.target as HTMLElement).closest("button, a, input, [data-no-drag]")) return;
            isPanning.current = true;
            didDrag.current = false;
            panStart.current = { x: event.clientX, y: event.clientY, panX: panRef.current.x, panY: panRef.current.y };
            container.style.cursor = "grabbing";
            event.preventDefault();
        };
        const handleMouseMove = (event: MouseEvent) => {
            if (!isPanning.current) return;
            const dx = event.clientX - panStart.current.x;
            const dy = event.clientY - panStart.current.y;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
            const bounds = computePanBounds(viewportRef.current, contentSizeRef.current);
            const next = clampPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy }, bounds);
            panRef.current = next;
            setPan(next);
        };
        const handleMouseUp = () => {
            if (!isPanning.current) return;
            isPanning.current = false;
            container.style.cursor = spaceHeld.current ? "grab" : "";
        };
        // A middle-button click would otherwise autoscroll or open links.
        const handleAuxClick = (event: MouseEvent) => {
            if (event.button === 1) event.preventDefault();
        };

        container.addEventListener("mousedown", handleMouseDown);
        container.addEventListener("auxclick", handleAuxClick);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            container.removeEventListener("mousedown", handleMouseDown);
            container.removeEventListener("auxclick", handleAuxClick);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [fullscreen]);

    // Holding Space turns on pan mode (ignored while typing).
    useEffect(() => {
        const isTypingTarget = (element: EventTarget | null) => {
            const node = element as HTMLElement | null;
            return Boolean(node && (node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.isContentEditable));
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.code !== "Space" || spaceHeld.current || isTypingTarget(event.target)) return;
            spaceHeld.current = true;
            if (containerRef.current && !isPanning.current) containerRef.current.style.cursor = "grab";
        };
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.code !== "Space") return;
            spaceHeld.current = false;
            if (containerRef.current && !isPanning.current) containerRef.current.style.cursor = "";
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);

    // Fit the page to the pane: observe its size and compute the base scale.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const updateScale = () => {
            const padding = fullscreen ? 80 : 48;
            const { width, height } = container.getBoundingClientRect();
            viewportRef.current = { width, height };
            const next = Math.round(Math.min((width - padding) / paperWidth, (height - padding) / paperHeight, 1) * 1000) / 1000;
            // Quantised so a scrollbar appearing and disappearing cannot keep the observer firing.
            setBaseScale((previous) => (Math.abs(previous - next) < BASE_SCALE_EPSILON ? previous : next));

            const bounds = computePanBounds(viewportRef.current, contentSizeRef.current);
            const clamped = clampPan(panRef.current, bounds);
            if (clamped.x !== panRef.current.x || clamped.y !== panRef.current.y) {
                panRef.current = clamped;
                setPan(clamped);
            }
            if (width > 0) onResizeRef.current?.();
        };
        const observer = new ResizeObserver(updateScale);
        observer.observe(container);
        updateScale();
        return () => observer.disconnect();
    }, [paperWidth, paperHeight, fullscreen]);

    // Keep the saved zoom while recentring for geometry changes.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- recentre when the paper geometry changes
        resetPan();
    }, [fullscreen, paperWidth, paperHeight, resetPan]);

    useEffect(() => {
        contentSizeRef.current = {
            width: paperWidth * scale,
            height: paperHeight * scale * pageCount + PREVIEW_PAGE_GAP_PX * (pageCount - 1),
        };
        const bounds = computePanBounds(viewportRef.current, contentSizeRef.current);
        const clamped = clampPan(panRef.current, bounds);
        if (clamped.x !== panRef.current.x || clamped.y !== panRef.current.y) {
            panRef.current = clamped;
            setPan(clamped);
        }
    }, [paperWidth, paperHeight, scale, pageCount]);

    // Escape closes fullscreen.
    useEffect(() => {
        if (!fullscreen) return;
        const handler = (event: KeyboardEvent) => {
            if (event.key === "Escape") setFullscreen(false);
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [fullscreen]);

    const toggleFullscreen = useCallback(() => setFullscreen((value) => !value), []);
    const zoomPercent = Math.round(zoom * 100);

    const controlClass = (extra = "") => `p-2.5 rounded-xl transition-all cursor-pointer ${extra} ${
        fullscreen ? "bg-surface-4 border border-edge text-strong/70 hover:text-strong hover:bg-edge" : "bg-surface-4/90 backdrop-blur-md border border-edge text-faint hover:text-strong"
    }`;

    const controlButtons = (
        <div className={`sticky top-0 z-50 flex justify-end pointer-events-none p-4 print:hidden ${fullscreen ? "" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"} transition-opacity`}>
            <div className="flex items-center gap-1.5 pointer-events-auto">
                {/* Zoom controls: hidden on mobile */}
                <div className="hidden lg:flex items-center gap-1.5">
                    {isZoomedOrPanned && (
                        <button type="button" onClick={resetView} className={controlClass()} title={t("preview.resetZoom")} aria-label={t("preview.resetZoom")} data-testid="preview-reset-zoom">
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    )}
                    <button type="button" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} className={controlClass("disabled:opacity-30 disabled:cursor-not-allowed")} title={t("preview.zoomOut")} aria-label={t("preview.zoomOut")} data-testid="preview-zoom-out">
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className={`text-xs tabular-nums min-w-[3ch] text-center select-none ${fullscreen ? "text-strong/50" : "text-faint"}`} data-testid="preview-zoom-percent">
                        {zoomPercent}%
                    </span>
                    <button type="button" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} className={controlClass("disabled:opacity-30 disabled:cursor-not-allowed")} title={t("preview.zoomIn")} aria-label={t("preview.zoomIn")} data-testid="preview-zoom-in">
                        <ZoomIn className="w-4 h-4" />
                    </button>
                </div>
                <button type="button" onClick={toggleFullscreen} className={controlClass()} title={fullscreen ? t("preview.exitFullscreen") : t("preview.fullscreen")} aria-label={fullscreen ? t("preview.exitFullscreen") : t("preview.fullscreen")} data-testid="preview-fullscreen">
                    {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );

    const content = (
        <div
            className="flex flex-col items-center print-exact-scroll-wrapper py-6 gap-8"
            style={{ minHeight: "100%", transform: `translate(${pan.x}px, ${pan.y}px)`, willChange: "transform", contain: "layout style" }}
        >
            {children(scale)}
        </div>
    );

    if (fullscreen) {
        return (
            <>
                {/* Keep the inline container so the panel layout doesn't collapse */}
                <div className="w-full h-full" />

                {/* Fullscreen overlay */}
                <div
                    ref={containerRef}
                    className="fixed inset-0 z-[100] bg-surface-2 overflow-auto print:hidden"
                    data-testid="preview-viewport"
                    onClick={(event) => {
                        // A click on the backdrop (not on the page) exits fullscreen, but not after dragging.
                        if (event.target === event.currentTarget && !didDrag.current) setFullscreen(false);
                    }}
                >
                    {controlButtons}
                    {content}
                </div>
            </>
        );
    }

    return (
        <div ref={containerRef} className="w-full h-full overflow-auto group relative print:overflow-visible print:block" data-testid="preview-viewport">
            {controlButtons}
            {content}
        </div>
    );
}
