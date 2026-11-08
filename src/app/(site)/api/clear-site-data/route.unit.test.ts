import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

const URL_ = "https://enginecv.app/api/clear-site-data";

describe("POST /api/clear-site-data", () => {
    it("asks the browser to clear cookies, storage and cache, and is never cached", async () => {
        const response = await POST(new Request(URL_, { method: "POST", headers: { origin: "https://enginecv.app" } }));
        expect(response.status).toBe(204);
        expect(response.headers.get("Clear-Site-Data")).toBe("\"cache\", \"cookies\", \"storage\"");
        expect(response.headers.get("Cache-Control")).toBe("no-store");
    });

    it("refuses requests from other sites", async () => {
        const response = await POST(new Request(URL_, { method: "POST", headers: { origin: "https://evil.example" } }));
        expect(response.status).toBe(403);
        expect(response.headers.get("Clear-Site-Data")).toBeNull();
    });

    it("refuses requests without an Origin header", async () => {
        const response = await POST(new Request(URL_, { method: "POST" }));
        expect(response.status).toBe(403);
    });

    it("does nothing on GET, so links and prefetchers cannot trigger it", async () => {
        const response = GET();
        expect(response.status).toBe(405);
        expect(response.headers.get("Clear-Site-Data")).toBeNull();
    });
});
