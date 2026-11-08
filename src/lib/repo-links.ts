export type RepoPlatformKey =
    | "github"
    | "gitlab"
    | "bitbucket"
    | "codeberg"
    | "sourcehut"
    | "azure-devops"
    | "other";

export interface RepoPlatform {
    key: RepoPlatformKey;
    label: string;
    hostPatterns: RegExp[];
    accent: string;
}

export const REPO_PLATFORMS: RepoPlatform[] = [
    {
        key: "github",
        label: "GitHub",
        hostPatterns: [/(^|\.)github\.com$/i],
        accent: "#f0f6fc",
    },
    {
        key: "gitlab",
        label: "GitLab",
        hostPatterns: [/(^|\.)gitlab\.com$/i, /(^|\.)gitlab\./i],
        accent: "#fc6d26",
    },
    {
        key: "bitbucket",
        label: "Bitbucket",
        hostPatterns: [/(^|\.)bitbucket\.org$/i],
        accent: "#2684ff",
    },
    {
        key: "codeberg",
        label: "Codeberg",
        hostPatterns: [/(^|\.)codeberg\.org$/i],
        accent: "#2185d0",
    },
    {
        key: "sourcehut",
        label: "SourceHut",
        hostPatterns: [/(^|\.)sr\.ht$/i],
        accent: "#ffffff",
    },
    {
        key: "azure-devops",
        label: "Azure DevOps",
        hostPatterns: [/(^|\.)dev\.azure\.com$/i, /(^|\.)visualstudio\.com$/i],
        accent: "#0078d4",
    },
];

const OTHER_PLATFORM: RepoPlatform = {
    key: "other",
    label: "Repository",
    hostPatterns: [],
    accent: "#ffaa8d",
};

export function getPlatform(key: string | undefined | null): RepoPlatform {
    if (!key || key === "auto") return OTHER_PLATFORM;
    return REPO_PLATFORMS.find((p) => p.key === key) ?? OTHER_PLATFORM;
}

export function detectPlatform(url: string): RepoPlatform {
    if (!url) return OTHER_PLATFORM;
    let host = "";
    try {
        host = new URL(url).hostname.toLowerCase();
    } catch {
        return OTHER_PLATFORM;
    }
    for (const p of REPO_PLATFORMS) {
        if (p.hostPatterns.some((re) => re.test(host))) return p;
    }
    return OTHER_PLATFORM;
}

export interface ParsedRepo {
    platform: RepoPlatform;
    owner: string;
    name: string;
    host: string;
    href: string;
}

export function parseRepoUrl(url: string): ParsedRepo | null {
    if (!url) return null;
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    const host = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;
    const platform = detectPlatform(url);
    let owner = segments[0];
    let name = segments[segments.length - 1];
    if (platform.key === "azure-devops" && segments.length >= 4) {
        owner = segments[1];
        name = segments[3];
    } else if (platform.key === "gitlab" && segments.length > 2) {
        owner = segments.slice(0, -1).join("/");
        name = segments[segments.length - 1];
    }
    name = name.replace(/\.git$/i, "");
    return {
        platform,
        owner,
        name,
        host,
        href: parsed.toString(),
    };
}

export function repoDisplayName(repo: ParsedRepo | null, fallback?: string): string {
    if (!repo) return fallback ?? "";
    return `${repo.owner}/${repo.name}`;
}

export interface RepoMetadata {
    stars?: number;
    forks?: number;
    watchers?: number;
    language?: string;
    languages?: Array<{ name: string; share: number }>;
    description?: string;
    defaultBranch?: string;
    updatedAt?: string;
}

export interface RepoMetadataProvider {
    platform: RepoPlatformKey;
    fetch(repo: ParsedRepo, signal?: AbortSignal): Promise<RepoMetadata | null>;
}

const PROVIDER_REGISTRY = new Map<RepoPlatformKey, RepoMetadataProvider>();

export function registerRepoMetadataProvider(provider: RepoMetadataProvider): void {
    PROVIDER_REGISTRY.set(provider.platform, provider);
}

export function getRepoMetadataProvider(platform: RepoPlatformKey): RepoMetadataProvider | undefined {
    return PROVIDER_REGISTRY.get(platform);
}

export async function fetchRepoMetadata(url: string, signal?: AbortSignal): Promise<RepoMetadata | null> {
    const parsed = parseRepoUrl(url);
    if (!parsed) return null;
    const provider = getRepoMetadataProvider(parsed.platform.key);
    if (!provider) return null;
    return provider.fetch(parsed, signal);
}
