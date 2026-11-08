"use client";

import { Github } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { SuggestionsState } from "@/lib/import/profile-preview";

export interface ProfileSuggestionListProps {
    state: SuggestionsState;
    onPick: (login: string) => void;
}

/**
 * "Did you mean" list shown when an exact preview lookup missed but the user
 * search found similar accounts. Renders nothing in every other state so the
 * plain not-found notice keeps covering empty and failed searches.
 */
export function ProfileSuggestionList({ state, onPick }: ProfileSuggestionListProps) {
    const { t } = useTranslation();

    if (state.status !== "shown" || state.suggestions.length === 0) return null;

    return (
        <div data-testid="github-profile-suggestion-list" className="space-y-2">
            <p className="text-xs text-dim">{t("githubImport.previewDidYouMean")}</p>
            <ul className="space-y-1">
                {state.suggestions.map((suggestion) => (
                    <li key={suggestion.login}>
                        <button
                            type="button"
                            onClick={() => onPick(suggestion.login)}
                            data-testid="github-profile-suggestion"
                            className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-edge hover:bg-surface-1"
                        >
                            {suggestion.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element -- external GitHub CDN avatar, ephemeral suggestion
                                <img
                                    src={suggestion.avatarUrl}
                                    alt=""
                                    className="h-6 w-6 shrink-0 rounded-full"
                                />
                            ) : (
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-edge">
                                    <Github className="h-3 w-3 text-dim" />
                                </span>
                            )}
                            <span className="truncate text-sm text-bright">{suggestion.login}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
