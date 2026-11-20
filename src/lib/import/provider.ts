import { z } from "zod";

export const normalizedProfileSchema = z.object({
    username: z.string().min(1),
    displayName: z.string().default(""),
    bio: z.string().default(""),
    location: z.string().default(""),
    website: z.string().default(""),
    company: z.string().default(""),
    avatarUrl: z.string().default(""),
    profileUrl: z.string().default(""),
    /** Public email, only when the person made it public on GitHub. */
    email: z.string().optional(),
    twitter: z.string().optional(),
    /** When the account was made (ISO), "" when unknown. */
    createdAt: z.string().optional(),
    publicRepos: z.number().int().nonnegative().optional(),
    followers: z.number().int().nonnegative().optional(),
    hireable: z.boolean().optional(),
});

export const normalizedRepositorySchema = z.object({
    name: z.string().min(1),
    description: z.string().default(""),
    topics: z.array(z.string()).default([]),
    stars: z.number().int().nonnegative().default(0),
    primaryLanguage: z.string().default(""),
    createdAt: z.string().default(""),
    pushedAt: z.string().default(""),
    isFork: z.boolean().default(false),
    isArchived: z.boolean().default(false),
    isPrivate: z.boolean().default(false),
    url: z.string().default(""),
    /** The project's own website or live demo, when it has one. */
    homepage: z.string().optional(),
    /** SPDX id such as "MIT", "" when none. */
    license: z.string().optional(),
    forks: z.number().int().nonnegative().optional(),
});

export const normalizedOrganizationSchema = z.object({
    login: z.string().min(1),
    name: z.string().default(""),
    description: z.string().default(""),
    url: z.string().default(""),
    avatarUrl: z.string().default(""),
});

export type NormalizedProfile = z.infer<typeof normalizedProfileSchema>;
export type NormalizedRepository = z.infer<typeof normalizedRepositorySchema>;
export type NormalizedOrganization = z.infer<typeof normalizedOrganizationSchema>;

export const profileSuggestionSchema = z.object({
    login: z.string().min(1),
    avatarUrl: z.string().default(""),
});

/** Lightweight user-search hit; search results carry no display name. */
export type ProfileSuggestion = z.infer<typeof profileSuggestionSchema>;

export type ImportErrorKind = "not-found" | "rate-limited" | "network";

export class ImportError extends Error {
    kind: ImportErrorKind;
    /** Only meaningful for kind === "rate-limited"; null when the reset time is unknown. */
    resetAt: Date | null;

    constructor(kind: ImportErrorKind, resetAt: Date | null = null) {
        super(`import failed: ${kind}`);
        this.name = "ImportError";
        this.kind = kind;
        this.resetAt = resetAt;
    }
}

export interface RepositoryFetchResult {
    /** Picker order: stars descending, then most recently pushed. */
    repos: NormalizedRepository[];
    /** True when the profile had more repositories than the fetch ceiling covers. */
    truncated: boolean;
}

/** Per-repo language byte counts, keyed by repository name. */
export type LanguageBreakdown = Map<string, Record<string, number>>;

/** What the README and dependency files of one repository say, read without the API. */
export interface RepoDetails {
    /** First meaningful paragraph of the README, plain text. */
    summary: string;
    /** Technologies recognised from dependency files, display names. */
    stack: string[];
}

/** Merged pull requests the person made to projects they do not own. */
export interface Contribution {
    /** "owner/name". */
    repo: string;
    url: string;
    mergedPrs: number;
    /** A few pull request titles, newest first. */
    titles: string[];
}

export interface ImportProvider {
    name: string;
    /** Pure. Returns the canonical username, or null for input that can never be valid. */
    canonicalizeInput(raw: string): string | null;
    /** Throws ImportError. */
    fetchProfile(username: string): Promise<NormalizedProfile>;
    /** Throws ImportError. */
    fetchRepositories(username: string): Promise<RepositoryFetchResult>;
    /** Public organization memberships only. Throws ImportError. */
    fetchOrganizations(username: string): Promise<NormalizedOrganization[]>;
    /**
     * Byte counts for up to the provider's lookup cap (extra names are ignored).
     * Individual lookup failures degrade silently — callers fall back to
     * NormalizedRepository.primaryLanguage. Never throws.
     */
    fetchLanguages(username: string, repoNames: string[]): Promise<LanguageBreakdown>;
    /**
     * Similar accounts for a username that failed an exact lookup, best first.
     * Optional: providers without a search surface omit it and callers skip
     * the suggestion flow. Throws ImportError.
     */
    searchUsers?(query: string): Promise<ProfileSuggestion[]>;
    /** The profile README (`user/user`), plain text; "" when there is none or it cannot be read. Never throws. */
    fetchProfileReadme?(username: string): Promise<string>;
    /** README summaries and recognised stacks for the named repositories. Failures leave a repo out. Never throws. */
    fetchRepoDetails?(username: string, repos: Array<{ name: string; primaryLanguage: string }>): Promise<Map<string, RepoDetails>>;
    /** Merged pull requests to other people's projects, most active first. Never throws. */
    fetchContributions?(username: string): Promise<Contribution[]>;
}
