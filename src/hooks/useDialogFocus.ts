"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type=\"hidden\"])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex=\"-1\"])",
    "[contenteditable=\"true\"]",
].join(",");

// Open dialogs, innermost last: only the topmost one traps focus and handles Escape.
const openDialogs: HTMLElement[] = [];

// The last element focused outside every dialog. A dialog whose field uses
// autoFocus already holds focus when its effect runs, so the trigger that opened
// it has to come from here.
let lastFocusOutsideDialogs: HTMLElement | null = null;
let focusTrackerInstalled = false;

function installFocusTracker() {
    if (focusTrackerInstalled || typeof document === "undefined") return;
    focusTrackerInstalled = true;
    document.addEventListener("focusin", (event) => {
        const target = event.target;
        // Checked by markup rather than the open-dialog stack: autoFocus fires during
        // commit, before the dialog's effect has registered it.
        if (target instanceof HTMLElement && !target.closest("[role=\"dialog\"], [aria-modal=\"true\"]")) {
            lastFocusOutsideDialogs = target;
        }
    }, true);
}

function focusableIn(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => !element.closest("[inert]") && element.getAttribute("aria-hidden") !== "true" && element.getClientRects().length > 0,
    );
}

/**
 * Modal dialog focus management (WCAG 2.4.3 / ARIA dialog pattern):
 * moves focus into the dialog when it opens, keeps Tab and Shift+Tab inside it,
 * closes on Escape when `onEscape` is given, and returns focus to the element
 * that was focused before the dialog opened.
 *
 * Attach the returned ref to the element with `role="dialog"`.
 */
export function useDialogFocus<T extends HTMLElement = HTMLDivElement>(
    open: boolean,
    onEscape?: () => void,
): RefObject<T | null> {
    const ref = useRef<T | null>(null);
    const onEscapeRef = useRef(onEscape);
    installFocusTracker();

    useEffect(() => {
        onEscapeRef.current = onEscape;
    }, [onEscape]);

    useEffect(() => {
        if (!open) return;
        const container = ref.current;
        if (!container) return;

        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previouslyFocused = active && !container.contains(active) ? active : lastFocusOutsideDialogs;
        openDialogs.push(container);

        const frame = requestAnimationFrame(() => {
            if (container.contains(document.activeElement)) return; // e.g. an autoFocus field
            const preferred = container.querySelector<HTMLElement>("[data-autofocus]");
            const target = preferred ?? focusableIn(container)[0];
            if (target) {
                // Programmatic focus does not match :focus-visible, so ask for the ring
                // explicitly until the user moves focus elsewhere.
                target.setAttribute("data-dialog-initial-focus", "");
                target.addEventListener("blur", () => target.removeAttribute("data-dialog-initial-focus"), { once: true });
                target.focus();
            } else {
                if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1");
                container.focus();
            }
        });

        const onKeyDown = (event: KeyboardEvent) => {
            if (openDialogs[openDialogs.length - 1] !== container) return;

            if (event.key === "Escape" && onEscapeRef.current) {
                event.preventDefault();
                event.stopPropagation();
                onEscapeRef.current();
                return;
            }

            if (event.key !== "Tab") return;
            const focusable = focusableIn(container);
            if (focusable.length === 0) {
                event.preventDefault();
                container.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            const outside = !container.contains(active);

            if (event.shiftKey && (active === first || outside)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (active === last || outside)) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", onKeyDown, true);

        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener("keydown", onKeyDown, true);
            const index = openDialogs.lastIndexOf(container);
            if (index !== -1) openDialogs.splice(index, 1);
            if (previouslyFocused?.isConnected) previouslyFocused.focus();
        };
    }, [open]);

    return ref;
}
