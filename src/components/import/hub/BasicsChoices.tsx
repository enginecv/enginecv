"use client";

import { useTranslation } from "@/lib/i18n";
import { CURRENT, NONE, type BasicsChoice, type BasicsField, type MergePlan, type Selection } from "@/lib/import/staging/types";
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
        <section aria-label={t("importHub.review.details")} data-testid="import-hub-basics" className="space-y-3">
            <div>
                <h3 className="text-sm font-medium text-bright">{t("importHub.review.details")}</h3>
                <p className="text-xs text-faint">{t("importHub.review.detailsHint")}</p>
            </div>
            {plan.basics.map((choice) => {
                const name = `basics-${choice.field}`;
                return (
                    <fieldset key={choice.field} className="rounded-lg border border-edge p-3">
                        <legend className="px-1 text-xs font-medium text-faint">{t(fieldLabelKey(choice.field))}</legend>
                        <div className="space-y-1">
                            {choice.options.map((option) => (
                                <label key={option.id} className="flex min-h-11 cursor-pointer items-start gap-2 rounded-md px-1 py-2 text-sm hover:bg-surface-4">
                                    <input
                                        type="radio"
                                        name={name}
                                        value={option.id}
                                        checked={chosen(choice) === option.id}
                                        onChange={() => onPick(choice.field, option.id)}
                                        aria-label={t("importHub.pick", { field: t(fieldLabelKey(choice.field)) }) + ": " + optionLabel(option.id, plan.batches, t)}
                                        className="mt-1"
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-xs text-faint">{optionLabel(option.id, plan.batches, t)}</span>
                                        {option.id === NONE ? null : choice.field === "photo"
                                            ? <img src={option.value} alt="" className="mt-1 h-14 w-14 rounded-md object-cover" />
                                            : <span className="block break-words text-bright">{shorten(option.value) || t("importHub.empty")}</span>}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                );
            })}
        </section>
    );
}
