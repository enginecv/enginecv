import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __testing } from "./export";

// Characterization test for the PDF print window's document. The self-contained
// HTML export (feature 084) shares this builder; this pins what the print window
// receives so sharing it can never change the PDF path.

describe("print window document", () => {
    beforeEach(() => {
        document.head.innerHTML = [
            '<link rel="stylesheet" href="http://localhost:3000/_next/static/css/app.css">',
            "<style>.resume-scope-x { color: red; }</style>",
        ].join("");
    });
    afterEach(() => {
        document.head.innerHTML = "";
    });

    function build() {
        return __testing.buildPrintableDocument({
            filename: "resume-jane.pdf",
            paperSize: "a4",
            printablePagesMarkup: '<div class="print-exact-page-wrapper"><p>Hello</p></div>',
            pageWidthPx: 794,
            pageHeightPx: 1123,
        });
    }

    it("keeps live stylesheet links and the base address for the print window", () => {
        const html = build();
        expect(html).toContain(`<base href="${window.location.href}">`);
        expect(html).toContain('<link rel="stylesheet" href="http://localhost:3000/_next/static/css/app.css">');
        expect(html).toContain("<style>.resume-scope-x { color: red; }</style>");
    });

    it("pins the whole document so sharing the builder cannot change the PDF path", () => {
        expect(build()).toMatchSnapshot();
    });

    it("sizes pages from the intrinsic preview pixels and prints on the chosen paper", () => {
        const html = build();
        expect(html).toContain("width: 794px !important;");
        expect(html).toContain("height: 1123px !important;");
        expect(html).toContain("size: A4;");
    });
});
