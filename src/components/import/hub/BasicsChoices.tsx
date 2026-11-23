"use client";

import { useTranslation } from "@/lib/i18n";
import { CURRENT, NONE, type BasicsChoice, type BasicsField, type MergePlan, type Selection } from "@/lib/import/staging/types";
import { ChoiceChips } from "./ChoiceChips";
import { fieldLabelKey, optionLabel, shorten } from "./labels";

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
        <section aria-label={t("importHub.review.details")} data-testid="import-hub-basics" className="space-y-4 rounded-xl border border-edge p-4">
            <div>
                <h3 className="text-sm font-medium text-bright">{t("importHub.review.details")}</h3>
                <p className="text-xs text-faint">{t("importHub.review.detailsHint")}</p>
            </div>
            {plan.basics.map((choice) => {
                const field = t(fieldLabelKey(choice.field));
                return (
                    <ChoiceChips
                        key={choice.field}
                        legend={field}
                        name={`basics-${choice.field}`}
                        chosen={chosen(choice)}
                        onPick={(optionId) => onPick(choice.field, optionId)}
                        options={choice.options.map((option) => {
                            const source = optionLabel(option.id, plan.batches, t);
                            return {
                                id: option.id,
                                source,
                                ariaLabel: `${t("importHub.pick", { field })}: ${source}`,
                                value:
                                    option.id === NONE ? null : choice.field === "photo"
                                        ? <img src={option.value} alt="" className="mt-1 h-14 w-14 rounded-md object-cover" />
                                        : shorten(option.value) || t("importHub.empty"),
                            };
                        })}
                    />
                );
            })}
        </section>
    );
}
