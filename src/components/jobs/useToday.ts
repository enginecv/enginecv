"use client";

import { useSyncExternalStore } from "react";
import { localDateOnly, msUntilLocalMidnight } from "@/lib/jobs/dates";

function subscribe(notify: () => void): () => void {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
        timer = setTimeout(() => {
            notify();
            arm();
        }, msUntilLocalMidnight() + 1000);
    };
    arm();
    window.addEventListener("focus", notify);
    document.addEventListener("visibilitychange", notify);
    return () => {
        clearTimeout(timer);
        window.removeEventListener("focus", notify);
        document.removeEventListener("visibilitychange", notify);
    };
}

/**
 * The viewer's local date (`YYYY-MM-DD`), recomputed at local midnight and whenever the tab regains focus,
 * so "due today" and "overdue" stay right across a night or a time-zone change.
 */
export function useToday(): string {
    return useSyncExternalStore(subscribe, () => localDateOnly(), () => localDateOnly());
}

const MINUTE = 60_000;

function subscribeMinute(notify: () => void): () => void {
    const timer = setInterval(notify, 30_000);
    window.addEventListener("focus", notify);
    return () => {
        clearInterval(timer);
        window.removeEventListener("focus", notify);
    };
}

const minuteNow = () => Math.floor(Date.now() / MINUTE) * MINUTE;

/** The current time to the minute, for "interview passed" and "next seven days"; stable between minutes. */
export function useNow(): number {
    return useSyncExternalStore(subscribeMinute, minuteNow, minuteNow);
}
