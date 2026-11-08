export const ENGINECV_GITHUB_PROFILE_URL = "https://github.com/SafetImamovic";
export const ENGINECV_PORTFOLIO_URL = "https://safet.click";
export const ENGINECV_KOFI_URL = "https://ko-fi.com/safetimamovic";
export const ENGINECV_GITHUB_SPONSORS_URL = "https://github.com/sponsors/SafetImamovic";

/**
 * Ko-fi links go through `/go/kofi/<placement>`, which bumps the referral
 * counter `kofi-<placement>` and redirects to Ko-fi, so we can see which
 * placement converts without analytics.
 */
export function getKofiUrl(placement: string): string {
    return `/go/kofi/${encodeURIComponent(placement)}`;
}

export function kofiPlacementCounterSlug(placement: string): string {
    return `kofi-${placement}`;
}

/** GitHub Sponsors links stay hidden until the profile is approved and the build flag is on. */
export function githubSponsorsEnabled(): boolean {
    return process.env.NEXT_PUBLIC_GITHUB_SPONSORS_ENABLED === "true";
}

/** Same counting redirect as Ko-fi, via `/go/sponsors/<placement>`. */
export function getGithubSponsorsUrl(placement: string): string {
    return `/go/sponsors/${encodeURIComponent(placement)}`;
}

export function githubSponsorsPlacementCounterSlug(placement: string): string {
    return `github-sponsors-${placement}`;
}
