"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";
import type { Resume } from "@/lib/schema";

const PAPER = {
    a4: { width: 794, height: 1123 },
    letter: { width: 816, height: 1056 },
} as const;

/** The preview box keeps the paper's proportions so the swap from skeleton to preview moves nothing. */
function PaperBox({ paperSize, children, testId }: { paperSize: keyof typeof PAPER; children?: ReactNode; testId?: string }) {
    const paper = PAPER[paperSize];
    return (
        <div
            data-testid={testId}
            className="relative w-full overflow-hidden rounded-xl border border-edge-strong bg-surface-1"
            style={{ aspectRatio: `${paper.width} / ${paper.height}` }}
        >
            {children}
        </div>
    );
}

/*
 * The preview is the real resume renderer, which pulls in most of the editor
 * (store, IndexedDB, country picker, markdown). It only renders in the browser
 * and stays out of the page's first JavaScript, like the landing demo.
 */
const ResumePreview = dynamic(() => import("@/components/editor/ResumePreview").then((module) => module.ResumePreview), {
    ssr: false,
    loading: () => null,
});

class PreviewBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: unknown) {
        console.error("[EngineCV] Role example preview failed.", error);
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

/** Live preview of an example CV, scaled to the container. The CV text is also on the page, so a failure here costs nothing. */
export function ExamplePreview({ resume, paperSize }: { resume: Resume; paperSize: keyof typeof PAPER }) {
    const { t } = useTranslation();
    const paper = PAPER[paperSize];
    const boxRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState<number | null>(null);

    useEffect(() => {
        const element = boxRef.current;
        if (!element) return;
        const measure = () => setScale(element.clientWidth / paper.width);
        measure();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, [paper.width]);

    const failed = (
        <p role="status" data-testid="role-example-preview-failed" className="rounded-xl border border-edge bg-surface-3 p-4 text-sm text-mid">
            {t("roleExamples.previewFailed")}
        </p>
    );

    return (
        <PreviewBoundary fallback={failed}>
            <div ref={boxRef} data-testid="role-example-preview" aria-hidden="true">
                <PaperBox paperSize={paperSize}>
                    {scale === null ? (
                        <p className="p-4 text-sm text-faint">{t("roleExamples.previewLoading")}</p>
                    ) : (
                        <div
                            className="absolute left-0 top-0 origin-top-left"
                            style={{ width: paper.width, height: paper.height, transform: `scale(${scale})` }}
                        >
                            <ResumePreview resumeOverride={resume} paperSizeOverride={paperSize} thumbnailMode />
                        </div>
                    )}
                </PaperBox>
            </div>
        </PreviewBoundary>
    );
}
