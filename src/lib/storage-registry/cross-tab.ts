/**
 * Tells other open EngineCV tabs that "delete all my data" is running, so
 * they stop saving (and close the database) instead of writing it back.
 * BroadcastChannel only: every supported browser has it, and a storage-event
 * fallback would itself need a stored key.
 */

export const WIPE_CHANNEL = "enginecv-data";

export type WipeMessage = { type: "wipe-start" | "wipe-done"; from: string };

type ChannelFactory = (name: string) => Pick<BroadcastChannel, "postMessage" | "close"> & {
    addEventListener: (type: "message", listener: (event: MessageEvent<WipeMessage>) => void) => void;
};

const TAB_ID = Math.random().toString(36).slice(2);

function defaultChannel(name: string) {
    return new BroadcastChannel(name);
}

function available(): boolean {
    return typeof BroadcastChannel !== "undefined";
}

export function announceWipe(type: WipeMessage["type"], createChannel: ChannelFactory = defaultChannel, from: string = TAB_ID): void {
    if (createChannel === defaultChannel && !available()) return;
    const channel = createChannel(WIPE_CHANNEL);
    channel.postMessage({ type, from } satisfies WipeMessage);
    channel.close();
}

export function listenForWipe(
    handlers: { onStart: () => void; onDone: () => void },
    createChannel: ChannelFactory = defaultChannel,
): () => void {
    if (createChannel === defaultChannel && !available()) return () => {};
    const channel = createChannel(WIPE_CHANNEL);
    channel.addEventListener("message", (event) => {
        if (event.data?.from === TAB_ID) return;
        if (event.data?.type === "wipe-start") handlers.onStart();
        if (event.data?.type === "wipe-done") handlers.onDone();
    });
    return () => channel.close();
}
