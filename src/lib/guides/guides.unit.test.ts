import { describe, expect, it } from "vitest";
import { loadGuideDocs } from "@/lib/content-depth/corpus";
import { GUIDE_REGISTRY } from "./registry";

describe("guide files and registry", () => {
    const docs = loadGuideDocs();

    it("has a file for every registry entry and an entry for every file", () => {
        const files = docs.map((doc) => doc.slug).sort();
        const entries = GUIDE_REGISTRY.map((entry) => entry.slug).filter((slug) => files.includes(slug)).sort();
        expect(files.filter((slug) => !GUIDE_REGISTRY.some((entry) => entry.slug === slug)), "files with no registry entry").toEqual([]);
        expect(entries).toEqual(files);
    });

    it("keeps the registry published flag equal to !draft in the front matter", () => {
        const mismatched = docs.flatMap((doc) => {
            const entry = GUIDE_REGISTRY.find((item) => item.slug === doc.slug);
            const published = doc.frontMatter.draft === false;
            return entry && entry.published !== published ? [`${doc.slug}: registry published=${entry.published}, front matter draft=${String(doc.frontMatter.draft)}`] : [];
        });
        expect(mismatched).toEqual([]);
    });

    it("names the file after the slug", () => {
        expect(docs.filter((doc) => doc.file !== `${doc.slug}.mdx`).map((doc) => doc.file)).toEqual([]);
    });

    it("has an updated date on every published guide that is not before the date", () => {
        const bad = docs.filter((doc) => doc.frontMatter.draft === false).flatMap((doc) => {
            const date = String(doc.frontMatter.date ?? "");
            const updated = String(doc.frontMatter.updated ?? "");
            const ok = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{4}-\d{2}-\d{2}$/.test(updated) && updated >= date;
            return ok ? [] : [`${doc.slug}: date=${date} updated=${updated}`];
        });
        expect(bad).toEqual([]);
    });
});
