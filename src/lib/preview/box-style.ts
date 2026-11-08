import type { CSSProperties } from "react";

export interface BoxBorderSettings {
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

export function hexToRgb(hex: string) {
    const normalized = hex.replace("#", "").trim();
    const expanded = normalized.length === 3
        ? normalized.split("").map((part) => part + part).join("")
        : normalized;

    if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
        return { r: 17, g: 24, b: 39 };
    }

    return {
        r: parseInt(expanded.slice(0, 2), 16),
        g: parseInt(expanded.slice(2, 4), 16),
        b: parseInt(expanded.slice(4, 6), 16),
    };
}

export function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
    const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
    return `#${[clamp(r), clamp(g), clamp(b)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function blendHex(base: string, mixWith: string, ratio: number) {
    const from = hexToRgb(base);
    const to = hexToRgb(mixWith);
    return rgbToHex({
        r: from.r + (to.r - from.r) * ratio,
        g: from.g + (to.g - from.g) * ratio,
        b: from.b + (to.b - from.b) * ratio,
    });
}

export function hexToRgba(hex: string, alpha: number) {
    const { r, g, b } = hexToRgb(hex);
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function buildBoxBorderStyles(border: BoxBorderSettings, color: string): CSSProperties {
    const radius = `${border.radius}px`;
    const baseStyles: CSSProperties = {
        borderRadius: radius,
    };

    if (border.width <= 0 || (!border.top && !border.bottom && !border.left && !border.right)) {
        return baseStyles;
    }

    if (border.style === "solid") {
        return {
            ...baseStyles,
            ...(border.top ? { borderTop: `${border.width}px solid ${color}` } : {}),
            ...(border.bottom ? { borderBottom: `${border.width}px solid ${color}` } : {}),
            ...(border.left ? { borderLeft: `${border.width}px solid ${color}` } : {}),
            ...(border.right ? { borderRight: `${border.width}px solid ${color}` } : {}),
        };
    }

    const dashLength = border.dashLength || 6;
    const dashGap = border.dashGap || 4;
    const cycle = dashLength + dashGap;
    const layers: string[] = [];
    const positions: string[] = [];
    const sizes: string[] = [];
    const repeats: string[] = [];

    if (border.top) {
        layers.push(`repeating-linear-gradient(to right, ${color} 0, ${color} ${dashLength}px, transparent ${dashLength}px, transparent ${cycle}px)`);
        positions.push("left top");
        sizes.push(`100% ${border.width}px`);
        repeats.push("no-repeat");
    }
    if (border.bottom) {
        layers.push(`repeating-linear-gradient(to right, ${color} 0, ${color} ${dashLength}px, transparent ${dashLength}px, transparent ${cycle}px)`);
        positions.push("left bottom");
        sizes.push(`100% ${border.width}px`);
        repeats.push("no-repeat");
    }
    if (border.left) {
        layers.push(`repeating-linear-gradient(to bottom, ${color} 0, ${color} ${dashLength}px, transparent ${dashLength}px, transparent ${cycle}px)`);
        positions.push("left top");
        sizes.push(`${border.width}px 100%`);
        repeats.push("no-repeat");
    }
    if (border.right) {
        layers.push(`repeating-linear-gradient(to bottom, ${color} 0, ${color} ${dashLength}px, transparent ${dashLength}px, transparent ${cycle}px)`);
        positions.push("right top");
        sizes.push(`${border.width}px 100%`);
        repeats.push("no-repeat");
    }

    return {
        ...baseStyles,
        backgroundImage: layers.join(", "),
        backgroundPosition: positions.join(", "),
        backgroundSize: sizes.join(", "),
        backgroundRepeat: repeats.join(", "),
        overflow: "hidden",
    };
}
