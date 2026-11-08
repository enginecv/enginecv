const SUPPORTED_LINK_SCHEME = /^(?:https?|mailto|tel):/i;

export function resolveExternalHref(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (SUPPORTED_LINK_SCHEME.test(trimmed)) return trimmed;
    if (trimmed.startsWith("//")) return `https:${trimmed}`;
    return `https://${trimmed}`;
}
