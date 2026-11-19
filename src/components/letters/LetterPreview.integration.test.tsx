import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { makeCv, makeLetter } from "../../../test/setup/letter-fixtures";
import { resolveLetter } from "@/lib/letters/resolve";
import { LetterPreview, PAGE_PX } from "./LetterPreview";

afterEach(cleanup);

function renderLetter(letter = makeLetter(), cv = makeCv()) {
    return render(<LetterPreview letter={resolveLetter(letter, cv)} />);
}

describe("LetterPreview", () => {
    it("draws print-ready pages: the resume-page class and inline pixel sizes", () => {
        renderLetter();
        const page = screen.getAllByTestId("letter-page")[0];
        expect(page).toHaveClass("resume-page");
        expect(page.style.width).toBe(`${PAGE_PX.a4.width}px`);
        expect(page.style.height).toBe(`${PAGE_PX.a4.height}px`);
    });

    it("uses US Letter dimensions for a Letter-size letter", () => {
        renderLetter(makeLetter({ paperSize: "letter" }));
        const page = screen.getAllByTestId("letter-page")[0];
        expect(page.style.width).toBe(`${PAGE_PX.letter.width}px`);
        expect(page.style.height).toBe(`${PAGE_PX.letter.height}px`);
    });

    it("follows the CV's fonts and accent colour", () => {
        renderLetter(makeLetter(), makeCv({ accent: "#123456", fontFamily: "Lora" }));
        const page = screen.getAllByTestId("letter-page")[0];
        expect(page.style.fontFamily).toContain("Lora");
        expect(page.innerHTML).toContain("rgb(18, 52, 86)");
    });

    it("shows the sender block from the CV and the letter's own text", () => {
        renderLetter(makeLetter({ company: "Acme", subject: "Application as Designer", recipient: { name: "Jane Roe", address: "1 Main St\nBerlin" } }));
        const page = screen.getAllByTestId("letter-page")[0];
        expect(within(page).getAllByText("Amina Hodzic").length).toBeGreaterThanOrEqual(2); // header and signature
        expect(within(page).getByText("Senior Product Designer", { selector: "div" })).toBeInTheDocument();
        expect(within(page).getByText(/amina@example.com/)).toBeInTheDocument();
        expect(within(page).getByText("Jane Roe")).toBeInTheDocument();
        expect(within(page).getByText("Application as Designer")).toBeInTheDocument();
        expect(within(page).getByText("Dear Hiring Team,")).toBeInTheDocument();
    });

    it("draws resolved tokens as chips and formats the body", () => {
        renderLetter();
        const chip = document.querySelector('[data-letter-chip="resolved"]');
        expect(chip).toHaveTextContent("Senior Product Designer");
        expect(screen.getAllByTestId("letter-page")[0].querySelector("strong")).toHaveTextContent("excited");
    });

    it("flags a token with nothing to show instead of printing braces", () => {
        renderLetter(makeLetter({ paragraphs: [{ id: "a", markdown: "From {{location}}.", prompt: "" }] }), makeCv({ location: "" }));
        const flagged = document.querySelector('[data-letter-chip="unresolved"]');
        expect(flagged).toHaveTextContent("location");
        expect(screen.getAllByTestId("letter-page")[0].textContent).not.toContain("{{");
    });

    it("renders bullet lists, links and skips empty paragraphs", () => {
        renderLetter(makeLetter({ paragraphs: [
            { id: "a", markdown: "- one\n- two", prompt: "" },
            { id: "b", markdown: "", prompt: "Hint text that must not print" },
            { id: "c", markdown: "See [my site](https://example.com).", prompt: "" },
        ] }));
        const page = screen.getAllByTestId("letter-page")[0];
        expect(page.querySelectorAll("li")).toHaveLength(2);
        expect(page.querySelector("a")).toHaveAttribute("href", "https://example.com");
        expect(page.textContent).not.toContain("Hint text");
    });

    it("hides token highlights when printing", () => {
        renderLetter();
        const css = screen.getByTestId("letter-preview").querySelector("style")?.textContent ?? "";
        expect(css).toMatch(/@media print[\s\S]*letter-chip-unresolved[\s\S]*display: none/);
    });

    it("prints the photo only when the letter shows it", () => {
        const cv = makeCv({ photo: "data:image/png;base64,AAAA" });
        const { unmount } = renderLetter(makeLetter(), cv);
        expect(document.querySelector("img")).toBeNull();
        unmount();
        renderLetter(makeLetter({ showPhoto: true }), cv);
        expect(document.querySelector("img")).toHaveAttribute("src", "data:image/png;base64,AAAA");
    });
});

