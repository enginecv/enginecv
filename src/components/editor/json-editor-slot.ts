/** UI-only portal outlet; moving the outlet must not destroy buffered edits. */
let slot: HTMLDivElement | null = null;
const listeners = new Set<(slot: HTMLDivElement | null) => void>();
export const getJsonEditorSlot = () => slot;
export function setJsonEditorSlot(next: HTMLDivElement | null) { slot = next; listeners.forEach(listener => listener(next)); }
export function subscribeJsonEditorSlot(listener: (slot: HTMLDivElement | null) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
