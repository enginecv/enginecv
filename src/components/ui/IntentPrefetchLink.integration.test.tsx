import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IntentPrefetchLink } from "./IntentPrefetchLink";

const { prefetchMock } = vi.hoisted(() => ({ prefetchMock: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ prefetch: prefetchMock }),
}));

describe("IntentPrefetchLink", () => {
    afterEach(() => {
        cleanup();
        prefetchMock.mockClear();
    });

    it("does not prefetch the app until the visitor shows intent", () => {
        render(<IntentPrefetchLink href="/dashboard">Start</IntentPrefetchLink>);

        expect(screen.getByRole("link", { name: "Start" })).toHaveAttribute("href", "/dashboard");
        expect(prefetchMock).not.toHaveBeenCalled();
    });

    it.each(["mouseEnter", "focus", "touchStart"] as const)("prefetches on %s and keeps the caller's handler", (eventName) => {
        const handler = vi.fn();
        const handlerProp = { mouseEnter: "onMouseEnter", focus: "onFocus", touchStart: "onTouchStart" }[eventName];
        render(<IntentPrefetchLink href="/dashboard" {...{ [handlerProp]: handler }}>Start</IntentPrefetchLink>);

        fireEvent[eventName](screen.getByRole("link", { name: "Start" }));

        expect(prefetchMock).toHaveBeenCalledWith("/dashboard");
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
