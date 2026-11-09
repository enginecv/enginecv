"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

/* Heights match the rendered demo at each breakpoint, so the swap causes no layout shift. */
function DemoPlaceholder() {
    return (
        <div
            data-testid="landing-demo-placeholder"
            aria-hidden="true"
            className="h-[776px] min-w-0 rounded-xl border border-edge-strong bg-surface-1 sm:h-[670px] lg:h-[720px]"
        />
    );
}

/*
 * The demo renders the real resume preview, which pulls in most of the editor
 * (store, IndexedDB, country picker, design overlay, markdown). Keeping it out
 * of the landing bundle keeps that JavaScript off the LCP critical path.
 */
const LandingWorkbenchDemo = dynamic(
    () => import("./LandingWorkbenchDemo").then((module) => module.LandingWorkbenchDemo),
    { ssr: false, loading: DemoPlaceholder },
);

/**
 * Loads the hero demo once a fifth of it is on screen. On phones it sits below
 * the hero text, so it never competes with the first paint.
 */
export function LazyWorkbenchDemo() {
    const placeholderRef = useRef<HTMLDivElement>(null);
    const [shouldLoad, setShouldLoad] = useState(false);

    useEffect(() => {
        if (shouldLoad) return;
        const load = () => setShouldLoad(true);

        const element = placeholderRef.current;
        if (!element || typeof IntersectionObserver === "undefined") {
            load();
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) load();
            },
            // On phones the demo's top edge peeks above the fold; wait for a real scroll.
            { threshold: 0.2 },
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [shouldLoad]);

    if (shouldLoad) return <LandingWorkbenchDemo />;

    return (
        <div ref={placeholderRef} className="min-w-0">
            <DemoPlaceholder />
        </div>
    );
}
