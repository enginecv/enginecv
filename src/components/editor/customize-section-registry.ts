import {
    FolderGit2,
    Globe,
    Heading,
    Image as ImageIcon,
    Layout,
    LayoutTemplate,
    Link,
    List,
    Maximize2,
    Minus,
    Palette,
    Square,
    Type,
    type LucideIcon,
} from "lucide-react";
import type { SectionStyleKey } from "@/lib/schema";

export type CustomizeScope = "resume" | "section";
export type CustomizeGroup =
    | "starting"
    | "appearance"
    | "document"
    | "header"
    | "sections"
    | "advanced";

export interface CustomizeGroupDefinition {
    id: CustomizeGroup;
    labelKey: string;
    order: number;
}

export const CUSTOMIZE_GROUPS: readonly CustomizeGroupDefinition[] = [
    { id: "starting", labelKey: "customize.groupStarting", order: 0 },
    { id: "appearance", labelKey: "customize.groupAppearance", order: 100 },
    { id: "document", labelKey: "customize.groupDocument", order: 200 },
    { id: "header", labelKey: "customize.groupHeader", order: 300 },
    { id: "sections", labelKey: "customize.groupSections", order: 400 },
    { id: "advanced", labelKey: "customize.groupAdvanced", order: 500 },
];

export const CUSTOMIZE_GROUP_BY_ID = Object.fromEntries(
    CUSTOMIZE_GROUPS.map((group) => [group.id, group]),
) as Record<CustomizeGroup, CustomizeGroupDefinition>;

export interface CustomizeSectionDefinition {
    id: string;
    labelKey: string;
    icon: LucideIcon;
    group: CustomizeGroup;
    order: number;
    keywords: readonly string[];
    localStyleKey?: SectionStyleKey;
    sectionBase?: string;
}

export const CUSTOMIZE_SECTIONS = [
    {
        id: "templates",
        labelKey: "editor.templates",
        icon: LayoutTemplate,
        group: "starting",
        order: 10,
        keywords: ["template", "preset", "browse"],
    },
    {
        id: "typography",
        labelKey: "customize.typography",
        icon: Type,
        group: "appearance",
        order: 110,
        keywords: ["font", "typeface", "text"],
    },
    {
        id: "colors",
        labelKey: "customize.colors",
        icon: Palette,
        group: "appearance",
        order: 120,
        keywords: ["color", "colour", "accent", "palette"],
    },
    {
        id: "spacing",
        labelKey: "customize.spacing",
        icon: Maximize2,
        group: "appearance",
        order: 130,
        keywords: ["spacing", "margin", "padding"],
    },
    {
        id: "languageRegion",
        labelKey: "customize.languageRegion",
        icon: Globe,
        group: "document",
        order: 210,
        keywords: ["language", "locale", "date", "region"],
    },
    {
        id: "documentUnits",
        labelKey: "customize.documentUnits",
        icon: Square,
        group: "document",
        order: 220,
        keywords: ["units", "paper", "measurement", "metric", "imperial"],
    },
    {
        id: "layout",
        labelKey: "customize.layout",
        icon: Layout,
        group: "document",
        order: 230,
        keywords: ["layout", "columns", "order", "page break"],
    },
    {
        id: "footer",
        labelKey: "customize.footer",
        icon: Minus,
        group: "document",
        order: 240,
        keywords: ["footer", "page number"],
    },
    {
        id: "personalDetails",
        labelKey: "customize.personalDetailsSection",
        icon: ImageIcon,
        group: "header",
        order: 310,
        keywords: ["header", "personal", "contact", "alignment"],
    },
    {
        id: "headerTypography",
        labelKey: "customize.headerTypography",
        icon: Heading,
        group: "header",
        order: 320,
        keywords: ["header", "font", "name", "headline"],
    },
    {
        id: "personalDetailsSpacing",
        labelKey: "customize.personalDetailsSpacingSection",
        icon: Square,
        group: "header",
        order: 330,
        keywords: ["header", "spacing", "contact"],
    },
    {
        id: "personalPhoto",
        labelKey: "customize.personalPhotoSection",
        icon: ImageIcon,
        group: "header",
        order: 340,
        keywords: ["photo", "image", "avatar", "profile"],
    },
    {
        id: "headerLinkIndicators",
        labelKey: "customize.headerIconTitle",
        icon: Link,
        group: "header",
        order: 350,
        keywords: ["header", "link", "icon", "contact"],
    },
    {
        id: "sectionHeadings",
        labelKey: "customize.sectionHeadings",
        icon: Heading,
        group: "sections",
        order: 410,
        keywords: ["section", "heading", "title"],
        localStyleKey: "headings",
    },
    {
        id: "sectionContent",
        labelKey: "customize.sectionContent",
        icon: Square,
        group: "sections",
        order: 420,
        keywords: ["section", "content", "background", "border"],
        localStyleKey: "contentStyle",
    },
    {
        id: "entryLayout",
        labelKey: "customize.entryLayout",
        icon: List,
        group: "sections",
        order: 430,
        keywords: ["entry", "layout", "columns", "skills"],
        localStyleKey: "entryLayout",
    },
    {
        id: "linkIcons",
        labelKey: "customize.linkIcon",
        icon: Link,
        group: "sections",
        order: 440,
        keywords: ["link", "icon", "url"],
        localStyleKey: "linkIcon",
    },
    {
        id: "repoBadge",
        labelKey: "customize.repoBadge",
        icon: FolderGit2,
        group: "sections",
        order: 450,
        keywords: ["repository", "github", "badge", "project", "visibility", "private", "public"],
        localStyleKey: "repoBadge",
        sectionBase: "projects",
    },
    {
        id: "languagesSection",
        labelKey: "customize.languagesSection",
        icon: Globe,
        group: "sections",
        order: 460,
        keywords: ["language", "proficiency", "columns"],
        localStyleKey: "languagesSection",
        sectionBase: "languages",
    },
    {
        id: "designOverlays",
        labelKey: "customize.designOverlays",
        icon: Palette,
        group: "advanced",
        order: 510,
        keywords: ["design", "overlay", "shape", "text", "image"],
    },
] as const satisfies readonly CustomizeSectionDefinition[];

export type CustomizeSectionKey = (typeof CUSTOMIZE_SECTIONS)[number]["id"];

export const CUSTOMIZE_SECTION_ORDER = CUSTOMIZE_SECTIONS.map(
    (section) => section.id,
) as CustomizeSectionKey[];

export const CUSTOMIZE_SECTION_BY_ID = Object.fromEntries(
    CUSTOMIZE_SECTIONS.map((section) => [section.id, section]),
) as unknown as Record<CustomizeSectionKey, CustomizeSectionDefinition>;

export function isCustomizeSectionKey(value: string): value is CustomizeSectionKey {
    return Object.hasOwn(CUSTOMIZE_SECTION_BY_ID, value);
}
