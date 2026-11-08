/**
 * People listed on /supporters. Add someone only after they opt in on Ko-fi
 * (or by email); Ko-fi names are never imported automatically.
 */
export interface Supporter {
    name: string;
    /** Optional link the supporter asked for. */
    url?: string;
    /** Monthly supporters are listed first. */
    monthly?: boolean;
}

export const SUPPORTERS: readonly Supporter[] = [];

export function orderedSupporters(list: readonly Supporter[] = SUPPORTERS): Supporter[] {
    return [...list].sort((a, b) => Number(Boolean(b.monthly)) - Number(Boolean(a.monthly)));
}
