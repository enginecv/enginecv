"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ResumePreview } from "@/components/editor/ResumePreview";
import { ResumeThumbnail } from "./ResumeThumbnail";
import type { Resume } from "@/lib/schema";

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;

interface LiveResumeThumbnailProps {
    resume: Resume;
    paperSize?: "a4" | "letter";
}

/**
 * Renders a scaled-down resume page inside a responsive container.
 *
 * Performance notes:
 * - The heavy `ResumePreview` element is memoized on `resume` identity, so the
 *   per-frame `ResizeObserver` scale updates (e.g. while the sidebar animates)
 *   re-render only the lightweight transform wrapper, never the full preview.
 * - The component itself is `memo`-wrapped so unrelated dashboard re-renders
 *   (search typing, sidebar toggle) skip the resume render entirely.
 */
function LiveResumeThumbnailImpl({ resume, paperSize = "a4" }: LiveResumeThumbnailProps) {
    const ref = useRef<HTMLDivElement>(null);
    // Without IntersectionObserver support, render the preview immediately.
    const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
    const [scale, setScale] = useState(0);

    // Defer the heavy ResumePreview until the card is near the viewport.
    useEffect(() => {
        if (typeof IntersectionObserver === "undefined") return;
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setVisible(true);
                        observer.disconnect();
                        return;
                    }
                }
            },
            { rootMargin: "200px" },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Track the container width to compute the page scale. rAF-throttled and
    // change-gated so a resizing parent cannot trigger a re-render storm.
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        let frame = 0;
        const observer = new ResizeObserver(([entry]) => {
            const width = entry.contentRect.width;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                setScale((prev) => {
                    const next = width / PAGE_WIDTH;
                    return Math.abs(next - prev) > 0.001 ? next : prev;
                });
            });
        });
        observer.observe(el);
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, []);

    // Stable element identity: scale changes never re-render this subtree.
    const content = useMemo(
        () =>
            visible ? (
                <ResumePreview
                    resumeOverride={resume}
                    paperSizeOverride={paperSize}
                    thumbnailMode
                />
            ) : (
                <ResumeThumbnail resume={resume} />
            ),
        [visible, resume, paperSize],
    );

    return (
        <div ref={ref} className="relative h-full w-full overflow-hidden">
            {scale > 0 && (
                <div
                    style={{
                        width: PAGE_WIDTH,
                        height: PAGE_HEIGHT,
                        transform: `scale(${scale})`,
                        transformOrigin: "top left",
                    }}
                >
                    {content}
                </div>
            )}
        </div>
    );
}

export const LiveResumeThumbnail = memo(LiveResumeThumbnailImpl);
