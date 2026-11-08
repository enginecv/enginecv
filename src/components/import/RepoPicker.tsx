"use client";

import { Archive, GitFork, Star } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { type NormalizedRepository } from "@/lib/import/provider";

interface RepoPickerProps {
    repos: NormalizedRepository[];
    selectedNames: Set<string>;
    truncated?: boolean;
    onToggle: (name: string) => void;
    onSelectAll: () => void;
    onClearAll: () => void;
}

function compareRepos(a: NormalizedRepository, b: NormalizedRepository): number {
    if (b.stars !== a.stars) return b.stars - a.stars;
    return b.pushedAt.localeCompare(a.pushedAt);
}

export function getDefaultSelectedRepoNames(repos: NormalizedRepository[]): Set<string> {
    return new Set(repos.filter((repo) => !repo.isFork && !repo.isArchived).map((repo) => repo.name));
}

export function RepoPicker({
    repos,
    selectedNames,
    truncated = false,
    onToggle,
    onSelectAll,
    onClearAll,
}: RepoPickerProps) {
    const { t } = useTranslation();
    const orderedRepos = useMemo(() => [...repos].sort(compareRepos), [repos]);

    if (orderedRepos.length === 0) {
        return (
            <div
                data-testid="github-import-empty-repos"
                className="rounded-xl border border-edge bg-surface-1 p-4 text-sm leading-6 text-mid"
            >
                {t("githubImport.emptyRepos")}
            </div>
        );
    }

    return (
        <div className="space-y-3" data-testid="github-import-repo-picker">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-dim">
                    {selectedNames.size}/{orderedRepos.length}
                </p>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={onSelectAll}
                        className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                    >
                        {t("githubImport.selectAll")}
                    </button>
                    <button
                        type="button"
                        onClick={onClearAll}
                        className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                    >
                        {t("githubImport.clearAll")}
                    </button>
                </div>
            </div>

            {truncated && (
                <p
                    data-testid="github-import-truncated-note"
                    className="rounded-lg border border-warning-tint2 bg-warning-tint px-3 py-2 text-xs leading-5 text-warning"
                >
                    {t("githubImport.truncatedNote")}
                </p>
            )}

            <div className="max-h-[min(54vh,440px)] space-y-2 overflow-y-auto pr-1">
                {orderedRepos.map((repo) => {
                    const checked = selectedNames.has(repo.name);

                    return (
                        <label
                            key={repo.name}
                            data-testid="github-import-repo-row"
                            className="flex cursor-pointer items-start gap-3 rounded-xl border border-edge bg-surface-1 p-3 transition-colors hover:border-faint"
                        >
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onToggle(repo.name)}
                                className="mt-1 h-4 w-4 accent-accent"
                            />
                            <span className="min-w-0 flex-1">
                                <span className="flex min-w-0 flex-wrap items-center gap-2">
                                    <span className="break-words text-sm font-medium text-strong">
                                        {repo.name}
                                    </span>
                                    {repo.isFork && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-info-line bg-info-tint px-2 py-0.5 text-[11px] text-info-soft">
                                            <GitFork className="h-3 w-3" />
                                            {t("githubImport.forkBadge")}
                                        </span>
                                    )}
                                    {repo.isArchived && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-warning-tint2 bg-warning-tint px-2 py-0.5 text-[11px] text-warning">
                                            <Archive className="h-3 w-3" />
                                            {t("githubImport.archivedBadge")}
                                        </span>
                                    )}
                                </span>
                                {repo.description && (
                                    <span className="mt-1 block line-clamp-2 break-words text-xs leading-5 text-dim">
                                        {repo.description}
                                    </span>
                                )}
                                <span className="mt-2 flex flex-wrap items-center gap-3 text-xs text-faint">
                                    {repo.primaryLanguage && <span>{repo.primaryLanguage}</span>}
                                    <span className="inline-flex items-center gap-1">
                                        <Star className="h-3.5 w-3.5" />
                                        {repo.stars}
                                    </span>
                                </span>
                            </span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}
