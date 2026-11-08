"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createId } from "@/lib/id";
import { useTranslation } from "@/lib/i18n";
import { REPO_PLATFORMS, detectPlatform, type RepoPlatformKey } from "@/lib/repo-links";
import type { ProjectRepo } from "@/lib/schema";
import { RepoIcon } from "./RepoBadge";

export interface RepoLinksEditorProps {
    repos: ProjectRepo[];
    onChange: (next: ProjectRepo[]) => void;
}

function createEmptyRepo(): ProjectRepo {
    return { id: createId(), url: "", platform: "auto", label: "" };
}

export function RepoLinksEditor({ repos, onChange }: RepoLinksEditorProps) {
    const { t } = useTranslation();
    const platforms = useMemo(
        () => [
            { value: "auto", label: t("editor.repoPlatformAuto") },
            ...REPO_PLATFORMS.map((p) => ({ value: p.key, label: p.label })),
            { value: "other", label: t("editor.repoPlatformOther") },
        ],
        [t]
    );

    const updateRepo = (index: number, patch: Partial<ProjectRepo>) => {
        const next = repos.slice();
        next[index] = { ...next[index], ...patch };
        onChange(next);
    };

    const removeRepo = (index: number) => {
        onChange(repos.filter((_, i) => i !== index));
    };

    const addRepo = () => {
        onChange([...repos, createEmptyRepo()]);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-faint uppercase tracking-wider">
                    {t("editor.repoLinks")}
                </label>
                <span className="text-[10px] text-faint">{t("editor.repoLinksHint")}</span>
            </div>

            {repos.length > 0 && (
                <div className="space-y-2">
                    {repos.map((repo, index) => {
                        const resolvedPlatform: RepoPlatformKey =
                            repo.platform && repo.platform !== "auto"
                                ? (repo.platform as RepoPlatformKey)
                                : detectPlatform(repo.url).key;
                        return (
                            <div
                                key={repo.id}
                                className="rounded-xl border border-edge bg-surface-1 p-3 space-y-2"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-4 border border-edge text-bright">
                                        <RepoIcon platform={resolvedPlatform} className="h-4 w-4" />
                                    </div>
                                    <input
                                        type="url"
                                        value={repo.url}
                                        onChange={(e) => updateRepo(index, { url: e.target.value })}
                                        placeholder={t("editor.repoUrlPlaceholder")}
                                        className="flex-1 min-w-0 bg-surface-4 border border-edge rounded-lg px-3 py-2 text-sm text-strong placeholder:text-faint focus:outline-none focus:border-faint"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeRepo(index)}
                                        aria-label={t("editor.repoRemove")}
                                        className="w-8 h-8 shrink-0 rounded-lg border border-edge text-faint hover:text-danger hover:border-danger/60 transition-colors flex items-center justify-center"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <select
                                        value={repo.platform || "auto"}
                                        onChange={(e) => updateRepo(index, { platform: e.target.value })}
                                        className="bg-surface-4 border border-edge rounded-lg px-2 py-2 text-xs text-bright focus:outline-none focus:border-faint"
                                    >
                                        {platforms.map((p) => (
                                            <option key={p.value} value={p.value}>
                                                {p.label}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        value={repo.label || ""}
                                        onChange={(e) => updateRepo(index, { label: e.target.value })}
                                        placeholder={t("editor.repoLabelPlaceholder")}
                                        className="bg-surface-4 border border-edge rounded-lg px-3 py-2 text-xs text-strong placeholder:text-faint focus:outline-none focus:border-faint"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <button
                type="button"
                onClick={addRepo}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-surface-1 border border-dashed border-faint rounded-xl text-xs font-medium text-accent hover:text-accent-soft hover:border-accent transition-colors"
            >
                <Plus className="w-3.5 h-3.5" />
                {t("editor.repoAdd")}
            </button>
        </div>
    );
}
