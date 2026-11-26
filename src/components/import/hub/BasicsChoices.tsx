"use client";

import { useTranslation } from "@/lib/i18n";
import { NONE, type BasicsChoice, type BasicsField, type MergePlan, type Selection } from "@/lib/import/staging/types";
import { fieldLabelKey, optionLabel, shorten } from "./labels";
import { VersionOption } from "./VersionOption";

interface BasicsChoicesProps {
    plan: MergePlan;
    selection: Selection;
    onPick: (field: BasicsField, optionId: string) => void;
}

/** Field by field: which value to use for the person's own details when sources differ. */
export function BasicsChoices({ plan, selection, onPick }: BasicsChoicesProps) {
    const { t } = useTranslation();
    if (plan.basics.length === 0) return null;

    const chosen = (choice: BasicsChoice) => selection.basics[choice.field] ?? choice.defaultId;

    return (
        <section aria-label={t("importHub.review.details")} data-testid="import-hub-basics" className="space-y-3">
            <div>
                <h3 className="text-sm font-semibold text-strong">{t("importHub.review.details")}</h3>
                <p className="text-xs text-faint">{t("importHub.review.detailsHint")}</p>
            </div>
            {plan.basics.map((choice) => {
                const label = t(fieldLabelKey(choice.field));
                return (
                    <fieldset key={choice.field} className="rounded-xl border border-edge bg-surface-1/40 p-3">
                        <legend className="px-1 text-xs font-medium text-mid">{label}</legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {choice.options.map((option) => {
                                const source = optionLabel(option.id, plan.batches, t);
                                return (
                                    <VersionOption
                                        key={option.id}
                                        name={`basics-${choice.field}`}
                                        checked={chosen(choice) === option.id}
                                        onPick={() => onPick(choice.field, option.id)}
                                        ariaLabel={`${t("importHub.pick", { field: label })}: ${source}`}
                                        source={source}
                                    >
                                        {option.id === NONE ? (
                                            <span className="text-faint">—</span>
                                        ) : choice.field === "photo" ? (
                                            <img src={option.value} alt="" className="mt-1 h-14 w-14 rounded-md object-cover" />
                                        ) : (
                                            shorten(option.value) || <span className="text-faint">{t("importHub.empty")}</span>
                                        )}
                                    </VersionOption>
                                );
                            })}
                        </div>
                    </fieldset>
                );
            })}
        </section>
    );
}
