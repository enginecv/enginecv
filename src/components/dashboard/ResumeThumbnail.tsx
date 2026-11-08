"use client";

import { useMemo } from "react";
import { allSkills, type Resume } from "@/lib/schema";
import { getPrimaryResumeEmail } from "@/lib/emails";
import { getCvLanguageLabels } from "@/lib/cv-language";
import { markdownToPlainText } from "@/lib/export-plaintext";

interface ResumeThumbnailProps {
    resume: Resume;
}

export function ResumeThumbnail({ resume }: ResumeThumbnailProps) {
    const labels = useMemo(() => getCvLanguageLabels(resume.settings.language), [resume.settings.language]);
    const { name, headline, summary } = resume.basics;
    const accent = resume.settings?.colors?.accent || "#ffaa8d";
    const textColor = resume.settings?.colors?.text || "#111827";
    const bgColor = resume.settings?.colors?.background || "#ffffff";
    const fontFamily = resume.settings?.typography?.fontFamily || "Inter";
    const headingCap = resume.settings?.headings?.capitalization || "uppercase";

    const sections = useMemo(() => {
        const s: { label: string; entryCount: number }[] = [];
        if (resume.experience?.length > 0)
            s.push({ label: labels.experience, entryCount: resume.experience.length });
        if (resume.education?.length > 0)
            s.push({ label: labels.education, entryCount: resume.education.length });
        const skillCount = allSkills(resume.skillGroups ?? []).length;
        if (skillCount > 0)
            s.push({ label: labels.skills, entryCount: skillCount });
        if (resume.projects?.length > 0)
            s.push({ label: labels.projects, entryCount: resume.projects.length });
        if (resume.certificates?.length > 0)
            s.push({ label: labels.certificates, entryCount: resume.certificates.length });
        if (resume.languages?.length > 0)
            s.push({ label: labels.languages, entryCount: resume.languages.length });
        if (resume.interests?.length > 0)
            s.push({ label: labels.interests ?? "", entryCount: resume.interests.length });
        return s;
    }, [labels, resume.experience, resume.education, resume.skillGroups, resume.projects, resume.certificates, resume.languages, resume.interests]);

    return (
        <div
            className="w-[794px] h-[1123px] origin-top-left"
            style={{
                fontFamily,
                backgroundColor: bgColor,
                color: textColor,
                padding: "60px 56px",
                boxSizing: "border-box",
                overflow: "hidden",
            }}
        >
            {/* Header */}
            <div style={{ borderBottom: `2px solid ${accent}`, paddingBottom: 20, marginBottom: 20 }}>
                <div
                    style={{
                        fontSize: 28,
                        fontWeight: 700,
                        lineHeight: 1.2,
                        letterSpacing: "-0.01em",
                        color: textColor,
                    }}
                >
                    {name || labels.yourName}
                </div>
                {headline && (
                    <div style={{ fontSize: 13, opacity: 0.65, marginTop: 4 }}>
                        {headline}
                    </div>
                )}
                {/* Contact line placeholder */}
                <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                    {[getPrimaryResumeEmail(resume.basics), resume.basics.phone, resume.basics.location]
                        .filter(Boolean)
                        .map((val, i) => (
                            <span key={i} style={{ fontSize: 9, opacity: 0.45 }}>{val}</span>
                        ))}
                </div>
            </div>

            {/* Summary */}
            {summary && (
                <div style={{ marginBottom: 22 }}>
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: headingCap as React.CSSProperties["textTransform"],
                            letterSpacing: "0.08em",
                            color: accent,
                            borderBottom: `1px solid ${accent}40`,
                            paddingBottom: 4,
                            marginBottom: 8,
                        }}
                    >
                        {labels.summary}
                    </div>
                    <div style={{ fontSize: 9, lineHeight: 1.5, opacity: 0.6, overflow: "hidden", maxHeight: 55 }}>
                        {markdownToPlainText(summary)}
                    </div>
                </div>
            )}

            {/* Sections */}
            {sections.map((section) => (
                <div key={section.label} style={{ marginBottom: 18 }}>
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: headingCap as React.CSSProperties["textTransform"],
                            letterSpacing: "0.08em",
                            color: accent,
                            borderBottom: `1px solid ${accent}40`,
                            paddingBottom: 4,
                            marginBottom: 8,
                        }}
                    >
                        {section.label}
                    </div>
                    {/* Entry placeholders */}
                    {Array.from({ length: Math.min(section.entryCount, 3) }).map((_, i) => (
                        <div key={i} style={{ marginBottom: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                <div style={{ height: 8, width: "35%", borderRadius: 4, background: `${textColor}18` }} />
                                <div style={{ height: 6, width: "15%", borderRadius: 3, background: `${textColor}10` }} />
                            </div>
                            <div style={{ height: 6, width: "25%", borderRadius: 3, background: `${textColor}0c`, marginTop: 4 }} />
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
                                <div style={{ height: 5, width: "100%", borderRadius: 2, background: `${textColor}08` }} />
                                <div style={{ height: 5, width: "85%", borderRadius: 2, background: `${textColor}08` }} />
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
