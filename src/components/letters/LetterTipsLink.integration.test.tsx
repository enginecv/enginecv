import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { SECTION_TIPS, LETTER_TIPS, type LetterTipSection } from "@/lib/letters/tips";
import { LetterTipsLink } from "./LetterTipsLink";

describe("LetterTipsLink", () => {
    beforeEach(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    afterEach(cleanup);

    it("lists the section's articles as links that open in a new tab", async () => {
        render(<LetterTipsLink section="recipient" />);
        fireEvent.click(screen.getByRole("button", { name: "Get Tips" }));
        const first = await screen.findByTestId("letter-tip-howToWrite");
        expect(first).toHaveAttribute("href", "/blog/how-to-write-a-cover-letter");
        expect(first).toHaveAttribute("target", "_blank");
        expect(first.getAttribute("rel")).toContain("noopener");
        expect(first).toHaveTextContent("How to write a cover letter");
        expect(screen.getByTestId("letter-tip-german")).toHaveAttribute("href", "/blog/german-cover-letter-din-5008");
    });

    it("points every section at articles that exist", () => {
        for (const section of Object.keys(SECTION_TIPS) as LetterTipSection[]) {
            expect(SECTION_TIPS[section].length).toBeGreaterThan(0);
            for (const id of SECTION_TIPS[section]) expect(LETTER_TIPS[id]).toBeTruthy();
        }
    });
});
