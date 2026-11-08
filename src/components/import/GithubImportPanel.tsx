"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { fetchAvatarDataUrl } from "@/lib/import/avatar";
import { createGithubProvider } from "@/lib/import/github";
import { mapToResume } from "@/lib/import/map-to-resume";
import { persistImportedResume } from "@/lib/import/persist-imported-resume";
import {
    cacheLookupOutcome,
    cacheSuggestionsOutcome,
    initialPreviewState,
    initialSuggestionsState,
    onInputChanged,
    onLookupResult,
    onSuggestionsNeeded,
    onSuggestionsResult,
    PREVIEW_DEBOUNCE_MS,
    type LookupResult,
    type PreviewCache,
    type PreviewState,
    type SuggestionsCache,
    type SuggestionsResult,
    type SuggestionsState,
} from "@/lib/import/profile-preview";
import {
    ImportError,
    type ImportErrorKind,
    type ImportProvider,
    type NormalizedOrganization,
    type NormalizedProfile,
    type NormalizedRepository,
} from "@/lib/import/provider";
import { resumeSchema, type Resume } from "@/lib/schema";
import { CollapsibleImportSection } from "./CollapsibleImportSection";
import { getDefaultSelectedOrganizationLogins, OrganizationPicker } from "./OrganizationPicker";
import { ProfilePreviewCard } from "./ProfilePreviewCard";
import { ProfileSuggestionList } from "./ProfileSuggestionList";
import { getDefaultSelectedRepoNames, RepoPicker } from "./RepoPicker";

type PanelStep = "input" | "fetching-profile" | "fetching-repos" | "fetching-orgs" | "picking" | "importing" | "error";

type FailedStep = "profile" | "repos" | "orgs" | "import";

interface ImportDialogError {
    kind: ImportErrorKind;
    failedStep: FailedStep;
    username: string;
    resetAt: Date | null;
}

export interface GithubImportPanelProps {
    /** Called with the new resume id once it is saved. */
    onDone: (id: string) => void;
    /** Cancel inside a dialog. Without it the panel starts over and hides the input-step cancel. */
    onCancel?: () => void;
    /** Reports when saving is in progress, so a host dialog can block closing. */
    onBusyChange?: (busy: boolean) => void;
    /** Id of the element that names the panel, when it stands on a page. */
    labelledBy?: string;
    provider?: ImportProvider;
    /**
     * Provider for confirm-on-type preview lookups. Defaults to `provider`
     * when given (tests), otherwise a dedicated instance per panel session
     * so previews never consume the import's request budget.
     */
    previewProvider?: ImportProvider;
    persistResume?: (resume: Resume) => Promise<string>;
}

function toImportDialogError(error: unknown, failedStep: FailedStep, username: string): ImportDialogError {
    if (error instanceof ImportError) {
        return {
            kind: error.kind,
            failedStep,
            username,
            resetAt: error.resetAt,
        };
    }

    return {
        kind: "network",
        failedStep,
        username,
        resetAt: null,
    };
}

