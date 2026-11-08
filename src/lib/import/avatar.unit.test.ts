import { describe, expect, it } from "vitest";
import { fetchAvatarDataUrl } from "./avatar";

function pngResponse(): Response {
    // 1x1 transparent PNG
    const bytes = Uint8Array.from(
        atob(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        ),
        (c) => c.charCodeAt(0),
    );
    return new Response(bytes, {
        status: 200,
        headers: { "content-type": "image/png" },
    });
}

describe("fetchAvatarDataUrl", () => {
    it("returns a data-URL for a fetched avatar", async () => {
        const mockFetch = (async () => pngResponse()) as typeof fetch;

        const dataUrl = await fetchAvatarDataUrl(
            "https://avatars.githubusercontent.com/u/583231?v=4",
            mockFetch,
        );

        expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it("requests a sized avatar", async () => {
        let requestedUrl = "";
        const mockFetch = (async (input: RequestInfo | URL) => {
            requestedUrl = String(input);
            return pngResponse();
        }) as typeof fetch;

        await fetchAvatarDataUrl("https://avatars.githubusercontent.com/u/583231?v=4", mockFetch);

        expect(requestedUrl).toContain("s=460");
    });

    it("resolves empty string for empty input", async () => {
        expect(await fetchAvatarDataUrl("")).toBe("");
    });

    it("resolves empty string on network failure", async () => {
        const mockFetch = (async () => {
            throw new TypeError("Failed to fetch");
        }) as typeof fetch;

        expect(await fetchAvatarDataUrl("https://example.com/a.png", mockFetch)).toBe("");
    });

    it("resolves empty string on non-ok response", async () => {
        const mockFetch = (async () => new Response("", { status: 404 })) as typeof fetch;

        expect(await fetchAvatarDataUrl("https://example.com/a.png", mockFetch)).toBe("");
    });
});
