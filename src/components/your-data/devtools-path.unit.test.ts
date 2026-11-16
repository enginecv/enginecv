import { describe, expect, it } from "vitest";
import { devtoolsPath } from "./devtools-path";

const origin = "https://enginecv.app";

describe("devtoolsPath", () => {
    it.each([
        [{ location: "indexeddb-database", name: "EngineCVDatabase" }, ["Application", "IndexedDB", "EngineCVDatabase"]],
        [{ location: "indexeddb-table", name: "resumes", database: "EngineCVDatabase" }, ["Application", "IndexedDB", "EngineCVDatabase", "resumes"]],
        [{ location: "indexeddb-table", name: "linkedFiles", database: "EngineCVDatabase" }, ["Application", "IndexedDB", "EngineCVDatabase", "linkedFiles"]],
        [{ location: "local-storage", name: "enginecv-preferences" }, ["Application", "Local storage", origin, "enginecv-preferences"]],
        [{ location: "session-storage", name: "k" }, ["Application", "Session storage", origin, "k"]],
        [{ location: "cookie", name: "enginecv-locale" }, ["Application", "Cookies", origin, "enginecv-locale"]],
        [{ location: "cache", name: "c1" }, ["Application", "Cache storage", "c1"]],
        [{ location: "service-worker", name: "https://enginecv.app/" }, ["Application", "Service workers"]],
    ] as const)("%j", (item, path) => {
        expect(devtoolsPath(item, origin)).toEqual(path);
    });
});
