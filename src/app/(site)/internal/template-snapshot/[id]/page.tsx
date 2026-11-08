"use client";

import { use, useEffect, useMemo, useState } from "react";
import { ResumePreview } from "@/components/editor/ResumePreview";
import { getBuiltinTemplateById, getTemplatePreviewOptions } from "@/lib/templates/enginecv-templates";
import { applyTemplateToResume } from "@/lib/templates/template-apply";
import { getSampleResumeForTemplatePreview } from "@/lib/templates/template-preview";

const PAPER = {
    a4: { width: 794, height: 1123 },
    letter: { width: 816, height: 1056 },
} as const;

export default function TemplateSnapshotPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [ready, setReady] = useState(false);

    const data = useMemo(() => {
        const template = getBuiltinTemplateById(id);
        if (!template) return null;
        const sample = getSampleResumeForTemplatePreview(getTemplatePreviewOptions(template.id));
        const { resume } = applyTemplateToResume(sample, template);
        return { template, resume };
    }, [id]);

    useEffect(() => {
        if (!data) return;
        if (typeof document === "undefined") return;
        const fontsReady = document.fonts?.ready ?? Promise.resolve();
        fontsReady.then(() => {
            requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
        });
    }, [data]);

    if (!data) {
        return <div style={{ padding: 24, fontFamily: "sans-serif" }}>Template not found.</div>;
    }

    const paper = PAPER[data.template.paperSize ?? "a4"];

    return (
        <div
            data-snapshot-root
            data-ready={ready ? "true" : "false"}
            style={{
                width: paper.width,
                height: paper.height,
                background: "#fff",
                overflow: "hidden",
            }}
        >
            <ResumePreview
                resumeOverride={data.resume}
                paperSizeOverride={data.template.paperSize ?? "a4"}
                thumbnailMode
            />
        </div>
    );
}
