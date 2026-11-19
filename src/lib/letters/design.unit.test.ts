import { describe, expect, it } from "vitest";
import { makeCv } from "../../../test/setup/letter-fixtures";
import { pickLetterDesign } from "./design";

describe("pickLetterDesign", () => {
    it("takes fonts, colours, header look and margins from the CV", () => {
        const cv = makeCv({ accent: "#123456", fontFamily: "Lora" });
        cv.settings.header.textTransform = "uppercase";
        cv.settings.spacing.marginH = 25;
        const design = pickLetterDesign(cv.settings);
        expect(design).toMatchObject({ fontFamily: "Lora", accentColor: "#123456", headerTextTransform: "uppercase", marginHmm: 25 });
    });

    it("changes when the CV design changes", () => {
        const cv = makeCv();
        const before = pickLetterDesign(cv.settings);
        cv.settings.colors.accent = "#00ff00";
        expect(pickLetterDesign(cv.settings)).not.toEqual(before);
    });

    it("carries nothing but the letter's design fields", () => {
        const keys = Object.keys(pickLetterDesign(makeCv().settings)).sort();
        expect(keys).toEqual(["accentColor", "fontFamily", "fontSize", "headerFontFamily", "headerFontStyle", "headerFontWeight", "headerTextTransform", "lineHeight", "marginHmm", "marginVmm", "textColor"]);
    });
});
