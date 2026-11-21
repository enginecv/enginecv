"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const UNDO_WINDOW_MS = 8000;

/** Holds one thing that can still be undone, and forgets it after the window. */
export function useUndoSlot<T>(): { item: T | null; offer: (item: T) => void; clear: () => void } {
    const [item, setItem] = useState<T | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clear = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        setItem(null);
    }, []);
    const offer = useCallback((next: T) => {
        if (timer.current) clearTimeout(timer.current);
        setItem(next);
        timer.current = setTimeout(() => setItem(null), UNDO_WINDOW_MS);
    }, []);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
    return { item, offer, clear };
}

/** The little bar at the bottom: what was deleted and a button to bring it back. */
export function UndoToast({ message, undoLabel, onUndo, testId }: { message: string; undoLabel: string; onUndo: () => void; testId: string }) {
    return (
        <div role="status" className="fixed bottom-6 left-1/2 z-[210] flex -translate-x-1/2 items-center gap-4 rounded-xl border border-edge bg-surface-4 px-4 py-3 shadow-2xl" data-testid={testId}>
            <span className="text-sm text-strong">{message}</span>
            <button type="button" onClick={onUndo} data-testid={`${testId}-button`} className="text-sm font-bold text-accent hover:underline">{undoLabel}</button>
        </div>
    );
}
