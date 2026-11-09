import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RepoBadge } from "./RepoBadge";

const repo = (url: string) => ({ id: "r1", url, label: "my-repo", platform: "auto" as const });

function badge(url: string, pageBackground?: string) {
    render(<RepoBadge repo={repo(url) as never} textColor="#111827" pageBackground={pageBackground} />);
    return screen.getByTitle(/my-repo/);
}

describe("RepoBadge platform colours", () => {
    afterEach(cleanup);

    it("draws a GitHub badge in dark ink on a white page, not near-white", () => {
        const el = badge("https://github.com/acme/my-repo");
        expect(el.style.color).toBe("rgb(36, 41, 47)");
    });

    it("keeps a SourceHut badge readable on a white page", () => {
        const el = badge("https://sr.ht/~acme/my-repo");
        expect(el.style.color).toBe("rgb(17, 17, 17)");
    });

    it("falls back to the resume's text colour when a platform colour would vanish on a dark page", () => {
        const el = badge("https://github.com/acme/my-repo", "#0b1220");
        expect(el.style.color).toBe("rgb(17, 24, 39)");
    });

    it("keeps a brand colour that already reads on the page", () => {
        const el = badge("https://dev.azure.com/acme/my-repo");
        expect(el.style.color).toBe("rgb(0, 120, 212)");
    });
});
