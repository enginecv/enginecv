/**
 * Referral links (`/r/<slug>`) count how often each link is followed.
 *
 * The count is a plain hit counter: nothing about the visitor is stored or
 * derived (no cookies, no IP or IP hash), so a repeated visit counts again.
 */
export const REFERRAL_COUNT_PREFIX = "count:";

const REFERRAL_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

export function normalizeReferralSlug(raw: string | undefined | null): string | null {
    if (!raw) return null;
    const lowered = raw.trim().toLowerCase();
    if (!REFERRAL_SLUG_PATTERN.test(lowered)) return null;
    return lowered;
}

export interface ReferralKv {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
    list(options: { prefix: string; cursor?: string }): Promise<{
        keys: Array<{ name: string }>;
        cursor?: string;
        list_complete?: boolean;
    }>;
}

export async function incrementReferralCount(kv: ReferralKv, slug: string): Promise<number> {
    const key = `${REFERRAL_COUNT_PREFIX}${slug}`;
    const current = await kv.get(key);
    const next = (current ? parseInt(current, 10) : 0) + 1;
    await kv.put(key, String(next));
    return next;
}

export async function listReferralCounts(kv: ReferralKv): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    let cursor: string | undefined;
    do {
        const page: { keys: Array<{ name: string }>; cursor?: string; list_complete?: boolean } =
            await kv.list({ prefix: REFERRAL_COUNT_PREFIX, cursor });
        for (const { name } of page.keys) {
            const slug = name.slice(REFERRAL_COUNT_PREFIX.length);
            const value = await kv.get(name);
            counts[slug] = value ? parseInt(value, 10) : 0;
        }
        cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return counts;
}
