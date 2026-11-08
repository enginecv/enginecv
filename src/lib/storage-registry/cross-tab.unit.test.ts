import { describe, expect, it, vi } from "vitest";
import { announceWipe, listenForWipe, WIPE_CHANNEL, type WipeMessage } from "./cross-tab";

/** Channels sharing one bus, like tabs of the same origin. */
function bus() {
    const listeners = new Set<(event: MessageEvent<WipeMessage>) => void>();
    const names: string[] = [];
    const create = (name: string) => {
        names.push(name);
        let own: ((event: MessageEvent<WipeMessage>) => void) | null = null;
        return {
            postMessage: (data: WipeMessage) => {
                for (const listener of listeners) if (listener !== own) listener({ data } as MessageEvent<WipeMessage>);
            },
            addEventListener: (_type: "message", listener: (event: MessageEvent<WipeMessage>) => void) => {
                own = listener;
                listeners.add(listener);
            },
            close: () => {
                if (own) listeners.delete(own);
            },
        };
    };
    return { create, names };
}

describe("cross-tab wipe signal", () => {
    it("reaches listeners with start and done", () => {
        const { create, names } = bus();
        const onStart = vi.fn();
        const onDone = vi.fn();
        listenForWipe({ onStart, onDone }, create);

        announceWipe("wipe-start", create, "other-tab");
        announceWipe("wipe-done", create, "other-tab");

        expect(onStart).toHaveBeenCalledTimes(1);
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(new Set(names)).toEqual(new Set([WIPE_CHANNEL]));
    });

    it("ignores its own tab's messages", () => {
        const onStart = vi.fn();
        const listeners: Array<(event: MessageEvent<WipeMessage>) => void> = [];
        const create = () => ({
            postMessage: (data: WipeMessage) => listeners.forEach((listener) => listener({ data } as MessageEvent<WipeMessage>)),
            addEventListener: (_type: "message", listener: (event: MessageEvent<WipeMessage>) => void) => listeners.push(listener),
            close: () => {},
        });
        listenForWipe({ onStart, onDone: () => {} }, create);
        announceWipe("wipe-start", create);
        expect(onStart).not.toHaveBeenCalled();
    });

    it("stops listening when cleaned up", () => {
        const { create } = bus();
        const onStart = vi.fn();
        const stop = listenForWipe({ onStart, onDone: () => {} }, create);
        stop();
        announceWipe("wipe-start", create, "other-tab");
        expect(onStart).not.toHaveBeenCalled();
    });
});
