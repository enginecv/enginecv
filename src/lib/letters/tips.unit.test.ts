import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/en";
import { LETTER_TIPS, SECTION_TIPS } from "./tips";

describe("letter tips", () => {
    it("links only to blog posts that exist", () => {
        const missing = Object.values(LETTER_TIPS).filter((slug) => !existsSync(join(process.cwd(), "content", "blog", `${slug}.mdx`)));
        expect(missing).toEqual([]);
    });

    it("has a label for every article and uses only known articles", () => {
        for (const id of Object.keys(LETTER_TIPS)) expect(en[`letters.tips.${id}`], id).toBeTruthy();
        for (const ids of Object.values(SECTION_TIPS)) for (const id of ids) expect(Object.keys(LETTER_TIPS)).toContain(id);
    });
});
