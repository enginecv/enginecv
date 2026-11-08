import { createId } from "./id";

export const DESIGN_ELEMENT_TYPES = ["text", "shape", "image", "block", "gradient"] as const;
const DESIGN_ELEMENT_SHAPES = ["rectangle", "ellipse"] as const;
export const DESIGN_FILL_MODES = ["solid", "gradient"] as const;
export const DESIGN_FONT_WEIGHTS = ["100", "200", "300", "400", "500", "600", "700", "800", "900", "1000", "normal", "medium", "semibold", "bold", "extrabold"] as const;
export const DESIGN_OBJECT_FITS = ["cover", "contain", "fill"] as const;
export const DESIGN_PLACEMENTS = ["overlay"] as const;

export type DesignElementType = typeof DESIGN_ELEMENT_TYPES[number];
export type DesignElementShape = typeof DESIGN_ELEMENT_SHAPES[number];
export type DesignFillMode = typeof DESIGN_FILL_MODES[number];
export type DesignFontWeight = typeof DESIGN_FONT_WEIGHTS[number];
export type DesignObjectFit = typeof DESIGN_OBJECT_FITS[number];
export type DesignPlacement = typeof DESIGN_PLACEMENTS[number];

export interface DesignBorder {
    style: "solid" | "dotted" | "dashed";
    width: number;
    color: string;
    radius: number;
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
    dashLength: number;
    dashGap: number;
}

export interface DesignElementStyle {
    opacity: number;
    color: string;
    backgroundColor: string;
    fillMode: DesignFillMode;
    gradientFrom: string;
    gradientTo: string;
    gradientAngle: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: DesignFontWeight;
    fontStyle: "normal" | "italic";
    textDecoration: "none" | "underline" | "line-through";
    textTransform: "none" | "uppercase" | "capitalize" | "lowercase";
    lineHeight: number;
    letterSpacing: number;
    textAlign: "left" | "center" | "right";
    objectFit: DesignObjectFit;
    paddingTop: number;
    paddingBottom: number;
    paddingLeft: number;
    paddingRight: number;
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    border: DesignBorder;
}

export interface DesignElement {
    id: string;
    type: DesignElementType;
    placement: DesignPlacement;
    pageIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    text: string;
    imageSrc: string;
    shape: DesignElementShape;
    style: DesignElementStyle;
}

export interface DesignSettings {
    elements: DesignElement[];
}

export const DEFAULT_DESIGN_BORDER: DesignBorder = {
    style: "solid",
    width: 0,
    color: "",
    radius: 0,
    top: false,
    bottom: false,
    left: false,
    right: false,
    dashLength: 6,
    dashGap: 4,
};

export const DEFAULT_DESIGN_STYLE: DesignElementStyle = {
    opacity: 100,
    color: "#111827",
    backgroundColor: "",
    fillMode: "solid",
    gradientFrom: "#ffaa8d",
    gradientTo: "#fff8f6",
    gradientAngle: 135,
    fontFamily: "",
    fontSize: 18,
    fontWeight: "700",
    fontStyle: "normal",
    textDecoration: "none",
    textTransform: "none",
    lineHeight: 1.2,
    letterSpacing: 0,
    textAlign: "left",
    objectFit: "cover",
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    border: DEFAULT_DESIGN_BORDER,
};

export const DEFAULT_DESIGN_SETTINGS: DesignSettings = {
    elements: [],
};

function cloneBorder(border: DesignBorder): DesignBorder {
    return { ...border };
}

function cloneStyle(style: DesignElementStyle): DesignElementStyle {
    return {
        ...style,
        border: cloneBorder(style.border),
    };
}

export function cloneDesignElement(element: DesignElement): DesignElement {
    return {
        ...element,
        style: cloneStyle(element.style),
    };
}

function createAccentBorder(accentColor: string, width: number, radius = 0): DesignBorder {
    return {
        ...DEFAULT_DESIGN_BORDER,
        width,
        radius,
        color: accentColor,
        top: true,
        bottom: true,
        left: true,
        right: true,
    };
}

export function getNextDesignZIndex(elements: DesignElement[], pageIndex: number) {
    return elements
        .filter((element) => element.pageIndex === pageIndex)
        .reduce((max, element) => Math.max(max, element.zIndex), 0) + 1;
}

