import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDialogFocus } from "./useDialogFocus";

function Dialog({ onClose, children }: { onClose: () => void; children?: React.ReactNode }) {
    const ref = useDialogFocus<HTMLDivElement>(true, onClose);
    return (
        <div ref={ref} role="dialog" aria-modal="true" aria-label="Test dialog">
            {children ?? (
                <>
                    <button type="button">First</button>
                    <input aria-label="Middle" />
                    <button type="button">Last</button>
                </>
            )}
        </div>
    );
}

function Harness({ onEscape }: { onEscape?: () => void }) {
    const [open, setOpen] = useState(false);
    const close = () => {
        onEscape?.();
        setOpen(false);
    };
    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>Open</button>
            <button type="button">Outside</button>
            {open && <Dialog onClose={close} />}
        </>
    );
}

// jsdom has no layout; treat every element as rendered.
Object.defineProperty(HTMLElement.prototype, "getClientRects", {
    configurable: true,
    value: () => [{ width: 1, height: 1 }],
});

describe("useDialogFocus", () => {
    afterEach(() => {
        cleanup();
    });

    it("moves focus into the dialog when it opens", async () => {
        const user = userEvent.setup();
        render(<Harness />);

        await user.click(screen.getByRole("button", { name: "Open" }));

        await waitFor(() => expect(screen.getByRole("button", { name: "First" })).toHaveFocus());
    });

    it("keeps Tab and Shift+Tab inside the dialog", async () => {
        const user = userEvent.setup();
        render(<Harness />);
        await user.click(screen.getByRole("button", { name: "Open" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "First" })).toHaveFocus());

        await user.tab();
        expect(screen.getByRole("textbox", { name: "Middle" })).toHaveFocus();
        await user.tab();
        expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
        await user.tab();
        expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
        await user.tab({ shift: true });
        expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
    });

    it("closes on Escape and returns focus to the trigger", async () => {
        const user = userEvent.setup();
        const onEscape = vi.fn();
        render(<Harness onEscape={onEscape} />);
        const trigger = screen.getByRole("button", { name: "Open" });
        await user.click(trigger);
        await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

        await user.keyboard("{Escape}");

        expect(onEscape).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(trigger).toHaveFocus();
    });

    it("keeps an autoFocus field focused instead of moving to the first control", async () => {
        render(
            <Dialog onClose={vi.fn()}>
                <button type="button">Close</button>
                <input aria-label="Name" autoFocus />
            </Dialog>,
        );

        await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });

        expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
    });

    it("only the topmost of stacked dialogs handles Escape", async () => {
        const outerClose = vi.fn();
        const innerClose = vi.fn();
        function Stacked() {
            const outer = useDialogFocus<HTMLDivElement>(true, outerClose);
            const inner = useDialogFocus<HTMLDivElement>(true, innerClose);
            return (
                <div ref={outer} role="dialog" aria-label="Outer">
                    <button type="button">Outer button</button>
                    <div ref={inner} role="dialog" aria-label="Inner">
                        <button type="button">Inner button</button>
                    </div>
                </div>
            );
        }
        render(<Stacked />);

        fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

        expect(innerClose).toHaveBeenCalledTimes(1);
        expect(outerClose).not.toHaveBeenCalled();
    });
});

describe("useDialogFocus with an autoFocus field", () => {
    afterEach(() => {
        cleanup();
    });

    it("returns focus to the trigger even though the dialog field took focus first", async () => {
        const user = userEvent.setup();
        function AutoFocusHarness() {
            const [open, setOpen] = useState(false);
            return (
                <>
                    <button type="button" onClick={() => setOpen(true)}>Open palette</button>
                    {open && <AutoFocusDialog onClose={() => setOpen(false)} />}
                </>
            );
        }
        function AutoFocusDialog({ onClose }: { onClose: () => void }) {
            const ref = useDialogFocus<HTMLDivElement>(true, onClose);
            return (
                <div ref={ref} role="dialog" aria-label="Palette">
                    <input aria-label="Search" autoFocus />
                </div>
            );
        }
        render(<AutoFocusHarness />);
        const trigger = screen.getByRole("button", { name: "Open palette" });

        await user.click(trigger);
        expect(screen.getByRole("textbox", { name: "Search" })).toHaveFocus();
        await user.keyboard("{Escape}");

        expect(screen.queryByRole("dialog")).toBeNull();
        expect(trigger).toHaveFocus();
    });
});
