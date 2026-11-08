import { isStartPathId, type StartPathId } from "./start-paths";

/** `?start=<path>` from a query string; the first value wins, unknown values are ignored. */
export function parseStartParam(search: string): StartPathId | null {
    const value = new URLSearchParams(search).get("start");
    return value !== null && isStartPathId(value) ? value : null;
}

/**
 * The current URL without any `start` parameter, other parameters and the hash
 * kept. The dashboard strips it as soon as it is read, so a reload or Back never
 * repeats the action.
 */
export function urlWithoutStartParam(location: { pathname: string; search: string; hash: string }): string {
    const params = new URLSearchParams(location.search);
    params.delete("start");
    const query = params.toString();
    return `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
}