export function createDesignElement(
    type: DesignElementType,
    {
        pageIndex = 0,
        zIndex = 1,
        accentColor = "#ffaa8d",
        textColor = "#111827",
    }: {
        pageIndex?: number;
        zIndex?: number;
        accentColor?: string;
        textColor?: string;
    } = {},
): DesignElement {
    const baseStyle: DesignElementStyle = {
        ...DEFAULT_DESIGN_STYLE,
        color: textColor,
        gradientFrom: accentColor,
    };

    const baseElement: DesignElement = {
        id: createId(),
        type,
        placement: "overlay",
        pageIndex,
        x: 48,
        y: 48,
        width: 220,
        height: 120,
        zIndex,
        text: "",
        imageSrc: "",
        shape: "rectangle",
        style: baseStyle,
    };

    if (type === "text") {
        return {
            ...baseElement,
            width: 260,
            height: 92,
            text: "Creative headline",
            style: {
                ...baseStyle,
                fontSize: 22,
                fontWeight: "800",
                lineHeight: 1.15,
            },
        };
    }

    if (type === "image") {
        return {
            ...baseElement,
            width: 170,
            height: 170,
            style: {
                ...baseStyle,
                backgroundColor: "#f5f5f7",
                border: createAccentBorder(accentColor, 1, 16),
            },
        };
    }

    if (type === "block") {
        return {
            ...baseElement,
            width: 240,
            height: 140,
            style: {
                ...baseStyle,
                opacity: 18,
                backgroundColor: accentColor,
                border: cloneBorder(DEFAULT_DESIGN_BORDER),
            },
        };
    }

    if (type === "gradient") {
        return {
            ...baseElement,
            width: 280,
            height: 160,
            style: {
                ...baseStyle,
                opacity: 55,
                fillMode: "gradient",
                gradientFrom: accentColor,
                gradientTo: "#ffffff",
                border: cloneBorder(DEFAULT_DESIGN_BORDER),
            },
        };
    }

    return {
        ...baseElement,
        width: 190,
        height: 120,
        style: {
            ...baseStyle,
            backgroundColor: "#ffffff",
            border: createAccentBorder(accentColor, 2, 16),
        },
    };
}

export function duplicateDesignElement(element: DesignElement, zIndex: number): DesignElement {
    const duplicated = cloneDesignElement(element);
    duplicated.id = createId();
    duplicated.x += 24;
    duplicated.y += 24;
    duplicated.zIndex = zIndex;
    return duplicated;
}

export function normalizeDesignElementOrder(elements: DesignElement[]): DesignElement[] {
    const pageBuckets = new Map<number, DesignElement[]>();

    elements.forEach((element) => {
        const pageElements = pageBuckets.get(element.pageIndex) || [];
        pageElements.push(cloneDesignElement(element));
        pageBuckets.set(element.pageIndex, pageElements);
    });

    const normalized: DesignElement[] = [];

    Array.from(pageBuckets.keys())
        .sort((left, right) => left - right)
        .forEach((pageIndex) => {
            const pageElements = pageBuckets.get(pageIndex) || [];
            pageElements
                .sort((left, right) => {
                    if (left.zIndex !== right.zIndex) {
                        return left.zIndex - right.zIndex;
                    }
                    return left.id.localeCompare(right.id);
                })
                .forEach((element, index) => {
                    normalized.push({
                        ...element,
                        zIndex: index + 1,
                    });
                });
        });

    return normalized;
}

export function moveDesignElementLayer(
    elements: DesignElement[],
    id: string,
    direction: "forward" | "backward" | "front" | "back",
): DesignElement[] {
    const normalized = normalizeDesignElementOrder(elements);
    const target = normalized.find((element) => element.id === id);
    if (!target) {
        return normalized;
    }

    const pageElements = normalized.filter((element) => element.pageIndex === target.pageIndex);
    const otherElements = normalized.filter((element) => element.pageIndex !== target.pageIndex);
    const index = pageElements.findIndex((element) => element.id === id);
    if (index === -1) {
        return normalized;
    }

    const nextPageElements = [...pageElements];
    const [current] = nextPageElements.splice(index, 1);

    if (direction === "back") {
        nextPageElements.unshift(current);
    } else if (direction === "front") {
        nextPageElements.push(current);
    } else if (direction === "forward") {
        nextPageElements.splice(Math.min(index + 1, nextPageElements.length), 0, current);
    } else {
        nextPageElements.splice(Math.max(index - 1, 0), 0, current);
    }

    return normalizeDesignElementOrder([...otherElements, ...nextPageElements]);
}
