"use client";

import { Fragment, useState, type KeyboardEvent } from "react";
import { useTranslation } from "@/lib/i18n";
import {
    CEFR_LEVELS,
    CEFR_SKILL_GROUPS,
    CEFR_SKILLS,
    cefrBand,
    deriveOverallCefrLevel,
    hasUniformCefrLevels,
    isCefrLevel,
    type CefrLevel,
    type CefrSkill,
    type CefrSkillLevels,
} from "@/lib/cefr";

interface CefrSkillGridProps {
    value: CefrSkillLevels;
    onChange: (next: CefrSkillLevels) => void;
}

// A1–A2 | B1–B2 | C1–C2: the gaps between bands make the scale readable at a glance.
const BANDS: CefrLevel[][] = [["A1", "A2"], ["B1", "B2"], ["C1", "C2"]];

function SkillScale({
    skill,
    level,
    onPick,
    onHover,
}: {
    skill: CefrSkill;
    level: string;
    onPick: (next: string) => void;
    onHover: (level: CefrLevel | null) => void;
}) {
    const { t } = useTranslation();
    const selectedIndex = isCefrLevel(level) ? CEFR_LEVELS.indexOf(level) : -1;

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1
            : 0;
        if (step === 0) return;
        event.preventDefault();
        const nextIndex = Math.min(CEFR_LEVELS.length - 1, Math.max(0, (selectedIndex === -1 ? (step > 0 ? -1 : CEFR_LEVELS.length) : selectedIndex) + step));
        onPick(CEFR_LEVELS[nextIndex]);
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]");
        buttons[nextIndex]?.focus();
    };

    return (
        <div
            role="radiogroup"
            aria-label={t(`cefr.skill.${skill}`)}
            data-testid={`cefr-scale-${skill}`}
            onKeyDown={handleKeyDown}
            onMouseLeave={() => onHover(null)}
            className="flex gap-1.5"
        >
            {BANDS.map((band) => (
                <div key={band[0]} className="grid flex-1 grid-cols-2 gap-0.5 rounded-lg border border-edge bg-surface-1 p-0.5">
                    {band.map((option) => {
                        const index = CEFR_LEVELS.indexOf(option);
                        const selected = index === selectedIndex;
                        const reached = selectedIndex !== -1 && index < selectedIndex;
                        // Only one radio is tabbable: the selected level, or A1 when nothing is chosen.
                        const tabbable = selected || (selectedIndex === -1 && index === 0);
                        return (
                            <button
                                key={option}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                tabIndex={tabbable ? 0 : -1}
                                data-testid={`cefr-level-${skill}-${option}`}
                                onClick={() => onPick(selected ? "" : option)}
                                onMouseEnter={() => onHover(option)}
                                onFocus={() => onHover(option)}
                                onBlur={() => onHover(null)}
                                className={`h-7 rounded-md text-[11px] font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                    selected
                                        ? "bg-accent text-surface-2 shadow-sm"
                                        : reached
                                            ? "bg-accent/[0.07] text-accent/80 hover:bg-accent/15 hover:text-accent"
                                            : "text-faint hover:bg-surface-4 hover:text-strong"
                                }`}
                            >
                                {option}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

export function CefrSkillGrid({ value, onChange }: CefrSkillGridProps) {
    const { t } = useTranslation();
    const [hovered, setHovered] = useState<{ skill: CefrSkill; level: CefrLevel } | null>(null);
    const [lastPicked, setLastPicked] = useState<CefrLevel | null>(null);

    const overall = deriveOverallCefrLevel(value);
    const fillLevel = lastPicked ?? (overall || null);
    const allSame = CEFR_SKILLS.every((skill) => value[skill] === fillLevel);
    const canFillAll = fillLevel !== null && !allSame;

    const pick = (skill: CefrSkill, next: string) => {
        if (isCefrLevel(next)) setLastPicked(next);
        onChange({ ...value, [skill]: next });
    };

    return (
        <div data-testid="cefr-skill-grid" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-edge bg-surface-1 px-3.5 py-2.5">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-faint">
                            {t("editor.languageOverallLevel")}
                        </span>
                        <span
                            data-testid="cefr-overall-level"
                            className={`rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${overall ? "bg-accent/15 text-accent" : "text-faint"}`}
                        >
                            {overall || "—"}
                        </span>
                        {overall && !hasUniformCefrLevels(value) && (
                            <span className="text-[11px] text-faint">{t(`cefr.band.${cefrBand(overall)}`)}</span>
                        )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-4 text-faint">{t("editor.languageOverallLevelHint")}</p>
                </div>
                {canFillAll && (
                    <button
                        type="button"
                        data-testid="cefr-fill-all"
                        onClick={() => onChange({
                            listening: fillLevel,
                            reading: fillLevel,
                            spokenInteraction: fillLevel,
                            spokenProduction: fillLevel,
                            writing: fillLevel,
                        })}
                        className="rounded-lg border border-edge px-2.5 py-1.5 text-[11px] font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                    >
                        {t("editor.cefrApplyToAll", { level: fillLevel })}
                    </button>
                )}
            </div>

            {CEFR_SKILL_GROUPS.map(({ group, skills }) => (
                <section key={group} aria-labelledby={`cefr-group-${group}`} className="space-y-2.5">
                    <h4 id={`cefr-group-${group}`} className="text-[11px] font-medium uppercase tracking-wider text-faint">
                        {t(`cefr.group.${group}`)}
                    </h4>
                    {skills.map((skill) => {
                        const level = value[skill];
                        const preview = hovered?.skill === skill ? hovered.level : isCefrLevel(level) ? level : null;
                        const previewing = hovered?.skill === skill && hovered.level !== level;
                        return (
                            <Fragment key={skill}>
                                <div className="space-y-1.5">
                                    {/* The group heading already says "Writing"; don't repeat it for the lone skill. */}
                                    {skills.length > 1 && (
                                        <p className="text-sm text-strong">{t(`cefr.skill.${skill}`)}</p>
                                    )}
                                    <SkillScale
                                        skill={skill}
                                        level={level}
                                        onPick={(next) => pick(skill, next)}
                                        onHover={(hoverLevel) => setHovered(hoverLevel ? { skill, level: hoverLevel } : null)}
                                    />
                                    <p
                                        data-testid={`cefr-descriptor-${skill}`}
                                        aria-live="polite"
                                        className={`min-h-[2rem] text-xs leading-4 transition-opacity ${previewing ? "text-faint" : "text-mid"}`}
                                    >
                                        {preview ? (
                                            <>
                                                <span className="font-semibold text-bright">
                                                    {preview} · {t(`cefr.band.${cefrBand(preview)}`)}
                                                </span>
                                                {" — "}
                                                {t(`cefr.descriptor.${skill}.${preview}`)}
                                            </>
                                        ) : (
                                            <span className="text-faint">{t("editor.cefrNotAssessed")}</span>
                                        )}
                                    </p>
                                </div>
                            </Fragment>
                        );
                    })}
                </section>
            ))}
        </div>
    );
}
