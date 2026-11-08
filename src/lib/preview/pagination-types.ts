import type { ReactNode } from "react";

export type PreviewSectionKey =
    | "experience"
    | "education"
    | "courses"
    | "certificates"
    | "awards"
    | "publications"
    | "references"
    | "declaration"
    | "projects"
    | "organisations"
    | "interests"
    | "languages"
    | "skills";

export type PreviewBlockKind =
    | "header"
    | "summary"
    | "section-heading"
    | "entry"
    | "separator"
    | "vertical-separator"
    | "section-pair"
    | "page-break"
    | "empty";

export type LayoutSectionPlacement = "left" | "right" | "full";

export type PreviewFlowItemKind = "section" | "separator" | "vertical-separator" | "page-break";

export type PreviewRenderableItemKind = PreviewFlowItemKind | "section-pair";

export interface PreviewBlock {
    key: string;
    kind: PreviewBlockKind;
    node: ReactNode;
    section?: PreviewSectionKey;
    // Preview→sidebar navigation metadata: the configured content-section key
    // (e.g. "experience" or "experience:2") and, for entry blocks, the entry index.
    navSection?: string;
    navEntryIndex?: number;
}

export interface PreviewSection {
    key: string;
    base: PreviewSectionKey;
    headingNode: ReactNode;
    entryNodes: ReactNode[];
}

// Generic over the section descriptor so the flow resolver can order the
// React-node sections the preview builds AND the plain data sections the
// exporters build, from one implementation.
export interface PreviewFlowItem<T extends OrderableSection = PreviewSection> {
    key: string;
    kind: PreviewFlowItemKind;
    section?: T;
}

/** Minimum a section must expose to be placed by `layout.sectionOrder`. */
export interface OrderableSection {
    key: string;
    base: string;
}

export interface PreviewRenderableItem {
    key: string;
    kind: PreviewRenderableItemKind;
    section?: PreviewSection;
    leftSection?: PreviewSection;
    rightSection?: PreviewSection;
}

// Serializable descriptor of what a positioned item renders. The node itself is
// NOT stored in state — it is rebuilt from current render data at render time.
// Keeping state pure makes layout equality decidable so the pagination effect can
// converge instead of rescheduling every frame, and guarantees the displayed page
// reflects the latest content (mirrors the linear path, which stores block indices
// and renders from current data).
export type LayoutItemRender =
    | { type: "profile" }
    | { type: "paired"; itemKey: string }
    | { type: "vseparator"; itemKey: string }
    | { type: "separator"; itemKey: string }
    | { type: "chunk"; sectionKey: string; includeHeading: boolean; entryIndices: number[] };

export interface PositionedLayoutItem {
    key: string;
    render: LayoutItemRender;
    x: number;
    y: number;
    width: number;
}

export type ResizeHandle = "nw" | "ne" | "sw" | "se";
