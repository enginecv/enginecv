import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_ROUTES, SHARE_IMAGE, pageMetadata } from "./site";

describe("pageMetadata", () => {
    it("sets the canonical URL, Open Graph URL and share image from one path", () => {
        const metadata = pageMetadata({ title: "Privacy", description: "d", path: "/privacy" });

        expect(metadata.alternates?.canonical).toBe("/privacy");
        expect(metadata.openGraph).toMatchObject({ url: "/privacy", siteName: "EngineCV", images: [SHARE_IMAGE] });
    });

    it("is used by every public page with that page's own path", () => {
        for (const route of PUBLIC_ROUTES) {
            const file = path.join(process.cwd(), "src", "app", "(site)", route === "/" ? "" : route, "page.tsx");
            const source = fs.readFileSync(file, "utf8");

            // The landing page exists in every locale; landingMetadata wraps pageMetadata.
            if (route === "/") {
                expect(source, file).toContain('landingMetadata("en")');
                continue;
            }
            // The blog index exists per language too; blogIndexMetadata wraps pageMetadata.
            if (route === "/blog") {
                expect(source, file).toContain('blogIndexMetadata("en")');
                continue;
            }
            expect(source, file).toContain("pageMetadata(");
            expect(source, file).toContain(`path: "${route}"`);
        }
    });

    it("points at a share image that exists", () => {
        expect(fs.existsSync(path.join(process.cwd(), "public", SHARE_IMAGE.url))).toBe(true);
    });
});
