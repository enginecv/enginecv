const AVATAR_SIZE = 460;
const AVATAR_TIMEOUT_MS = 10_000;

/**
 * Fetches a profile avatar and returns it as a data-URL suitable for
 * `basics.photo`. Any failure resolves to "" — the import proceeds photoless.
 * Avatar hosts are not counted against the api.github.com request budget.
 */
export async function fetchAvatarDataUrl(
    avatarUrl: string,
    fetchImpl: typeof fetch = fetch,
): Promise<string> {
    if (!avatarUrl) return "";

    try {
        const url = new URL(avatarUrl);
        url.searchParams.set("s", String(AVATAR_SIZE));

        const response = await fetchImpl(url.toString(), {
            signal: AbortSignal.timeout(AVATAR_TIMEOUT_MS),
        });
        if (!response.ok) return "";

        const blob = await response.blob();
        return await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
            reader.onerror = () => resolve("");
            reader.readAsDataURL(blob);
        });
    } catch {
        return "";
    }
}
