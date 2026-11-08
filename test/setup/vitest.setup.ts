import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { vi } from "vitest";
import { registerDictionary } from "@/lib/i18n/dictionaries";
import { bs } from "@/lib/i18n/bs";
import { de } from "@/lib/i18n/de";
import { es } from "@/lib/i18n/es";
import { fr } from "@/lib/i18n/fr";

// The app loads non-English dictionaries on demand; tests switch locale and
// expect the text at once, so every dictionary is available up front.
for (const [locale, dictionary] of [["bs", bs], ["de", de], ["es", es], ["fr", fr]] as const) {
    registerDictionary(locale, dictionary);
}

class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}

class IntersectionObserverMock {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: number[] = [];

    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
}

Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    value: ResizeObserverMock,
});

Object.defineProperty(globalThis, "IntersectionObserver", {
    writable: true,
    value: IntersectionObserverMock,
});

Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: vi.fn(),
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    writable: true,
    value: vi.fn(),
});

Object.defineProperty(window, "alert", {
    writable: true,
    value: vi.fn(),
});

Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    value: vi.fn(() => "blob:test"),
});

Object.defineProperty(URL, "revokeObjectURL", {
    writable: true,
    value: vi.fn(),
});
