/**
 * Runs work over many items in slices so the browser can paint and handle typing in between. Parsing
 * and hashing a hundred documents in one go would hold the main thread; this keeps each synchronous
 * slice under a budget and yields between slices (constitution IV).
 */

export const SLICE_BUDGET_MS = 12;

export interface BatchOptions {
    /** Longest a synchronous run may take before yielding. */
    budgetMs?: number;
    now?: () => number;
    /** Gives the browser a turn; defaults to `scheduler.yield()` when present, else a macrotask. */
    yieldToBrowser?: () => Promise<void>;
}

function defaultYield(): Promise<void> {
    const scheduler = (globalThis as unknown as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
    if (scheduler?.yield) return scheduler.yield();
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Maps `items` with `work`, yielding to the browser whenever a slice has used its budget. Order is kept. */
export async function mapInSlices<T, R>(items: readonly T[], work: (item: T, index: number) => R, options: BatchOptions = {}): Promise<R[]> {
    const budget = options.budgetMs ?? SLICE_BUDGET_MS;
    const now = options.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    const yieldNow = options.yieldToBrowser ?? defaultYield;
    const results: R[] = [];
    let sliceStart = now();
    for (let index = 0; index < items.length; index += 1) {
        results.push(work(items[index], index));
        if (now() - sliceStart >= budget && index < items.length - 1) {
            await yieldNow();
            sliceStart = now();
        }
    }
    return results;
}

/** Same, for async work: the budget applies to the time spent between awaits. */
export async function forEachInSlices<T>(items: readonly T[], work: (item: T, index: number) => Promise<void> | void, options: BatchOptions = {}): Promise<void> {
    const budget = options.budgetMs ?? SLICE_BUDGET_MS;
    const now = options.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    const yieldNow = options.yieldToBrowser ?? defaultYield;
    let sliceStart = now();
    for (let index = 0; index < items.length; index += 1) {
        await work(items[index], index);
        if (now() - sliceStart >= budget && index < items.length - 1) {
            await yieldNow();
            sliceStart = now();
        }
    }
}
