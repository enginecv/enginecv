/** Ephemeral navigation/command bridge. No resume data or preferences persisted. */
type Action = () => void;
interface JsonSession { dirty: boolean; undo: Action | null; leave: ((next: Action) => void) | null }
const empty: JsonSession = { dirty: false, undo: null, leave: null };
let session = empty;
const listeners = new Set<Action>();
export const getJsonSession = () => session;
export const getEmptyJsonSession = () => empty;
export function subscribeJsonSession(listener: Action) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function setJsonSession(next: JsonSession) { session = next; listeners.forEach(listener => listener()); }
export function clearJsonSession() { setJsonSession(empty); }
export function requestJsonEditorLeave(next: Action) {
    if (session.dirty && session.leave) session.leave(next);
    else next();
}