/** The GitHub profile import flow: username, profile and repo choice, save. Used by the dialog and the tool page. */
export function GithubImportPanel({
    onDone,
    onCancel,
    onBusyChange,
    labelledBy,
    provider,
    previewProvider,
    persistResume = persistImportedResume,
}: GithubImportPanelProps) {
    const { t, tn, locale } = useTranslation();
    const fallbackProvider = useMemo(() => createGithubProvider(), []);
    const importProvider = provider ?? fallbackProvider;
    const requestIdRef = useRef(0);

    const [previewState, setPreviewState] = useState<PreviewState>(initialPreviewState);
    const previewStateRef = useRef<PreviewState>(initialPreviewState);
    const previewCacheRef = useRef<PreviewCache>(new Map());
    const previewSessionProviderRef = useRef<ImportProvider | null>(null);

    const [suggestionsState, setSuggestionsState] = useState<SuggestionsState>(initialSuggestionsState);
    const suggestionsStateRef = useRef<SuggestionsState>(initialSuggestionsState);
    const suggestionsCacheRef = useRef<SuggestionsCache>(new Map());

    const applySuggestionsState = useCallback((next: SuggestionsState) => {
        suggestionsStateRef.current = next;
        setSuggestionsState(next);
    }, []);

    const getPreviewProvider = useCallback((): ImportProvider => {
        if (previewProvider) return previewProvider;
        if (provider) return provider;
        // Fresh instance per dialog session: its request ceiling bounds
        // preview spend independently of the import's budget.
        if (!previewSessionProviderRef.current) {
            previewSessionProviderRef.current = createGithubProvider();
        }
        return previewSessionProviderRef.current;
    }, [previewProvider, provider]);

    const runSuggestionSearch = useCallback(
        async (query: string) => {
            let result: SuggestionsResult;
            try {
                const suggestions = await getPreviewProvider().searchUsers!(query);
                result = { kind: "found", suggestions };
            } catch {
                result = { kind: "error" };
            }
            cacheSuggestionsOutcome(suggestionsCacheRef.current, query, result);
            applySuggestionsState(onSuggestionsResult(suggestionsStateRef.current, query, result));
        },
        [applySuggestionsState, getPreviewProvider],
    );

    // Suggestions exist only while the preview says not-found; any other
    // preview state clears them.
    const syncSuggestions = useCallback(
        (preview: PreviewState) => {
            const query =
                preview.status === "not-found" && getPreviewProvider().searchUsers
                    ? preview.target
                    : "";
            const previous = suggestionsStateRef.current;
            const next = onSuggestionsNeeded(previous, suggestionsCacheRef.current, query);
            applySuggestionsState(next);
            const startsNewSearch =
                next.status === "loading" &&
                !(previous.status === "loading" && previous.query === next.query);
            if (startsNewSearch) void runSuggestionSearch(next.query);
        },
        [applySuggestionsState, getPreviewProvider, runSuggestionSearch],
    );

    const applyPreviewState = useCallback(
        (next: PreviewState) => {
            previewStateRef.current = next;
            setPreviewState(next);
            syncSuggestions(next);
        },
        [syncSuggestions],
    );

    const runPreviewLookup = useCallback(
        async (target: string) => {
            let result: LookupResult;
            try {
                const previewProfile = await getPreviewProvider().fetchProfile(target);
                result = { kind: "found", profile: previewProfile };
            } catch (error) {
                result = { kind: error instanceof ImportError ? error.kind : "network" };
            }
            cacheLookupOutcome(previewCacheRef.current, target, result);
            applyPreviewState(onLookupResult(previewStateRef.current, target, result));
        },
        [applyPreviewState, getPreviewProvider],
    );

    const [rawInput, setRawInput] = useState("");
    const [inputError, setInputError] = useState("");
    const [step, setStep] = useState<PanelStep>("input");
    const [username, setUsername] = useState("");
    const [profile, setProfile] = useState<NormalizedProfile | null>(null);
    const [repos, setRepos] = useState<NormalizedRepository[]>([]);
    const [organizations, setOrganizations] = useState<NormalizedOrganization[]>([]);
    const [truncated, setTruncated] = useState(false);
    const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
    const [selectedOrganizationLogins, setSelectedOrganizationLogins] = useState<Set<string>>(new Set());
    const [dialogError, setDialogError] = useState<ImportDialogError | null>(null);

    const reset = useCallback(() => {
        requestIdRef.current += 1;
        setRawInput("");
        setInputError("");
        setStep("input");
        setUsername("");
        setProfile(null);
        setRepos([]);
        setOrganizations([]);
        setTruncated(false);
        setSelectedNames(new Set());
        setSelectedOrganizationLogins(new Set());
        setDialogError(null);
        applyPreviewState(initialPreviewState);
        previewCacheRef.current = new Map();
        suggestionsCacheRef.current = new Map();
        previewSessionProviderRef.current = null;
    }, [applyPreviewState]);

    // Confirm-on-type preview: after a pause, look up the exact canonical
    // username. In-flight results for a superseded target are discarded by
    // the reducer, so a cleared timer or late response can never render stale.
    useEffect(() => {
        if (step !== "input") return;
        const timer = setTimeout(() => {
            const previous = previewStateRef.current;
            const next = onInputChanged(previous, previewCacheRef.current, rawInput);
            applyPreviewState(next);
            const startsNewLookup =
                next.status === "loading" &&
                !(previous.status === "loading" && previous.target === next.target);
            if (startsNewLookup) void runPreviewLookup(next.target);
        }, PREVIEW_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [step, rawInput, applyPreviewState, runPreviewLookup]);

    // On a page there is nothing to close: cancel starts over.
    const cancel = useCallback(() => {
        if (onCancel) onCancel();
        else reset();
    }, [onCancel, reset]);

    const fail = useCallback((error: unknown, failedStep: FailedStep, failedUsername: string) => {
        setDialogError(toImportDialogError(error, failedStep, failedUsername));
        setStep("error");
    }, []);

    const fetchOrganizations = useCallback(
        async (
            nextUsername: string,
            nextProfile: NormalizedProfile,
            nextRepos: NormalizedRepository[],
            nextTruncated: boolean,
            requestId: number,
        ) => {
            setStep("fetching-orgs");
            try {
                const nextOrganizations = await importProvider.fetchOrganizations(nextUsername);
                if (requestId !== requestIdRef.current) return;
                setProfile(nextProfile);
                setRepos(nextRepos);
                setOrganizations(nextOrganizations);
                setTruncated(nextTruncated);
                setSelectedNames(getDefaultSelectedRepoNames(nextRepos));
                setSelectedOrganizationLogins(getDefaultSelectedOrganizationLogins(nextOrganizations));
                setDialogError(null);
                setStep("picking");
            } catch (error) {
                if (requestId !== requestIdRef.current) return;
                setProfile(nextProfile);
                setRepos(nextRepos);
                setTruncated(nextTruncated);
                setSelectedNames(getDefaultSelectedRepoNames(nextRepos));
                fail(error, "orgs", nextUsername);
            }
        },
        [fail, importProvider],
    );

    const fetchRepos = useCallback(
        async (nextUsername: string, nextProfile: NormalizedProfile, requestId: number) => {
            setStep("fetching-repos");
            try {
                const result = await importProvider.fetchRepositories(nextUsername);
                if (requestId !== requestIdRef.current) return;
                await fetchOrganizations(nextUsername, nextProfile, result.repos, result.truncated, requestId);
            } catch (error) {
                if (requestId !== requestIdRef.current) return;
                setProfile(nextProfile);
                fail(error, "repos", nextUsername);
            }
        },
        [fail, fetchOrganizations, importProvider],
    );

    const fetchProfileAndRepos = useCallback(
        async (nextUsername: string) => {
            const requestId = requestIdRef.current + 1;
            requestIdRef.current = requestId;
            setUsername(nextUsername);
            setDialogError(null);
            setStep("fetching-profile");

            try {
                const nextProfile = await importProvider.fetchProfile(nextUsername);
                if (requestId !== requestIdRef.current) return;
                await fetchRepos(nextUsername, nextProfile, requestId);
            } catch (error) {
                if (requestId !== requestIdRef.current) return;
                fail(error, "profile", nextUsername);
            }
        },
        [fail, fetchRepos, importProvider],
    );

    const submit = useCallback(() => {
        const nextUsername = importProvider.canonicalizeInput(rawInput);
        if (!nextUsername) {
            setInputError(t("githubImport.invalidInput"));
            return;
        }

        setInputError("");
        void fetchProfileAndRepos(nextUsername);
    }, [fetchProfileAndRepos, importProvider, rawInput, t]);

    const retry = useCallback(() => {
        if (!dialogError) return;
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;

        if (dialogError.failedStep === "repos" && profile) {
            void fetchRepos(dialogError.username, profile, requestId);
            return;
        }

        if (dialogError.failedStep === "orgs" && profile) {
            void fetchOrganizations(dialogError.username, profile, repos, truncated, requestId);
            return;
        }

        if (dialogError.failedStep === "import") {
            setStep("picking");
            setDialogError(null);
            return;
        }

        void fetchProfileAndRepos(dialogError.username);
    }, [dialogError, fetchOrganizations, fetchProfileAndRepos, fetchRepos, profile, repos, truncated]);

    const confirmImport = useCallback(async () => {
        if (!profile) return;
        const selectedRepos = repos.filter((repo) => selectedNames.has(repo.name));
        const selectedRepoNames = selectedRepos.map((repo) => repo.name);
        setStep("importing");
        setDialogError(null);

        try {
            const languages = await importProvider.fetchLanguages(username, selectedRepoNames);
            const avatarDataUrl = await fetchAvatarDataUrl(profile.avatarUrl);
            const mapped = mapToResume(profile, repos, selectedRepoNames, languages, avatarDataUrl, {
                organizations,
                selectedOrganizationLogins,
            });
            const parsed = resumeSchema.parse(mapped);
            const id = await persistResume(parsed);
            onDone(id);
        } catch (error) {
            fail(error, "import", username);
        }
    }, [
        fail,
        importProvider,
        onDone,
        persistResume,
        profile,
        repos,
        selectedNames,
        selectedOrganizationLogins,
        organizations,
        username,
    ]);

    const toggleRepo = useCallback((name: string) => {
        setSelectedNames((current) => {
            const next = new Set(current);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelectedNames(new Set(repos.map((repo) => repo.name)));
    }, [repos]);

    const clearAll = useCallback(() => {
        setSelectedNames(new Set());
    }, []);

    const toggleOrganization = useCallback((login: string) => {
        setSelectedOrganizationLogins((current) => {
            const next = new Set(current);
            if (next.has(login)) {
                next.delete(login);
            } else {
                next.add(login);
            }
            return next;
        });
    }, []);

    useEffect(() => {
        onBusyChange?.(step === "importing");
    }, [onBusyChange, step]);

    const loading =
        step === "fetching-profile" || step === "fetching-repos" || step === "fetching-orgs" || step === "importing";
    const selectedCount = selectedNames.size;
    const selectedOrganizationCount = selectedOrganizationLogins.size;
    const hasSelectedImportData = selectedCount > 0 || selectedOrganizationCount > 0;
    const selectedRepositoryLabel = tn("githubImport.repositoryCount", selectedCount);
    const selectedOrganizationLabel = tn("githubImport.organizationCount", selectedOrganizationCount);
    const importConfirmLabel = !hasSelectedImportData
        ? t("githubImport.confirmBasicsOnly")
        : selectedCount > 0 && selectedOrganizationCount > 0
            ? t("githubImport.confirmSelectionWithLabels", {
                repositories: selectedRepositoryLabel,
                organizations: selectedOrganizationLabel,
            })
            : selectedOrganizationCount > 0
                ? t("githubImport.confirmOrganizations", { organizations: selectedOrganizationLabel })
                : tn("githubImport.confirm", selectedCount);
    const resetTime =
        dialogError?.resetAt &&
        new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(dialogError.resetAt);

    return (
        <div aria-labelledby={labelledBy} role={labelledBy ? "region" : undefined} data-testid="github-import-panel">
            {step === "input" && (
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <label className="block">
                        <span className="mb-2 block text-sm font-medium text-bright">
                            {t("githubImport.inputLabel")}
                        </span>
                        <input
                            value={rawInput}
                            onChange={(event) => {
                                const value = event.target.value;
                                setRawInput(value);
                                if (inputError) setInputError("");
                                // Hide a preview that no longer matches what's typed
                                // immediately, instead of waiting for the debounce.
                                const current = previewStateRef.current;
                                if (
                                    current.status !== "idle" &&
                                    importProvider.canonicalizeInput(value) !== current.target
                                ) {
                                    applyPreviewState(initialPreviewState);
                                }
                            }}
                            data-testid="github-import-input"
                            placeholder={t("githubImport.inputPlaceholder")}
                            className="w-full rounded-xl border border-edge bg-surface-1 px-4 py-3 text-sm text-strong outline-none transition-colors placeholder:text-edge-strong focus:border-accent"
                        />
                    </label>
                    {inputError && (
                        <p data-testid="github-import-input-error" className="text-sm text-danger-soft">
                            {inputError}
                        </p>
                    )}
                    <ProfilePreviewCard
                        state={previewState}
                        hideNotFound={
                            suggestionsState.status === "shown" &&
                            suggestionsState.suggestions.length > 0
                        }
                    />
                    <ProfileSuggestionList
                        state={suggestionsState}
                        onPick={(login) => {
                            setRawInput(login);
                            // Chosen login becomes the input; the debounce
                            // then confirms it with the full preview card.
                            applyPreviewState(initialPreviewState);
                        }}
                    />
                    <div className="flex justify-end gap-3">
                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                            >
                                {t("githubImport.cancel")}
                            </button>
                        )}
                        <button
                            type="submit"
                            data-testid="github-import-submit"
                            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-soft"
                        >
                            {t("githubImport.continue")}
                        </button>
                    </div>
                </form>
            )}

            {(step === "fetching-profile" || step === "fetching-repos" || step === "importing") && (
                <div className="flex min-h-40 items-center justify-center rounded-xl border border-edge bg-surface-1 p-8 text-center">
                    <div>
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />
                        <p className="mt-4 text-sm text-bright">
                            {step === "importing"
                                ? t("githubImport.importing")
                                : t("githubImport.fetching")}
                        </p>
                    </div>
                </div>
            )}

            {step === "picking" && (
                <div className="space-y-4">
                    <p className="text-sm leading-6 text-mid">
                        {t("githubImport.pickerSubtitle", { username })}
                    </p>
                    <CollapsibleImportSection
                        title={t("githubImport.reposTitle")}
                        count={`${selectedNames.size}/${repos.length}`}
                        testId="github-import-repos-section"
                    >
                        <RepoPicker
                            repos={repos}
                            selectedNames={selectedNames}
                            truncated={truncated}
                            onToggle={toggleRepo}
                            onSelectAll={selectAll}
                            onClearAll={clearAll}
                        />
                    </CollapsibleImportSection>
                    <CollapsibleImportSection
                        title={t("githubImport.organizationsTitle")}
                        subtitle={t("githubImport.organizationsSubtitle")}
                        count={`${selectedOrganizationLogins.size}/${organizations.length}`}
                        testId="github-import-organizations-section"
                    >
                        <OrganizationPicker
                            organizations={organizations}
                            selectedLogins={selectedOrganizationLogins}
                            onToggle={toggleOrganization}
                        />
                    </CollapsibleImportSection>
                    {!hasSelectedImportData && (
                        <p
                            data-testid="github-import-zero-selected-warning"
                            className="rounded-lg border border-warning-tint2 bg-warning-tint px-3 py-2 text-xs leading-5 text-warning"
                        >
                            {t("githubImport.zeroSelectedWarning")}
                        </p>
                    )}
                    <div className="flex flex-wrap justify-end gap-3">
                        <button
                            type="button"
                            onClick={cancel}
                            className="rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                        >
                            {t("githubImport.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={() => void confirmImport()}
                            data-testid="github-import-confirm"
                            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-soft"
                        >
                            {importConfirmLabel}
                        </button>
                    </div>
                </div>
            )}

            {step === "error" && dialogError && (
                <div className="space-y-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <p className="text-sm leading-6 text-danger-soft">
                        {dialogError.kind === "not-found" &&
                            t("githubImport.errorNotFound", { username: dialogError.username })}
                        {dialogError.kind === "rate-limited" && t("githubImport.errorRateLimited")}
                        {dialogError.kind === "network" && t("githubImport.errorNetwork")}
                    </p>
                    {dialogError.kind === "rate-limited" && resetTime && (
                        <p className="text-sm leading-6 text-danger-soft">
                            {t("githubImport.errorRateLimitReset", { time: resetTime })}
                        </p>
                    )}
                    <div className="flex flex-wrap justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setStep("input");
                                setDialogError(null);
                            }}
                            className="rounded-xl border border-red-300/30 px-4 py-2.5 text-sm font-medium text-danger-soft transition-colors hover:border-danger"
                        >
                            {t("githubImport.back")}
                        </button>
                        <button
                            type="button"
                            onClick={retry}
                            data-testid="github-import-retry"
                            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-soft"
                        >
                            {t("githubImport.retry")}
                        </button>
                    </div>
                </div>
            )}

            {loading && <span className="sr-only">{t("githubImport.fetching")}</span>}
        </div>
    );
}
