"use client";

import { AlertTriangle, CheckCircle2, Info, MinusCircle, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import type { ImportResult, Notice, NoticeKind } from "@/lib/agent/authoring";
import { DOCUMENT_PATH } from "@/lib/agent/authoring/notices";
import type { AuthoringSectionKey } from "@/lib/agent/authoring/schema";
import { useTranslation } from "@/lib/i18n";

/** Section label keys, in the order the summary lists them. */
const SECTION_LABELS: ReadonlyArray<[AuthoringSectionKey, string]> = [
    ["experience", "editor.sectionExperience"],
    ["education", "editor.sectionEducation"],
    ["courses", "editor.sectionCourses"],
    ["projects", "editor.sectionProjects"],
    ["organisations", "editor.sectionOrganisations"],
    ["certificates", "editor.sectionCertificates"],
    ["awards", "editor.sectionAwards"],
    ["publications", "editor.sectionPublications"],
    ["references", "editor.sectionReferences"],
    ["declaration", "editor.sectionDeclaration"],
    ["skills", "editor.sectionSkills"],
    ["languages", "editor.sectionLanguages"],
    ["interests", "editor.sectionInterests"],
    ["custom", "authoring.section.custom"],
];

const KIND_ORDER: readonly NoticeKind[] = ["skipped", "review", "adjusted", "repaired"];

const KIND_ICONS: Record<NoticeKind, ReactNode> = {
    skipped: <MinusCircle className="h-4 w-4 text-danger-soft" aria-hidden="true" />,
    review: <AlertTriangle className="h-4 w-4 text-accent" aria-hidden="true" />,
    adjusted: <Info className="h-4 w-4 text-faint" aria-hidden="true" />,
    repaired: <Wrench className="h-4 w-4 text-faint" aria-hidden="true" />,
};

function countKey(section: AuthoringSectionKey): string {
    if (section === "skills") return "authoring.summary.skills";
    if (section === "custom") return "authoring.summary.sections";
    return "authoring.summary.entries";
}

export interface AuthoringImportSummaryProps {
    result: ImportResult;
    /** Repairs made to the text before it could be read. */
    parseNotices: Notice[];
}

/** What a Paste from AI import will create, and every value it had to touch. */
export function AuthoringImportSummary({ result, parseNotices }: AuthoringImportSummaryProps) {
    const { t, tn } = useTranslation();
    const { resume, counts, designApplied } = result;
    const notices = [...parseNotices, ...result.notices];
    const sections = SECTION_LABELS.filter(([key]) => counts[key] > 0);
    const hasSummary = resume.basics.summary.trim() !== "";
    const design = [
        designApplied.template && t("authoring.design.template", { value: designApplied.template }),
        designApplied.accent && t("authoring.design.accent", { value: designApplied.accent }),
        designApplied.cvLanguage && t("authoring.design.cvLanguage", { value: designApplied.cvLanguage }),
    ].filter((item): item is string => Boolean(item));

    return (
        <div className="space-y-4" data-testid="paste-from-ai-summary">
            <section className="rounded-xl border border-edge bg-surface-3 p-4">
                <h3 className="text-sm font-semibold text-strong">{t("authoring.summary.title")}</h3>
                <p className="mt-2 flex items-center gap-2 text-sm text-bright" data-testid="paste-from-ai-summary-name">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    <span className="min-w-0 break-words">{resume.basics.name || t("authoring.summary.noName")}</span>
                </p>
                {sections.length === 0 && !hasSummary ? (
                    <p className="mt-3 text-sm text-dim" data-testid="paste-from-ai-summary-nothing">{t("authoring.summary.nothing")}</p>
                ) : (
                    <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                        {hasSummary && (
                            <li className="flex justify-between gap-3 text-mid" data-testid="paste-from-ai-section-summary">
                                <span className="min-w-0 truncate">{t("authoring.summary.profile")}</span>
                            </li>
                        )}
                        {sections.map(([key, labelKey]) => (
                            <li key={key} className="flex justify-between gap-3 text-mid" data-testid={`paste-from-ai-section-${key}`}>
                                <span className="min-w-0 truncate">{t(labelKey)}</span>
                                <span className="shrink-0 tabular-nums text-faint">{tn(countKey(key), counts[key])}</span>
                            </li>
                        ))}
                    </ul>
                )}
                {design.length > 0 && (
                    <p className="mt-3 text-xs text-dim" data-testid="paste-from-ai-design">
                        <span className="font-medium text-mid">{t("authoring.summary.design")}:</span> {design.join(" · ")}
                    </p>
                )}
            </section>

            <div aria-live="polite" data-testid="paste-from-ai-notices">
                {notices.length > 0 && (
                    <section className="rounded-xl border border-edge p-4">
                        <h3 className="text-sm font-semibold text-strong">{tn("authoring.notices.title", notices.length)}</h3>
                        <p className="mt-1 text-xs text-dim">{t("authoring.notices.hint")}</p>
                        {/* Focusable so keyboard users can scroll a long list (WCAG 2.1.1). */}
                        <div
                            role="region"
                            aria-label={tn("authoring.notices.title", notices.length)}
                            tabIndex={0}
                            className="mt-3 max-h-64 space-y-3 overflow-y-auto rounded-lg pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                            {KIND_ORDER.map((kind) => {
                                const group = notices.filter((notice) => notice.kind === kind);
                                if (group.length === 0) return null;
                                return (
                                    <div key={kind} data-testid={`paste-from-ai-notice-group-${kind}`}>
                                        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
                                            {KIND_ICONS[kind]}
                                            {t(`authoring.noticeKind.${kind}`)}
                                        </h4>
                                        <ul className="mt-1.5 space-y-1.5">
                                            {group.map((notice, index) => (
                                                <li key={`${notice.code}-${notice.path}-${index}`} className="text-sm text-mid" data-testid="paste-from-ai-notice">
                                                    <span className="break-words">{t(`authoring.notice.${notice.code}`, notice.params)}</span>
                                                    {notice.path !== DOCUMENT_PATH && (
                                                        <code className="ml-1.5 break-all rounded bg-surface-3 px-1 py-0.5 text-[11px] text-faint">{notice.path}</code>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
