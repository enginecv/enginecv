export type Size = { width: number; height: number };
export type Pan = { x: number; y: number };
export type PanBounds = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
};

const ZERO_BOUNDS: PanBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

function axisRange(viewport: number, content: number): { min: number; max: number } {
    const v = Number.isFinite(viewport) && viewport > 0 ? viewport : 0;
    const c = Number.isFinite(content) && content > 0 ? content : 0;
    if (v <= 0 || c <= 0 || c <= v) return { min: 0, max: 0 };
    const half = (c - v) / 2;
    return { min: -half, max: half };
}

export function computePanBounds(viewport: Size, content: Size): PanBounds {
    if (!viewport || !content) return ZERO_BOUNDS;
    const x = axisRange(viewport.width, content.width);
    const y = axisRange(viewport.height, content.height);
    return { minX: x.min, maxX: x.max, minY: y.min, maxY: y.max };
}

export function clampPan(pan: Pan, bounds: PanBounds): Pan {
    const x = Math.min(Math.max(pan.x, bounds.minX), bounds.maxX);
    const y = Math.min(Math.max(pan.y, bounds.minY), bounds.maxY);
    return { x, y };
}
