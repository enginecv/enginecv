export type PageGeometryInput = {
    pageContentHeight: number;
    marginVerticalPx: number;
    footerHeightPx: number;
};

export type PageGeometry = {
    topPaddingPx: number;
    bottomPaddingPx: number;
    footerBandPx: number;
    usableContentHeightPx: number;
    contentTopPx: number;
    contentBottomPx: number;
    footerTopPx: number;
};

// Single source of truth for per-page usable height. Both linear and structured
// pagination passes consume this so the two paths cannot drift. Recomputed once
// per resumeLayoutSignature change inside requestAnimationFrame; O(1).
export function derivePageGeometry({
    pageContentHeight,
    marginVerticalPx,
    footerHeightPx,
}: PageGeometryInput): PageGeometry {
    const safePageHeight = Math.max(0, pageContentHeight);
    const safeMargin = Math.max(0, marginVerticalPx);
    const safeFooter = Math.max(0, footerHeightPx);

    const topPaddingPx = safeMargin;
    const bottomPaddingPx = safeMargin;
    const footerBandPx = safeFooter;

    const rawUsable = safePageHeight - topPaddingPx - bottomPaddingPx - footerBandPx;
    const usableContentHeightPx = Math.max(0, rawUsable);

    const contentTopPx = topPaddingPx;
    const contentBottomPx = contentTopPx + usableContentHeightPx;
    const footerTopPx = safePageHeight - footerBandPx - bottomPaddingPx;

    return {
        topPaddingPx,
        bottomPaddingPx,
        footerBandPx,
        usableContentHeightPx,
        contentTopPx,
        contentBottomPx,
        footerTopPx,
    };
}
