"use client";

import { Github, Loader2, ShieldCheck, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "@/lib/i18n";
import { createId } from "@/lib/id";
import { createGithubProvider, type GithubProvider } from "@/lib/import/github";
import { appendGithubProjects, existingGithubRepoKeys, githubRepoKey, parseGithubRepoInput } from "@/lib/import/github-projects";
import { ImportError, type NormalizedRepository } from "@/lib/import/provider";
import type { Resume } from "@/lib/schema";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { RepoPicker } from "./RepoPicker";

interface GithubProjectsImportDialogProps {
    existingProjects: Resume["projects"];
    onApply: (projects: Resume["projects"]) => void;
    onClose: () => void;
    /** Tests inject a fake; otherwise each lookup gets a fresh provider and its own request budget. */
    createProvider?: () => GithubProvider;
}

interface Lookup {
    provider: GithubProvider;
    owner: string;
    repos: NormalizedRepository[];
    truncated: boolean;
    alreadyAdded: number;
}

type Phase = "input" | "fetching" | "picking" | "adding";

/** Mounted only while open: adds public repositories to the current CV's Projects. */
export function GithubProjectsImportDialog({
    existingProjects,
    onApply,
    onClose,
    createProvider = () => createGithubProvider(),
}: GithubProjectsImportDialogProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const [phase, setPhase] = useState<Phase>("input");
    const [lookup, setLookup] = useState<Lookup | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const busy = phase === "fetching" || phase === "adding";
    const dialogRef = useDialogFocus<HTMLDivElement>(true, () => {
        if (!busy) onClose();
    });
    const existingKeys = useMemo(() => existingGithubRepoKeys(existingProjects), [existingProjects]);

    const describeError = (cause: unknown, subject: string) => {
        if (!(cause instanceof ImportError)) return t("githubImport.errorNetwork");
        if (cause.kind === "not-found") return t("githubProjects.notFound", { query: subject });
        if (cause.kind === "rate-limited") {
            return cause.resetAt
                ? `${t("githubImport.errorRateLimited")} ${t("githubImport.errorRateLimitReset", { time: cause.resetAt.toLocaleTimeString() })}`
                : t("githubImport.errorRateLimited");
        }
        return t("githubImport.errorNetwork");
    };

    const handleFind = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        const ref = parseGithubRepoInput(query);
        const provider = createProvider();
        const username = ref ? null : provider.canonicalizeInput(query);
        if (!ref && !username) {
            setError(t("githubProjects.invalidInput"));
            return;
        }

        setPhase("fetching");
        try {
            const found = ref
                ? { repos: [await provider.fetchRepository(ref.owner, ref.repo)], truncated: false }
                : await provider.fetchRepositories(username!);
            const fresh = found.repos.filter((repo) => !existingKeys.has(githubRepoKey(repo.url) ?? ""));
            setLookup({
                provider,
                owner: ref?.owner ?? username!,
                repos: fresh,
                truncated: found.truncated,
                alreadyAdded: found.repos.length - fresh.length,
            });
            // A named repository is what the user asked for; a profile listing starts empty.
            setSelected(new Set(ref ? fresh.map((repo) => repo.name) : []));
            setPhase("picking");
        } catch (cause) {
            setError(describeError(cause, ref ? `${ref.owner}/${ref.repo}` : username!));
            setPhase("input");
        }
    };

    const handleAdd = async () => {
        if (!lookup) return;
        setPhase("adding");
        const chosen = lookup.repos.filter((repo) => selected.has(repo.name));
        // Never throws: failed lookups fall back to each repository's primary language.
        const languages = await lookup.provider.fetchLanguages(lookup.owner, chosen.map((repo) => repo.name));
        const { projects } = appendGithubProjects(existingProjects, chosen, { languages, createId });
        onApply(projects);
        onClose();
    };

    const toggle = (name: string) => {
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    return (
        <div
            className="fixed inset-0 z-[220] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-4"
            onClick={(event) => {
                if (event.target === event.currentTarget && !busy) onClose();
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="github-projects-title"
                data-testid="github-projects-dialog"
                className="relative flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col rounded-[1rem] border border-edge bg-surface-4 p-5 shadow-2xl sm:p-7"
            >
                <button
                    type="button"
                    onClick={onClose}
                    disabled={busy}
                    className="absolute right-4 top-4 text-faint transition-colors hover:text-strong disabled:opacity-40"
                    aria-label={t("githubImport.close")}
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="mb-4 flex shrink-0 items-start gap-3 pr-8">
                    <div className="rounded-xl bg-edge p-2.5">
                        <Github className="h-5 w-5 text-accent" />
                    </div>
                    <div className="min-w-0">
                        <h2 id="github-projects-title" className="text-xl font-semibold text-strong">
                            {t("githubProjects.title")}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-dim">{t("githubProjects.subtitle")}</p>
                    </div>
                </div>

                <p data-testid="github-projects-network-notice" className="mb-4 flex shrink-0 gap-2 rounded-xl border border-edge bg-surface-1 p-3 text-xs leading-5 text-mid">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {t("githubImport.networkNotice")}
                </p>

                <form onSubmit={(event) => void handleFind(event)} className="shrink-0 space-y-2">
                    <label htmlFor="github-projects-input" className="text-[11px] font-medium uppercase tracking-wider text-faint">
                        {t("githubProjects.inputLabel")}
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="github-projects-input"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={t("githubProjects.inputPlaceholder")}
                            disabled={busy}
                            autoComplete="off"
                            spellCheck={false}
                            data-testid="github-projects-input"
                            className="h-10 min-w-0 flex-1 rounded-xl border border-edge bg-surface-1 px-3 text-sm text-strong outline-none placeholder:text-faint/60 focus:border-faint"
                        />
                        <button
                            type="submit"
                            disabled={busy || !query.trim()}
                            data-testid="github-projects-find"
                            className="flex h-10 items-center gap-2 rounded-xl border border-edge bg-surface-1 px-4 text-sm text-strong transition-colors hover:bg-edge disabled:opacity-40"
                        >
                            {phase === "fetching" && <Loader2 className="h-4 w-4 animate-spin" />}
                            {t("githubProjects.find")}
                        </button>
                    </div>
                    {error && (
                        <p role="alert" data-testid="github-projects-error" className="text-xs text-danger-soft">
                            {error}
                        </p>
                    )}
                </form>

                {lookup && phase !== "fetching" && (
                    <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
                        {lookup.alreadyAdded > 0 && (
                            <p data-testid="github-projects-already-added" className="text-xs text-faint">
                                {t("githubProjects.alreadyAdded", { count: lookup.alreadyAdded })}
                            </p>
                        )}
                        {lookup.repos.length === 0 && lookup.alreadyAdded > 0 ? (
                            <p className="rounded-xl border border-edge bg-surface-1 p-4 text-sm text-mid">{t("githubProjects.allAdded")}</p>
                        ) : (
                            <RepoPicker
                                repos={lookup.repos}
                                selectedNames={selected}
                                truncated={lookup.truncated}
                                onToggle={toggle}
                                onSelectAll={() => setSelected(new Set(lookup.repos.map((repo) => repo.name)))}
                                onClearAll={() => setSelected(new Set())}
                            />
                        )}
                    </div>
                )}

                <div className="mt-5 flex shrink-0 justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="h-10 rounded-xl border border-edge px-4 text-sm text-faint transition-colors hover:text-strong disabled:opacity-40"
                    >
                        {t("githubImport.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleAdd()}
                        disabled={busy || !lookup || selected.size === 0}
                        data-testid="github-projects-add"
                        className="flex h-10 items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 text-sm font-medium text-accent transition-colors hover:bg-accent/15 disabled:opacity-40"
                    >
                        {phase === "adding" && <Loader2 className="h-4 w-4 animate-spin" />}
                        {t("githubProjects.add", { count: selected.size })}
                    </button>
                </div>
            </div>
        </div>
    );
}
