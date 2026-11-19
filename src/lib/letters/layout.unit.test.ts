import { describe, expect, it } from "vitest";
import { makeLetter } from "../../../test/setup/letter-fixtures";
import { applyLayout, applyPaperSize } from "./layout";

describe("applyLayout", () => {
    it("switches a Letter-size letter to A4 for the German layout, says so, and remembers Letter", () => {
        const { letter, switchedToA4 } = applyLayout(makeLetter({ paperSize: "letter" }), "din5008");
        expect(switchedToA4).toBe(true);
        expect(letter).toMatchObject({ layout: "din5008", paperSize: "a4", paperSizeBeforeGerman: "letter" });
    });

    it("restores the earlier paper size when the standard layout is chosen again", () => {
        const german = applyLayout(makeLetter({ paperSize: "letter" }), "din5008").letter;
        const { letter, switchedToA4 } = applyLayout(german, "standard");
        expect(switchedToA4).toBe(false);
        expect(letter).toMatchObject({ layout: "standard", paperSize: "letter", paperSizeBeforeGerman: null });
    });

    it("does not announce a switch when the letter is already on A4", () => {
        const { letter, switchedToA4 } = applyLayout(makeLetter({ paperSize: "a4" }), "din5008");
        expect(switchedToA4).toBe(false);
        expect(letter.paperSize).toBe("a4");
        expect(applyLayout(letter, "standard").letter.paperSize).toBe("a4");
    });

    it("changes nothing when the layout is already the one asked for", () => {
        const letter = makeLetter();
        expect(applyLayout(letter, "standard")).toEqual({ letter, switchedToA4: false });
    });
});

describe("applyPaperSize", () => {
    it("sets the size for the standard layout", () => {
        expect(applyPaperSize(makeLetter({ paperSize: "a4" }), "letter").paperSize).toBe("letter");
    });

    it("keeps A4 under the German layout and remembers the choice for later", () => {
        const german = applyLayout(makeLetter(), "din5008").letter;
        const changed = applyPaperSize(german, "letter");
        expect(changed.paperSize).toBe("a4");
        expect(applyLayout(changed, "standard").letter.paperSize).toBe("letter");
    });
});
