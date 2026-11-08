/**
 * A `?tab=` query parameter pins the dashboard tab (deep links such as
 * `/dashboard?tab=templates`). Once the user picks a different tab, the pin has
 * to go, or it keeps overriding the stored preference.
 *
 * Returns the URL without the pin, or null when there is nothing to remove.
 */
export function urlAfterDashboardTabSelect(
    location: { pathname: string; search: string },
    selectedTab: string,
): string | null {
    const params = new URLSearchParams(location.search);
    const pinnedTab = params.get("tab");
    if (!pinnedTab || pinnedTab === selectedTab) return null;

    params.delete("tab");
    const query = params.toString();
    return query ? `${location.pathname}?${query}` : location.pathname;
}
