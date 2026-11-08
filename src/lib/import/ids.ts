export function slugId(value: string): string {
    const slug = value
        .trim()
        .toLowerCase()
        .replace(/#/g, " sharp ")
        .replace(/\+/g, " plus ")
        .replace(/&/g, " and ")
        .replace(/\./g, " dot ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return slug || "item";
}

export function uniqueImportId(prefix: string, value: string, usedIds: Set<string>): string {
    const base = `${prefix}-${slugId(value)}`;
    let id = base;
    let suffix = 2;

    while (usedIds.has(id)) {
        id = `${base}-${suffix}`;
        suffix += 1;
    }

    usedIds.add(id);
    return id;
}
