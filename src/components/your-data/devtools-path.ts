import type { FoundItem } from "@/lib/storage-registry/inventory";

/**
 * Where to look for a stored item in browser developer tools, as the clicks a
 * person makes (Chrome and Edge wording; Firefox and Safari call the tab
 * "Storage"). The names are the ones developer tools show, so they are not
 * translated.
 */
export function devtoolsPath(item: Pick<FoundItem, "location" | "name" | "database">, origin: string): string[] {
    switch (item.location) {
        case "indexeddb-database":
            return ["Application", "IndexedDB", item.name];
        case "indexeddb-table":
            return ["Application", "IndexedDB", item.database ?? "", item.name];
        case "local-storage":
            return ["Application", "Local storage", origin, item.name];
        case "session-storage":
            return ["Application", "Session storage", origin, item.name];
        case "cookie":
            return ["Application", "Cookies", origin, item.name];
        case "cache":
            return ["Application", "Cache storage", item.name];
        case "service-worker":
            return ["Application", "Service workers"];
    }
}
