import { formatPath, type PathSegment } from "@/lib/agent/authoring/notices";

export interface ChangeSummary {
    added: string[]; changed: string[]; removed: string[]; moved: string[]; regeneratedIds: string[];
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const identified = (array: unknown[]): array is Array<Record<string, unknown> & { id: string }> => array.every(value => object(value) && typeof value.id === "string");

/** Generic structural diff. Only the root persistence timestamp is ignored. */
export function diffResume(before: unknown, after: unknown): ChangeSummary {
    const result: ChangeSummary = { added: [], changed: [], removed: [], moved: [], regeneratedIds: [] };
    const walk = (a: unknown, b: unknown, path: PathSegment[]) => {
        if (Object.is(a, b)) return;
        if (Array.isArray(a) && Array.isArray(b)) {
            if (identified(a) && identified(b)) {
                const old = new Map(a.map((entry, i) => [entry.id, { entry, i }]));
                const next = new Set(b.map(entry => entry.id));
                b.forEach((entry, i) => {
                    const previous = old.get(entry.id);
                    if (!previous) result.added.push(formatPath([...path, i]));
                    else {
                        if (previous.i !== i) result.moved.push(formatPath([...path, i]));
                        walk(previous.entry, entry, [...path, i]);
                    }
                });
                a.forEach((entry, i) => { if (!next.has(entry.id)) result.removed.push(formatPath([...path, i])); });
            } else {
                for (let i = 0; i < Math.max(a.length, b.length); i++) walk(a[i], b[i], [...path, i]);
            }
        } else if (object(a) && object(b)) {
            for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
                if (path.length === 0 && key === "updatedAt") continue;
                walk(a[key], b[key], [...path, key]);
            }
        } else result[a === undefined ? "added" : b === undefined ? "removed" : "changed"].push(formatPath(path));
    };
    walk(before, after, []);
    return result;
}

export function summaryIsEmpty(summary: ChangeSummary): boolean {
    return Object.values(summary).every(paths => paths.length === 0);
}
