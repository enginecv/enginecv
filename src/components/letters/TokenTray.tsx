"use client";

import { useTranslation } from "@/lib/i18n";
import { LETTER_TOKENS, type LetterToken, type TokenValues } from "@/lib/letters/tokens";

/**
 * The tokens a letter can use, each with what it currently stands for. Clicking one
 * inserts `{{name}}` at the caret. A token with nothing to show is flagged here too.
 */
export function TokenTray({ values, onInsert, disabled = false }: {
    values: TokenValues;
    onInsert: (token: LetterToken) => void;
    disabled?: boolean;
}) {
    const { t } = useTranslation();
    return (
        <div className="space-y-2" data-testid="letter-token-tray">
            <p className="text-[11px] font-medium uppercase tracking-wider text-faint">{t("letters.tokens.title")}</p>
            <p className="text-xs text-mid">{t("letters.tokens.hint")}</p>
            <ul className="flex flex-wrap gap-2">
                {LETTER_TOKENS.map((token) => {
                    const value = values[token];
                    return (
                        <li key={token}>
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => onInsert(token)}
                                data-testid={`letter-token-${token}`}
                                title={t("letters.token.insert", { name: t(`letters.token.${token}`) })}
                                className="flex max-w-full items-center gap-2 rounded-lg border border-edge bg-surface-1 px-2.5 py-1.5 text-left text-xs transition-colors hover:border-faint disabled:opacity-60"
                            >
                                <span className="font-semibold text-strong">{t(`letters.token.${token}`)}</span>
                                <span className={`truncate ${value ? "text-mid" : "text-danger"}`} data-testid={`letter-token-value-${token}`}>
                                    {value || t("letters.token.empty")}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
