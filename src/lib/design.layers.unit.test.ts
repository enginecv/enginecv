import { describe, expect, it } from "vitest";
import {
    createDesignElement,
    getDesignLayer,
    getOverlayMaxSize,
    getOverlayPositionLimits,
    moveDesignElementLayer,
    OVERLAY_MIN_VISIBLE_PX,
    setDesignElementLayerSide,
    type DesignElement,
} from "./design";
import { createEmptyResume, resumeSchema } from "./schema";

function el(id: string, zIndex: number, layer: "front" | "behind" = "front", pageIndex = 0): DesignElement {
    return { ...createDesignElement("shape", { pageIndex, zIndex }), id, layer };
}
const order = (elements: DesignElement[], page = 0) =>
    elements.filter((e) => e.pageIndex === page).sort((a, b) => a.zIndex - b.zIndex).map((e) => `${e.id}:${getDesignLayer(e)}`);

describe("design element layers", () => {
    it("defaults to in front, also for files saved before layers existed and for junk values", () => {
        expect(createDesignElement("text").layer).toBe("front");
        const resume = createEmptyResume();
        const raw = { ...resume, settings: { ...resume.settings, design: { elements: [
            { id: "old", type: "shape", x: 1, y: 2 },
            { id: "junk", type: "shape", layer: "sideways" },
            { id: "behind", type: "shape", layer: "behind" },
        ] } } };
        const parsed = resumeSchema.parse(raw).settings.design.elements;
        expect(parsed.map((e) => e.layer)).toEqual(["front", "front", "behind"]);
        expect(parsed[0]).toMatchObject({ x: 1, y: 2 });
        expect(getDesignLayer({})).toBe("front");
    });

    it("orders within a layer only: forward/back never cross into the other layer", () => {
        const elements = [el("b1", 1, "behind"), el("f1", 2), el("b2", 3, "behind"), el("f2", 4)];

        expect(order(moveDesignElementLayer(elements, "b1", "front"))).toEqual(["b2:behind", "f1:front", "b1:behind", "f2:front"]);
        expect(order(moveDesignElementLayer(elements, "f2", "back"))).toEqual(["b1:behind", "f2:front", "b2:behind", "f1:front"]);
        expect(order(moveDesignElementLayer(elements, "b2", "backward"))).toEqual(["b2:behind", "f1:front", "b1:behind", "f2:front"]);
        expect(order(moveDesignElementLayer(elements, "f1", "forward"))).toEqual(["b1:behind", "f2:front", "b2:behind", "f1:front"]);
        // Already at the end of its own layer: nothing changes.
        expect(order(moveDesignElementLayer(elements, "f2", "front"))).toEqual(order(elements));
        expect(order(moveDesignElementLayer(elements, "b1", "back"))).toEqual(order(elements));
    });

    it("changes layer only on request, landing on top of the new layer, and leaves other pages alone", () => {
        const elements = [el("a", 1), el("b", 2, "behind"), el("c", 3), el("p2", 1, "front", 1)];

        const moved = setDesignElementLayerSide(elements, "a", "behind");
        expect(moved.find((e) => e.id === "a")?.layer).toBe("behind");
        expect(order(moved)).toEqual(["b:behind", "c:front", "a:behind"]);
        expect(order(moved, 1)).toEqual(["p2:front"]);

        expect(setDesignElementLayerSide(elements, "a", "front").map((e) => e.layer)).toEqual(["front", "behind", "front", "front"]);
        expect(setDesignElementLayerSide(elements, "missing", "behind")).toHaveLength(4);
    });
});

describe("overlay bounds", () => {
    it("lets an element reach every edge and bleed past it, always leaving part of it grabbable", () => {
        const limits = getOverlayPositionLimits(200, 100, 794, 1123);
        expect(limits).toEqual({
            minX: OVERLAY_MIN_VISIBLE_PX - 200,
            maxX: 794 - OVERLAY_MIN_VISIBLE_PX,
            minY: OVERLAY_MIN_VISIBLE_PX - 100,
            maxY: 1123 - OVERLAY_MIN_VISIBLE_PX,
        });
        // Edge to edge is inside the limits.
        expect(limits.minX).toBeLessThanOrEqual(0);
        expect(limits.maxX).toBeGreaterThanOrEqual(794 - 200);
        expect(limits.maxY).toBeGreaterThanOrEqual(1123 - 100);
    });

    it("never demands more visible than the element has", () => {
        const tiny = getOverlayPositionLimits(10, 10, 794, 1123);
        expect(tiny.minX).toBe(0);
        expect(tiny.minY).toBe(0);
    });

    it("allows sizes up to twice the paper", () => {
        expect(getOverlayMaxSize(794, 1123)).toEqual({ width: 1588, height: 2246 });
    });
});
