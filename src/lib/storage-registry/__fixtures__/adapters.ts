import { createQaEdgeCaseResume, createQaFullResume, createQaMinimalResume } from "@/lib/qa/sample-resumes";
import type { BrowserAdapters, EngineCvContent } from "../inventory";
import { ENGINECV_DATABASE } from "../registry";

/** In-memory Storage for tests. */
export class MemoryStorage implements Storage {
    private values = new Map<string, string>();
    get length() {
        return this.values.size;
    }
    clear() {
        this.values.clear();
    }
    getItem(key: string) {
        return this.values.get(key) ?? null;
    }
    key(index: number) {
        return [...this.values.keys()][index] ?? null;
    }
    removeItem(key: string) {
        this.values.delete(key);
    }
    setItem(key: string, value: string) {
        this.values.set(key, value);
    }
}

export function fixtureContent(): EngineCvContent {
    const resumes = [createQaFullResume(), createQaMinimalResume(), createQaEdgeCaseResume()];
    resumes.forEach((resume, index) => {
        resume.updatedAt = Date.UTC(2026, 9, 20 + index);
    });
    const resumeHistory = resumes.slice(0, 2).map((resume, index) => ({
        id: index + 1,
        resumeId: resume.id ?? `resume-${index}`,
        createdAt: Date.UTC(2026, 9, 25 + index),
        trigger: "autosave" as const,
        resumeJson: JSON.stringify(resume),
    }));
    return { resumes, resumeHistory, templates: [] };
}

/** Adapters for a browser that holds the QA fixtures, preferences, consent, the locale cookie and one unknown key. */
export function seededAdapters(overrides: Partial<BrowserAdapters> = {}): BrowserAdapters & { local: MemoryStorage; session: MemoryStorage } {
    const local = new MemoryStorage();
    local.setItem("enginecv-preferences", JSON.stringify({ kind: "enginecv.preferences", schemaVersion: 1, updatedAt: "2026-10-27T10:00:00.000Z", preferences: {} }));
    local.setItem("enginecv-consent", JSON.stringify({ version: 2, ads: "denied", decidedAt: "2026-10-01T09:00:00.000Z" }));
    local.setItem("foo", "bar");
    const session = new MemoryStorage();
    const content = fixtureContent();
    return {
        local,
        session,
        indexedDB: { databases: async () => [{ name: ENGINECV_DATABASE, version: 30 }] },
        localStorage: local,
        sessionStorage: session,
        cookies: () => "enginecv-locale=de",
        caches: { keys: async () => [] },
        serviceWorker: { getRegistrations: async () => [] },
        databaseExists: async () => true,
        readEngineCvContent: async () => content,
        ...overrides,
    };
}
