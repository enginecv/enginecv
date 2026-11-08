"use client";

import { useId, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { CEFR_LEVELS, CEFR_SKILL_GROUPS, CEFR_SKILLS, cefrBand, deriveOverallCefrLevel, type CefrLevel, type CefrSkill } from "@/lib/cefr";
import { db } from "@/lib/db";
import { useTranslation } from "@/lib/i18n";
import type { Resume } from "@/lib/schema";
import {
    MAX_LANGUAGE_NAME_LENGTH,
    assessmentToLanguage,
    canShowResult,
    type LanguageSelfAssessment,
} from "@/lib/tools/cefr-assessment";
import { saveAssessmentToNewResume, saveAssessmentToResume } from "@/lib/tools/save-assessment";
import type { ToolPanelProps } from "./ToolPanelSlot";

// Suggested in the language field; any other name can be typed.
const SUGGESTED_LANGUAGES = ["de", "en", "fr", "es", "it", "bs", "hr", "sr"] as const;

const NEW_RESUME = "__new__";

type Step = "answering" | "result" | "choosing" | "saving";

function useLanguageNames(locale: string): string[] {
    return useMemo(() => {
        const names = new Intl.DisplayNames([locale, "en"], { type: "language" });
        return SUGGESTED_LANGUAGES.map((code) => {
            const name = names.of(code) ?? code;
            return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
        });
    }, [locale]);
}

/** The CEFR self-assessment: one statement per skill, a result, then "Add to my CV". */
export function CefrAssessmentPanel({ onDone, labelledBy }: ToolPanelProps) {
    const { t, locale } = useTranslation();
    const idPrefix = useId();
    const languageNames = useLanguageNames(locale);

    const [assessment, setAssessment] = useState<LanguageSelfAssessment>({ language: "", levels: {} });
    const [step, setStep] = useState<Step>("answering");
    const [resumes, setResumes] = useState<Resume[]>([]);
    const [target, setTarget] = useState(NEW_RESUME);
    const [notice, setNotice] = useState<"native" | "save-error" | null>(null);

    const ready = canShowResult(assessment);
    const entry = useMemo(() => (ready ? assessmentToLanguage(assessment) : null), [assessment, ready]);
    const skipped = CEFR_SKILLS.filter((skill) => assessment.levels[skill] === undefined);

    const setLevel = (skill: CefrSkill, level: CefrLevel | undefined) => {
        setAssessment((current) => {
            const levels = { ...current.levels };
            if (level) levels[skill] = level;
            else delete levels[skill];
            return { ...current, levels };
        });
    };

    const save = async (resumeId: string) => {
        if (!entry) return;
        setStep("saving");
        setNotice(null);
        try {
            if (resumeId === NEW_RESUME) {
                onDone(await saveAssessmentToNewResume(entry));
                return;
            }
            const outcome = await saveAssessmentToResume(resumeId, entry);
            if (outcome === "native") {
                setNotice("native");
                setStep("choosing");
                return;
            }
            onDone(resumeId);
        } catch {
            setNotice("save-error");
            setStep(resumeId === NEW_RESUME && resumes.length === 0 ? "result" : "choosing");
        }
    };

    const addToCv = async () => {
        const stored = await db.resumes.orderBy("updatedAt").reverse().toArray().catch(() => [] as Resume[]);
        if (stored.length === 0) {
            await save(NEW_RESUME);
            return;
        }
        setResumes(stored);
        setTarget(NEW_RESUME);
        setStep("choosing");
    };

    const overall = entry ? deriveOverallCefrLevel(entry.cefr) : "";

    return (
        <div aria-labelledby={labelledBy} role={labelledBy ? "region" : undefined} data-testid="cefr-panel">
            {step === "answering" && (
                <form
                    className="space-y-6"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (ready) setStep("result");
                    }}
                >
                    <label className="block">
                        <span className="mb-2 block text-sm font-medium text-bright">{t("tools.cefr.languageLabel")}</span>
                        <input
                            value={assessment.language}
                            onChange={(event) => setAssessment((current) => ({ ...current, language: event.target.value }))}
                            list={`${idPrefix}-languages`}
                            maxLength={MAX_LANGUAGE_NAME_LENGTH}
                            placeholder={t("tools.cefr.languagePlaceholder")}
                            data-testid="cefr-language"
                            className="w-full rounded-xl border border-edge bg-surface-1 px-4 py-3 text-sm text-strong outline-none transition-colors placeholder:text-faint focus:border-accent"
                        />
                        <datalist id={`${idPrefix}-languages`}>
                            {languageNames.map((name) => <option key={name} value={name} />)}
                        </datalist>
                    </label>

                    <p className="text-sm leading-6 text-mid">{t("tools.cefr.skillPrompt")}</p>

                    {CEFR_SKILL_GROUPS.map(({ group, skills }) => (
                        <div key={group} className="space-y-4">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t(`cefr.group.${group}`)}</h3>
                            {skills.map((skill) => (
                                <fieldset key={skill} className="rounded-xl border border-edge bg-surface-1 p-4" data-testid={`cefr-skill-${skill}`}>
                                    <legend className="px-1 text-sm font-semibold text-strong">{t(`cefr.skill.${skill}`)}</legend>
                                    <div className="mt-2 space-y-1.5">
                                        {CEFR_LEVELS.map((level) => (
                                            <label key={level} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-edge/40">
                                                <input
                                                    type="radio"
                                                    name={`${idPrefix}-${skill}`}
                                                    value={level}
                                                    checked={assessment.levels[skill] === level}
                                                    onChange={() => setLevel(skill, level)}
                                                    className="mt-1 accent-[var(--color-accent)]"
                                                />
                                                <span className="text-sm leading-6 text-mid">
                                                    <span className="mr-2 font-semibold text-strong">{level}</span>
                                                    {t(`cefr.descriptor.${skill}.${level}`)}
                                                </span>
                                            </label>
                                        ))}
                                        <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-edge/40">
                                            <input
                                                type="radio"
                                                name={`${idPrefix}-${skill}`}
                                                value=""
                                                checked={assessment.levels[skill] === undefined}
                                                onChange={() => setLevel(skill, undefined)}
                                                className="accent-[var(--color-accent)]"
                                            />
                                            <span className="text-sm text-faint">{t("tools.cefr.skip")}</span>
                                        </label>
                                    </div>
                                </fieldset>
                            ))}
                        </div>
                    ))}

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={!ready}
                            data-testid="cefr-show-result"
                            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-surface-2 transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {t("tools.cefr.showResult")}
                        </button>
                    </div>
                </form>
            )}

            {step !== "answering" && entry && (
                <div className="space-y-5" data-testid="cefr-result">
                    <div>
                        <h2 className="text-lg font-semibold text-strong">{t("tools.cefr.resultTitle", { language: entry.language })}</h2>
                        {overall && (
                            <p className="mt-1 text-sm text-mid" data-testid="cefr-overall">
                                {t("tools.cefr.overall", { level: overall, band: t(`cefr.band.${cefrBand(overall)}`) })}
                            </p>
                        )}
                    </div>

                    <ul className="grid gap-2 sm:grid-cols-2">
                        {CEFR_SKILLS.filter((skill) => assessment.levels[skill]).map((skill) => {
                            const level = assessment.levels[skill]!;
                            return (
                                <li key={skill} data-testid={`cefr-result-${skill}`} className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-surface-1 px-3.5 py-2.5">
                                    <span className="text-sm text-strong">{t(`cefr.skill.${skill}`)}</span>
                                    <span className="text-sm font-semibold text-accent">{level}</span>
                                </li>
                            );
                        })}
                    </ul>

                    {skipped.length > 0 && (
                        <p className="text-xs leading-5 text-dim" data-testid="cefr-skipped">
                            {t("tools.cefr.skipped", { skills: skipped.map((skill) => t(`cefr.skill.${skill}`)).join(", ") })}
                        </p>
                    )}
                    <p className="text-xs leading-5 text-dim">{t("tools.cefr.disclaimer")}</p>

                    {notice && (
                        <p role="alert" data-testid="cefr-notice" className="rounded-lg border border-warning-tint2 bg-warning-tint px-3 py-2 text-sm leading-6 text-warning">
                            {notice === "native" ? t("tools.cefr.nativeExplained", { language: entry.language }) : t("tools.cefr.saveError")}
                        </p>
                    )}

                    {step === "result" && (
                        <div className="flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setStep("answering")}
                                className="rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                            >
                                {t("tools.cefr.changeAnswers")}
                            </button>
                            <button
                                type="button"
                                onClick={() => void addToCv()}
                                data-testid="cefr-add-to-cv"
                                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-surface-2 transition-colors hover:bg-accent-soft"
                            >
                                {t("tools.cefr.addToCv")}
                            </button>
                        </div>
                    )}

                    {step === "choosing" && (
                        <fieldset className="space-y-2" data-testid="cefr-choose-cv">
                            <legend className="mb-2 text-sm font-medium text-strong">{t("tools.cefr.chooseCv")}</legend>
                            {[{ id: NEW_RESUME, title: t("tools.cefr.newCv") }, ...resumes.map((resume) => ({
                                id: resume.id!,
                                title: resume.meta.title || t("dashboard.untitled"),
                            }))].map((option) => (
                                <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-edge bg-surface-1 px-3.5 py-2.5">
                                    <input
                                        type="radio"
                                        name={`${idPrefix}-target`}
                                        value={option.id}
                                        checked={target === option.id}
                                        onChange={() => setTarget(option.id)}
                                        className="accent-[var(--color-accent)]"
                                    />
                                    <span className="text-sm text-strong">{option.title}</span>
                                </label>
                            ))}
                            <div className="flex flex-wrap justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNotice(null);
                                        setStep("result");
                                    }}
                                    className="rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                                >
                                    {t("tools.cefr.back")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void save(target)}
                                    data-testid="cefr-confirm-target"
                                    className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-surface-2 transition-colors hover:bg-accent-soft"
                                >
                                    {t("tools.cefr.addConfirm")}
                                </button>
                            </div>
                        </fieldset>
                    )}

                    {step === "saving" && (
                        <p role="status" className="flex items-center justify-center gap-2 py-4 text-sm text-bright">
                            <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
                            {t("tools.cefr.saving")}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
