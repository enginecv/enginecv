import { describe, expect, it } from "vitest";
import { DIN5008_A4, dinBlocks, mmToPx, usableBodyHeightMm } from "./din5008";

describe("DIN 5008 geometry (A4, Form B)", () => {
    it("has the window-envelope address field 45 mm from the top, 20 mm from the left, 85 x 45 mm", () => {
        expect(DIN5008_A4.addressField).toMatchObject({ top: 45, left: 20, width: 85, height: 45 });
    });

    it("keeps the address field inside the page and clear of the information block", () => {
        const { addressField, infoBlock, page } = DIN5008_A4;
        expect(addressField.left + addressField.width).toBeLessThanOrEqual(infoBlock.left);
        // The block runs into the right margin (to 200 mm) but keeps at least 8 mm from the edge.
        expect(infoBlock.left + infoBlock.width).toBeLessThanOrEqual(page.width - 8);
        expect(addressField.top + addressField.height).toBeLessThan(DIN5008_A4.bodyTop);
    });

    it("puts the fold marks at 105 and 210 mm and the punch mark at the page's middle", () => {
        expect([...DIN5008_A4.foldMarks]).toEqual([105, 210]);
        expect(DIN5008_A4.punchMark).toBe(DIN5008_A4.page.height / 2);
    });

    it("uses margins of 25 mm left and 20 mm right", () => {
        expect(DIN5008_A4.marginLeft).toBe(25);
        expect(DIN5008_A4.marginRight).toBe(20);
    });

    it("gives the first page less room for text than later pages, because of the address zones", () => {
        expect(usableBodyHeightMm(0)).toBeCloseTo(297 - 98.5 - 20);
        expect(usableBodyHeightMm(1)).toBeCloseTo(297 - 25 - 20);
        expect(usableBodyHeightMm(0)).toBeLessThan(usableBodyHeightMm(1));
    });

    it("converts millimetres to pixels at 96 dpi", () => {
        expect(mmToPx(25.4)).toBeCloseTo(96);
        expect(mmToPx(DIN5008_A4.page.width)).toBeCloseTo(793.7, 0);
    });
});

describe("dinBlocks", () => {
    it("builds one small return-address line and the recipient lines", () => {
        const blocks = dinBlocks({ senderName: "Amina Hodzic", senderAddress: "Hauptstr. 1\n10115 Berlin", recipientName: "Frau Roe", recipientAddress: "Acme GmbH\nMusterweg 2\n20095 Hamburg" });
        expect(blocks.returnLine).toBe("Amina Hodzic · Hauptstr. 1, 10115 Berlin");
        expect(blocks.recipient).toEqual(["Frau Roe", "Acme GmbH", "Musterweg 2", "20095 Hamburg"]);
    });

    it("leaves out what is empty and never overflows the address zone", () => {
        expect(dinBlocks({ senderName: "", senderAddress: "", recipientName: "", recipientAddress: "" })).toEqual({ returnLine: "", recipient: [] });
        const long = dinBlocks({ senderName: "A", senderAddress: "", recipientName: "R", recipientAddress: Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n") });
        expect(long.recipient.length).toBeLessThanOrEqual(9);
    });
});
