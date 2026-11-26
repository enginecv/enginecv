"use client";

import { useSyncExternalStore } from "react";
import { jobReturnHref } from "@/lib/dashboard-tab-url";

const noSubscription = () => () => {};

/**
 * The tracked job an editor was opened from (`?job=<id>`), as the href its back link should use, or
 * `fallback`. Read from the address after hydration, so the server and first client render agree.
 */
export function useJobReturnHref(fallback: string): string {
    return useSyncExternalStore(noSubscription, () => jobReturnHref(window.location.search) ?? fallback, () => fallback);
}