describe("LetterPreview: German layout", () => {
    const german = (overrides = {}, cv = makeCv({ language: "de" })) =>
        renderLetter(makeLetter({ layout: "din5008", paperSize: "a4", recipient: { name: "Frau Roe", address: "Acme GmbH\n20095 Hamburg" }, subject: "Bewerbung als Designerin", ...overrides }), cv);

    it("places the letterhead, address field and date at the standard positions on page one", () => {
        german();
        const page = screen.getAllByTestId("letter-page")[0];
        const field = page.querySelector<HTMLElement>('[data-din="address-field"]')!;
        expect(field.style.top).toBe(`${(45 * 96) / 25.4}px`);
        expect(field.style.left).toBe(`${(20 * 96) / 25.4}px`);
        expect(field.style.width).toBe(`${(85 * 96) / 25.4}px`);
        expect(field).toHaveTextContent("Frau Roe");
        expect(field).toHaveTextContent("Amina Hodzic"); // the small return-address line
        expect(page.querySelector('[data-din="letterhead"]')).toHaveTextContent("Senior Product Designer");
        expect(page.querySelector<HTMLElement>('[data-din="info-block"]')!.style.left).toBe(`${(125 * 96) / 25.4}px`);
    });

    it("starts the text 98.5 mm down and uses 25 mm and 20 mm side margins", () => {
        german();
        const page = screen.getAllByTestId("letter-page")[0];
        expect(page.style.padding).toContain(`${(98.5 * 96) / 25.4}px`);
        expect(page.style.paddingLeft).toBe(`${(25 * 96) / 25.4}px`);
        expect(page.style.paddingRight).toBe(`${(20 * 96) / 25.4}px`);
    });

    it("keeps the text of the letter: subject, salutation and body", () => {
        german();
        const page = screen.getAllByTestId("letter-page")[0];
        expect(within(page).getByText("Bewerbung als Designerin")).toBeInTheDocument();
        expect(within(page).getByText("Dear Hiring Team,")).toBeInTheDocument();
    });

    it("draws the fold marks at 105 and 210 mm and the punch mark at 148.5 mm", () => {
        german();
        const marks = [...document.querySelectorAll<HTMLElement>("[data-fold-mark]")];
        const tops = Object.fromEntries(marks.map((mark) => [mark.dataset.foldMark, mark.style.top]));
        expect(tops["fold-105"]).toBe(`${(105 * 96) / 25.4}px`);
        expect(tops["fold-210"]).toBe(`${(210 * 96) / 25.4}px`);
        expect(tops["punch"]).toBe(`${(148.5 * 96) / 25.4}px`);
    });

    it("hides unprinted marks when printing, and prints them when the letter asks for it", () => {
        german();
        const css = screen.getByTestId("letter-preview").querySelector("style")?.textContent ?? "";
        expect(css).toMatch(/@media print[\s\S]*\.letter-fold-mark:not\(\.letter-fold-mark-print\)[\s\S]*display: none/);
        expect(document.querySelector(".letter-fold-mark-print")).toBeNull();
        cleanup();
        german({ printFoldMarks: true });
        expect(document.querySelectorAll(".letter-fold-mark-print")).toHaveLength(3);
    });

    it("shows no marks and no fixed address field in the standard layout", () => {
        renderLetter();
        expect(document.querySelector("[data-fold-mark]")).toBeNull();
        expect(document.querySelector('[data-din="address-field"]')).toBeNull();
    });
});
