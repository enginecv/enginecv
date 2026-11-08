// GitHub's published username constraint: alphanumeric with single interior
// hyphens, max 39 characters.
const USERNAME_PATTERN = /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/;

/**
 * Accepts a bare username, "@username", or a github.com profile/repo URL
 * (with or without scheme, "www.", trailing paths or query strings) and
 * returns the canonical username, or null when the input can never be valid.
 */
export function canonicalizeGithubInput(raw: string): string | null {
    let value = raw.trim();
    if (value.length === 0) return null;

    if (value.startsWith("@")) {
        value = value.slice(1);
    }

    if (/github\.com/i.test(value)) {
        const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
        let url: URL;
        try {
            url = new URL(withScheme);
        } catch {
            return null;
        }
        if (!/(^|\.)github\.com$/i.test(url.hostname)) return null;
        const [firstSegment] = url.pathname.split("/").filter(Boolean);
        if (!firstSegment) return null;
        value = firstSegment;
    }

    return USERNAME_PATTERN.test(value) ? value : null;
}
