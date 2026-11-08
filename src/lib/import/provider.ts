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
}
