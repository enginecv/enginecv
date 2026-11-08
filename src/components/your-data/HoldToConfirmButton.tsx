"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

const TICK_MS = 50;

/**
 * Fires `onConfirm` after the button is held for `durationMs` (pointer, or
 * Space/Enter held down). Releasing early resets it. With reduced motion the
 * progress bar is replaced by a seconds countdown in the label.
 */
export function HoldToConfirmButton({
    label,
    holdingLabel,
    durationMs = 2000,
    disabled,
    onConfirm,
}: {
    label: string;
    holdingLabel: (secondsLeft: number) => string;
    durationMs?: number;
    disabled?: boolean;
    onConfirm: () => void;
}) {
    const [elapsed, setElapsed] = useState(0);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);
    const fired = useRef(false);

    const stop = () => {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setElapsed(0);
    };

    const start = () => {
        if (disabled || timer.current) return;
        fired.current = false;
        const startedAt = Date.now();
        timer.current = setInterval(() => {
            const next = Date.now() - startedAt;
            if (next >= durationMs && !fired.current) {
                fired.current = true;
                stop();
                onConfirm();
                return;
            }
            setElapsed(next);
        }, TICK_MS);
    };

    useEffect(() => () => {
        if (timer.current) clearInterval(timer.current);
    }, []);

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if ((event.key === " " || event.key === "Enter") && !event.repeat) {
            event.preventDefault();
            start();
        }
    };
    const onKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === " " || event.key === "Enter") stop();
    };

    const holding = elapsed > 0;
    const progress = Math.min(1, elapsed / durationMs);
    const secondsLeft = Math.max(1, Math.ceil((durationMs - elapsed) / 1000));

    return (
        <button
            type="button"
            disabled={disabled}
            onPointerDown={start}
            onPointerUp={stop}
            onPointerLeave={stop}
            onPointerCancel={stop}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onBlur={stop}
            onClick={(event) => event.preventDefault()}
            className="relative w-full overflow-hidden rounded-xl border border-danger/40 bg-danger-tint px-5 py-3 text-sm font-semibold text-danger-soft transition-colors hover:border-danger disabled:opacity-50"
            data-testid="hold-to-delete"
        >
            <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-danger/20 motion-reduce:hidden"
                style={{ width: `${progress * 100}%` }}
            />
            <span className="relative" aria-live="polite">
                {holding ? holdingLabel(secondsLeft) : label}
            </span>
        </button>
    );
}
