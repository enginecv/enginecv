/**
 * A `?tab=` query parameter pins the dashboard tab (deep links such as
 * `/dashboard?tab=templates`). Once the user picks a different tab, the pin has
 * to go, or it keeps overriding the stored preference. An open application
 * (`&application=<id>`, Job Tracker only) goes with it when leaving that tab.
 *
 * Returns the URL without the pin, or null when there is nothing to remove.
 */
export function urlAfterDashboardTabSelect(
    location: { pathname: string; search: string },
    selectedTab: string,
): string | null {
    const params = new URLSearchParams(location.search);
    const pinnedTab = params.get("tab");
    const dropPin = Boolean(pinnedTab) && pinnedTab !== selectedTab;
    const dropApplication = selectedTab !== "jobs" && params.has(APPLICATION_PARAM);
    if (!dropPin && !dropApplication) return null;

    if (dropPin) params.delete("tab");
    if (dropApplication) params.delete(APPLICATION_PARAM);
    const query = params.toString();
    return query ? `${location.pathname}?${query}` : location.pathname;
}

export const APPLICATION_PARAM = "application";

/**
 * The URL with the given application open in the Job Tracker, or closed when `id` is null. The id is
 * opaque; nothing about the job (company, role, link, notes) ever goes into the URL.
 */
export function urlWithApplication(location: { pathname: string; search: string }, id: string | null): string {
    const params = new URLSearchParams(location.search);
    if (id) {
        params.set("tab", "jobs");
        params.set(APPLICATION_PARAM, id);
    } else {
        params.delete(APPLICATION_PARAM);
    }
    const query = params.toString();
    return query ? `${location.pathname}?${query}` : location.pathname;
}
