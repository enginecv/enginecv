"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import "@/components/editor/preview-fonts";
import { PreviewViewport } from "@/components/editor/PreviewViewport";
import { PAPER } from "@/components/editor/preview/preview-constants";
import { DIN5008_A4, dinBlocks, mmToPx, usableBodyHeightMm } from "@/lib/letters/din5008";
import { paginateBlocks, type PageBlock } from "@/lib/letters/paginate";
import type { ResolvedLetter } from "@/lib/letters/resolve";
import { LetterMarkdown } from "./LetterMarkdown";

/** Page sizes in CSS pixels at 96 dpi: the CV preview's own paper table. */
export const PAGE_PX = PAPER;

interface PreviewBlock extends PageBlock {
    node: ReactNode;
}

function lines(text: string): string[] {
    return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

function fontStack(family: string): string {
    return family ? `'${family}', sans-serif` : "sans-serif";
}

const isGerman = (letter: ResolvedLetter) => letter.layout === "din5008";

function senderBlock(letter: ResolvedLetter, spacing: string, bordered: boolean): ReactNode {
    const { sender, design } = letter;
    const contact = [sender.email, sender.phone, sender.website].filter(Boolean).join("  ·  ");
    return (
        <div style={{ paddingBottom: spacing, display: "flex", justifyContent: "space-between", gap: 16, ...(bordered ? { borderBottom: `1.5px solid ${design.accentColor}`, marginBottom: spacing } : {}) }}>
            <div>
                <div style={{ fontFamily: fontStack(design.headerFontFamily || design.fontFamily), fontSize: "1.9em", fontWeight: Number(design.headerFontWeight) || 700, fontStyle: design.headerFontStyle === "italic" ? "italic" : "normal", textTransform: design.headerTextTransform === "none" ? undefined : (design.headerTextTransform as CSSProperties["textTransform"]), lineHeight: 1.1 }}>
                    {sender.name}
                </div>
                {sender.headline && <div style={{ opacity: 0.65 }}>{sender.headline}</div>}
                {contact && <div style={{ marginTop: "0.4em" }}>{contact}</div>}
                {lines(sender.address).map((line, index) => <div key={index}>{line}</div>)}
            </div>
            {letter.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={letter.photo} alt="" style={{ width: 72, height: 90, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
            )}
        </div>
    );
}

/** The letter as ordered blocks, each of which stays whole when pages are cut. */
function buildBlocks(letter: ResolvedLetter): PreviewBlock[] {
    const { sender, design } = letter;
    const spacing = `${(design.lineHeight * 0.9).toFixed(2)}em`;
    const space: CSSProperties = { paddingBottom: spacing };
    const blocks: PreviewBlock[] = [];
    const push = (id: string, node: ReactNode, keepWithNext = false) => blocks.push({ id, height: 0, keepWithNext, node });

    // The German layout places the sender, address and date at fixed spots on page 1 instead.
    if (!isGerman(letter)) {
        push("sender", senderBlock(letter, spacing, true));
        const recipientLines = [letter.recipient.name.trim(), ...lines(letter.recipient.address)].filter(Boolean);
        push("meta", (
            <div style={space}>
                <div style={{ textAlign: "right", marginBottom: spacing }}>{letter.date}</div>
                {recipientLines.map((line, index) => <div key={index}>{line}</div>)}
            </div>
        ));
    }

    if (letter.subject.trim()) push("subject", <div style={{ ...space, fontWeight: 700 }}>{letter.subject}</div>);
    if (letter.salutation.trim()) push("salutation", <div style={space}>{letter.salutation}</div>, true);

    const filled = letter.paragraphs.filter((paragraph) => !paragraph.empty);
    filled.forEach((paragraph, index) => {
        push(`p:${paragraph.id}`, <div style={space}><LetterMarkdown markdown={paragraph.previewMarkdown} /></div>, index === filled.length - 1);
    });

    if (letter.closing.trim()) push("closing", <div style={{ paddingBottom: "2.4em" }}>{letter.closing}</div>, true);
    push("signature", <div>{sender.signatureName || sender.name}</div>);
    return blocks;
}

const mm = (value: number) => `${mmToPx(value)}px`;

/** Page 1 of the German layout: letterhead, return line and recipient in the address field, and the date. */
function germanPageOne(letter: ResolvedLetter): ReactNode {
    const { addressField, infoBlock, letterhead, marginLeft, marginRight } = DIN5008_A4;
    const blocks = dinBlocks({ senderName: letter.sender.name, senderAddress: letter.sender.address, recipientName: letter.recipient.name, recipientAddress: letter.recipient.address });
    return (
        <>
            <div data-din="letterhead" style={{ position: "absolute", left: mm(marginLeft), right: mm(marginRight), top: mm(letterhead.top), height: mm(letterhead.height), overflow: "hidden" }}>
                {senderBlock(letter, "0", false)}
            </div>
            <div data-din="address-field" style={{ position: "absolute", left: mm(addressField.left), top: mm(addressField.top), width: mm(addressField.width), height: mm(addressField.height), overflow: "hidden" }}>
                <div style={{ height: mm(addressField.returnStripHeight), fontSize: "0.6em", lineHeight: 1.1, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingTop: 2 }}>{blocks.returnLine}</div>
                <div>{blocks.recipient.map((line, index) => <div key={index}>{line}</div>)}</div>
            </div>
            <div data-din="info-block" style={{ position: "absolute", left: mm(infoBlock.left), top: mm(infoBlock.top), width: mm(infoBlock.width), textAlign: "right", paddingRight: mm(10) }}>{letter.date}</div>
        </>
    );
}

/** Fold and punch marks at the left edge. They always show on screen; they print only when asked. */
function foldMarks(letter: ResolvedLetter): ReactNode {
    const className = `letter-fold-mark${letter.printFoldMarks ? " letter-fold-mark-print" : ""}`;
    const mark = (top: number, length: number, key: string) => (
        <div key={key} data-fold-mark={key} className={className} style={{ position: "absolute", left: 0, top: mm(top), width: mm(length), height: 0, borderTop: "0.75px solid #6b7280" }} />
    );
    return (
        <>
            {DIN5008_A4.foldMarks.map((top) => mark(top, DIN5008_A4.foldMarkLength, `fold-${top}`))}
            {mark(DIN5008_A4.punchMark, DIN5008_A4.punchMarkLength, "punch")}
        </>
    );
}

function pageStyle(letter: ResolvedLetter, pageIndex: number): CSSProperties {
    const { width, height } = PAGE_PX[letter.paperSize];
    const { design } = letter;
    const german = isGerman(letter);
    const padding = german
        ? `${mmToPx(pageIndex === 0 ? DIN5008_A4.bodyTop : DIN5008_A4.marginTopLater)}px ${mmToPx(DIN5008_A4.marginRight)}px ${mmToPx(DIN5008_A4.marginBottom)}px ${mmToPx(DIN5008_A4.marginLeft)}px`
        : `${mmToPx(design.marginVmm)}px ${mmToPx(design.marginHmm)}px`;
    return {
        width,
        height,
        padding,
        boxSizing: "border-box",
        background: "#ffffff",
        color: design.textColor,
        fontFamily: fontStack(design.fontFamily),
        fontSize: `${design.fontSize * (96 / 72)}px`,
        lineHeight: design.lineHeight,
        overflow: "hidden",
        position: "relative",
    };
}

/** Token highlights and unprinted marks are for editing only: they must not reach the printed PDF. */
const EDIT_ONLY_STYLES = `
    .letter-chip { background: rgba(37, 99, 235, 0.12); border-radius: 3px; padding: 0 2px; }
    .letter-chip-unresolved { background: rgba(220, 38, 38, 0.14); color: #b91c1c; border-radius: 3px; padding: 0 2px; }
    @media print {
        .letter-chip { background: none !important; padding: 0 !important; }
        .letter-chip-unresolved { display: none !important; }
        .letter-fold-mark:not(.letter-fold-mark-print) { display: none !important; }
    }
`;

/**
 * The letter drawn as fixed-size pages inside the same viewport the CV preview has (fit to the pane,
 * zoom, pan, fullscreen). The pages carry the CV's page classes and inline pixel sizes, so the CV's
 * PDF and HTML export paths work on them unchanged.
 */
export function LetterPreview({ letter }: { letter: ResolvedLetter }) {
    const blocks = useMemo(() => buildBlocks(letter), [letter]);
    const [pages, setPages] = useState<string[][]>(() => [blocks.map((block) => block.id)]);
    const measurerRef = useRef<HTMLDivElement>(null);

    const german = isGerman(letter);
    const geometry = PAGE_PX[letter.paperSize];
    const margins = german
        ? { left: DIN5008_A4.marginLeft, right: DIN5008_A4.marginRight }
        : { left: letter.design.marginHmm, right: letter.design.marginHmm };
    const contentWidth = geometry.width - mmToPx(margins.left) - mmToPx(margins.right);
    const usableHeight = useCallback((pageIndex: number) => (german ? mmToPx(usableBodyHeightMm(pageIndex)) : geometry.height - 2 * mmToPx(letter.design.marginVmm)), [german, geometry.height, letter.design.marginVmm]);

    const measure = useCallback(() => {
        const root = measurerRef.current;
        if (!root) return;
        const heights = new Map<string, number>();
        root.querySelectorAll<HTMLElement>("[data-measure-id]").forEach((element) => heights.set(element.dataset.measureId ?? "", element.offsetHeight));
        const measured: PageBlock[] = blocks.map((block) => ({ id: block.id, height: heights.get(block.id) ?? 0, keepWithNext: block.keepWithNext }));
        const next = paginateBlocks(measured, usableHeight);
        setPages((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    }, [blocks, usableHeight]);

    // Re-cut the pages whenever the content or the design changes, in one animation frame.
    useLayoutEffect(() => {
        const frame = requestAnimationFrame(measure);
        return () => cancelAnimationFrame(frame);
    }, [measure]);

    // Web fonts change line heights when they arrive.
    useEffect(() => {
        void document.fonts?.ready.then(measure);
    }, [measure]);

    const base = pageStyle(letter, 0);
    const byId = new Map(blocks.map((block) => [block.id, block]));

    return (
        <div className="w-full h-full" data-testid="letter-preview" data-layout={letter.layout}>
            {/* A pane that was hidden measures as zero, so the viewport asks for a re-cut when it shows. */}
            <PreviewViewport paperWidth={geometry.width} paperHeight={geometry.height} pageCount={pages.length} onResize={measure}>
                {(scale) => (
                    <>
                        <style>{EDIT_ONLY_STYLES}</style>
                        {/* Off-screen copy used only to measure each block at the real content width. */}
                        <div ref={measurerRef} aria-hidden="true" style={{ position: "absolute", visibility: "hidden", left: -99999, top: 0, width: contentWidth, fontFamily: base.fontFamily, fontSize: base.fontSize, lineHeight: base.lineHeight }}>
                            {blocks.map((block) => <div key={block.id} data-measure-id={block.id}>{block.node}</div>)}
                        </div>
                        {pages.map((ids, pageIndex) => (
                            <div
                                key={pageIndex}
                                className="resume-page bg-white text-black shadow-2xl shrink-0 print-exact-page-wrapper"
                                data-testid="letter-page"
                                data-preview-page={pageIndex + 1}
                                style={{ ...pageStyle(letter, pageIndex), zoom: scale }}
                            >
                                {german && pageIndex === 0 && germanPageOne(letter)}
                                {german && foldMarks(letter)}
                                {ids.map((id) => <div key={id}>{byId.get(id)?.node}</div>)}
                            </div>
                        ))}
                    </>
                )}
            </PreviewViewport>
        </div>
    );
}
