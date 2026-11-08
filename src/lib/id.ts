export function createId(): string {
    const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
    if (c?.randomUUID) return c.randomUUID();

    if (c?.getRandomValues) {
        const bytes = new Uint8Array(16);
        c.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    const rand = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0");
    return `${rand()}-${rand().slice(0, 4)}-4${rand().slice(1, 4)}-a${rand().slice(1, 4)}-${rand()}${rand().slice(0, 4)}`;
}
