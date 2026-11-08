import { findNodeAtLocation, getLocation, parseTree } from "jsonc-parser";
import type { PathSegment } from "@/lib/agent/authoring/notices";

export type { PathSegment };
export interface TextRange { from: number; to: number }

/** Missing fields point to their closest existing parent. No editor dependency. */
export function rangeForPath(text: string, path: readonly PathSegment[]): TextRange | null {
    const tree = parseTree(text);
    if (!tree) return null;
    for (let length = path.length; length >= 0; length--) {
        const node = findNodeAtLocation(tree, path.slice(0, length));
        if (node) return { from: node.offset, to: node.offset + node.length };
    }
    return null;
}

export function pathAtOffset(text: string, offset: number): { path: PathSegment[]; isKey: boolean } {
    const location = getLocation(text, Math.max(0, Math.min(offset, text.length)));
    return { path: location.path, isKey: location.isAtPropertyKey };
}

/** Inverse of formatPath for notice navigation, including quoted record keys. */
export function segmentsForPath(path: string): PathSegment[] {
    if (path === "(document)") return [];
    return [...path.matchAll(/(?:^|\.)([^.[\]]+)|\[(\d+|"(?:\\.|[^"\\])*")\]/g)].map(match => match[1] ?? JSON.parse(match[2]));
}
