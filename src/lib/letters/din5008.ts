/**
 * Geometry of a German business letter, DIN 5008 "Form B" on A4, in millimetres.
 *
 * Checked against secondary sources, not the standard's own text (which is paid): the margins,
 * the 85 x 45 mm address field 45 mm from the top and 20 mm from the left (the current edition,
 * DIN 5008:2020; older ones say 50 mm), and the fold and punch marks of the DIN 676 sheet. Before
 * relying on this for a printed, enveloped letter, compare one printout against the standard or a
 * trusted template. The 2 blank lines between the address field and the subject are approximated
 * as 8.5 mm.
 *
 * Sources: de.wikipedia.org/wiki/DIN_5008 (field heights and the older 50 mm), macwelt.de
 * "Know-how Normsatz" (fold marks 105 and 210 mm, centre and punch mark 148.5 mm),
 * briefmarkenmesse-essen.de and gruendung.de/din-5008 (address field and margins).
 */
export const DIN5008_A4 = {
    page: { width: 210, height: 297 },
    /** Text starts 25 mm from the left edge and stops 20 mm from the right edge. */
    marginLeft: 25,
    marginRight: 20,
    /** Page 2 onwards: a plain top margin. Page 1 has the letterhead and address zones above the text. */
    marginTopLater: 25,
    marginBottom: 20,
    /** The letterhead zone: the sender block lives here, above the address field. */
    letterhead: { top: 12.7, height: 32.3 },
    /** The window-envelope address field: 5 mm return-address strip plus 40 mm for the address. */
    addressField: { left: 20, top: 45, width: 85, height: 45, returnStripHeight: 5 },
    /** The information block to the right of the address field (date and the like). */
    infoBlock: { left: 125, top: 45, width: 75 },
    /** Where the first line of the letter body (the subject) starts. */
    bodyTop: 98.5,
    /** Short lines at the left edge, shown on screen to help with folding and filing. */
    foldMarks: [105, 210] as const,
    foldMarkLength: 5,
    punchMark: 148.5,
    punchMarkLength: 4,
} as const;

/** Millimetres to CSS pixels at 96 dpi. */
export const mmToPx = (mm: number): number => (mm * 96) / 25.4;

/** Usable height for flowing text on page `pageIndex` (0-based), in mm. */
export function usableBodyHeightMm(pageIndex: number): number {
    const top = pageIndex === 0 ? DIN5008_A4.bodyTop : DIN5008_A4.marginTopLater;
    return DIN5008_A4.page.height - top - DIN5008_A4.marginBottom;
}

export interface DinBlocks {
    /** The sender's single return-address line printed small above the recipient. */
    returnLine: string;
    /** Recipient lines, name first, at most as many as fit the address zone. */
    recipient: string[];
}

const ADDRESS_ZONE_LINES = 9; // 40 mm at roughly 4.4 mm a line

/** The texts that go into the address field. */
export function dinBlocks(input: { senderName: string; senderAddress: string; recipientName: string; recipientAddress: string }): DinBlocks {
    const addressLines = input.senderAddress.split("\n").map((line) => line.trim()).filter(Boolean);
    const returnLine = [input.senderName.trim(), addressLines.join(", ")].filter(Boolean).join(" · ");
    const recipient = [input.recipientName.trim(), ...input.recipientAddress.split("\n").map((line) => line.trim())].filter(Boolean);
    return { returnLine, recipient: recipient.slice(0, ADDRESS_ZONE_LINES) };
}
