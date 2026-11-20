/**
 * An agent may sign the files it writes with an optional top-level `"edited_by": "Claude Code"` (and an
 * `"agent"` field in an export request). The name is only ever shown in a notification, so it is read
 * loosely and cleaned hard: file content is not trusted.
 */

export const AGENT_KEY = "edited_by";
const MAX_NAME = 40;

/** A short plain name, or null. Letters, digits, spaces and a few separators only; no markup, no control characters. */
export function cleanAgentName(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const name = raw.normalize("NFKC").replace(/[^\p{L}\p{N} ._+\-()]/gu, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME).trim();
    return name.length >= 2 ? name : null;
}

/** The name an agent signed a file with, found without parsing the whole document (the file may carry a fence or an intro). */
export function agentFromText(text: string): string | null {
    const match = /"edited_by"\s*:\s*"((?:[^"\\n]|\.){1,200})"/.exec(text);
    if (!match) return null;
    try {
        return cleanAgentName(JSON.parse(`"${match[1]}"`));
    } catch {
        return null;
    }
}
