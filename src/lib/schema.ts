import { z } from "zod";
import { createId } from "./id";
import {
    DESIGN_FONT_WEIGHTS,
    DEFAULT_DESIGN_BORDER,
    DEFAULT_DESIGN_SETTINGS,
    DEFAULT_DESIGN_STYLE,
} from "./design";

// Shared common fields
const dateSchema = z.string().optional(); // E.g., "YYYY-MM" or "Present"
const externalLinkSchema = z.string().default("");

export const highlightSchema = z.string();

const photoPointSchema = z.object({
    x: z.number().default(0),
    y: z.number().default(0),
});

const photoAreaSchema = z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    width: z.number().default(0),
    height: z.number().default(0),
});

export const photoEditSchema = z.object({
    original: z.string().default(""),
    crop: photoPointSchema.default({ x: 0, y: 0 }),
    zoom: z.number().default(1),
    rotation: z.number().default(0),
    croppedAreaPixels: photoAreaSchema.default({ x: 0, y: 0, width: 0, height: 0 }),
}).nullable().default(null);

export const emailEntrySchema = z.object({
    id: z.string().default(() => createId()),
    email: z.string().email().or(z.literal("")).default(""),
    label: z.string().default(""),
});

export const basicsSchema = z.object({
    name: z.string().default(""),
    headline: z.string().default(""),
    photo: z.string().default(""),
    photoEdit: photoEditSchema,
    email: z.string().email().or(z.literal("")).default(""),
    emails: z.array(emailEntrySchema).default([]),
    phone: z.string().default(""),
    location: z.string().default(""),
    /**
     * Structured address kept for JSON Resume (feature 080). `location` stays
     * the display text; these parts are used on export only while `location`
     * still equals the text built from them.
     */
    locationParts: z.object({
        address: z.string().default(""),
        postalCode: z.string().default(""),
        city: z.string().default(""),
        region: z.string().default(""),
        countryCode: z.string().default(""),
    }).default({ address: "", postalCode: "", city: "", region: "", countryCode: "" }),
    website: externalLinkSchema,
    drivingLicense: z.string().default(""),
    linkedin: externalLinkSchema,
    github: externalLinkSchema,
    summary: z.string().default(""),

    // Optional personal details
    dateOfBirth: z.string().default(""),
    nationality: z.string().default(""),
    passportOrId: z.string().default(""),
    passport: z.string().default(""),
    nationalId: z.string().default(""),
    maritalStatus: z.string().default(""),
    militaryService: z.string().default(""),
    genderPronoun: z.string().default(""),
    disability: z.string().default(""),
    visa: z.string().default(""),
    height: z.string().default(""),
    detailsOrder: z.array(z.string()).default([]),

    // Custom social links
    customLinks: z.array(z.object({
        id: z.string().default(() => createId()),
        name: z.string().default(""),
        url: externalLinkSchema,
        label: z.string().default(""),  // display text (if empty, show name)
        icon: z.string().default("auto"),
    })).default([]),
});

export const metaSchema = z.object({
    title: z.string().default(""),
    description: z.string().default(""),
    tags: z.array(z.string()).default([]),
});

export const experienceSchema = z.object({
    id: z.string().default(() => createId()),
    hidden: z.boolean().default(false),
    company: z.string().default(""),
    position: z.string().default(""),
    start: dateSchema,
    end: dateSchema,
    location: z.string().default(""),
    description: z.string().default(""),
    highlights: z.array(highlightSchema).default([]),
    skills: z.array(z.string()).default([]),
    url: externalLinkSchema,
    urlIcon: z.string().default("auto"),
});

const educationSchema = z.object({
    id: z.string().default(() => createId()),
    hidden: z.boolean().default(false),
    institution: z.string().default(""),
    area: z.string().default(""),
    studyType: z.string().default(""), // E.g., "Bachelor", "Master"
    start: dateSchema,
    end: dateSchema,
    location: z.string().default(""),
    description: z.string().default(""),
    score: z.string().default(""),
    courses: z.array(z.string()).default([]),
    skills: z.array(z.string()).default([]),
    url: externalLinkSchema,
    urlIcon: z.string().default("auto"),
});

export const courseSchema = z.object({
    id: z.string().default(() => createId()),
    hidden: z.boolean().default(false),
    name: z.string().default(""),
    institution: z.string().default(""),
    start: dateSchema,
    end: dateSchema,
    location: z.string().default(""),
    description: z.string().default(""),
    skills: z.array(z.string()).default([]),
    url: externalLinkSchema,
    urlIcon: z.string().default("auto"),
});

export const projectRepoSchema = z.object({
    id: z.string().default(() => createId()),
    url: z.string().default(""),
    platform: z.string().default("auto"),
    label: z.string().default(""),
});

export const projectSchema = z.object({
    id: z.string().default(() => createId()),
    hidden: z.boolean().default(false),
    name: z.string().default(""),
    subtitle: z.string().default(""),
    description: z.string().default(""),
    highlights: z.array(highlightSchema).default([]),
    keywords: z.array(z.string()).default([]),
    skills: z.array(z.string()).default([]),
    start: dateSchema,
    end: dateSchema,
    url: externalLinkSchema,
    urlIcon: z.string().default("auto"),
    repos: z.array(projectRepoSchema).default([]),
    /** Optional icon before the project name; "" shows none. */
    icon: z.string().default(""),
    /** GitHub repository visibility; "" when unknown or not a GitHub project. */
    visibility: z.enum(["", "public", "private"]).catch(""),
});

export const organisationSchema = z.object({
    id: z.string().default(() => createId()),
    hidden: z.boolean().default(false),
    name: z.string().default(""),
    role: z.string().default(""),
    start: dateSchema,
    end: dateSchema,
    location: z.string().default(""),
    description: z.string().default(""),
    skills: z.array(z.string()).default([]),
    url: externalLinkSchema,
    urlIcon: z.string().default("auto"),
});

const certificateSchema = z.object({
    id: z.string().default(() => createId()),
    hidden: z.boolean().default(false),
    name: z.string().default(""),
    date: dateSchema,
    issuer: z.string().default(""),
    description: z.string().default(""),
    skills: z.array(z.string()).default([]),
    url: externalLinkSchema,
    urlIcon: z.string().default("auto"),
    issuerUrl: externalLinkSchema,
    issuerUrlIcon: z.string().default("auto"),
});

export const awardSchema = z.object({
    id: z.string().default(() => createId()),
    hidden: z.boolean().default(false),
    name: z.string().default(""),
    issuer: z.string().default(""),
    date: dateSchema,
    description: z.string().default(""),
    skills: z.array(z.string()).default([]),
    url: externalLinkSchema,
    urlIcon: z.string().default("auto"),
});

export const publicationSchema = z.object({
    id: z.string().default(() => createId()),
    hidden: z.boolean().default(false),
    name: z.string().default(""),
    publisher: z.string().default(""),
    date: dateSchema,
    description: z.string().default(""),
    skills: z.array(z.string()).default([]),
    url: externalLinkSchema,
    urlIcon: z.string().default("auto"),
});

export const referenceSchema = z.object({
    id: z.string().default(() => createId()),
    hidden: z.boolean().default(false),
    name: z.string().default(""),
    position: z.string().default(""),
    organisation: z.string().default(""),
    email: z.string().email().or(z.literal("")).default(""),
    phone: z.string().default(""),
    description: z.string().default(""),
    url: externalLinkSchema,
    urlIcon: z.string().default("auto"),
});

export const declarationSchema = z.object({
    id: z.string().default(() => createId()),
    hidden: z.boolean().default(false),
    text: z.string().default(""),
    signature: z.string().default(""), // data URL (drawn or uploaded image)
    fullName: z.string().default(""),
    place: z.string().default(""),
    date: z.string().default(""),
});

// A generic entry for user-defined ("custom") sections. Mirrors the fields the
// shared preview `renderEntry` consumes, so custom entries get the same layout,
// pagination, and skill-badge support as built-in sections.
export const customEntrySchema = z.object({
    id: z.string().default(() => createId()),
    hidden: z.boolean().default(false),
    title: z.string().default(""),
    subtitle: z.string().default(""),
    start: dateSchema,
    end: dateSchema,
    location: z.string().default(""),
    description: z.string().default(""),
    skills: z.array(z.string()).default([]),
    url: externalLinkSchema,
    urlIcon: z.string().default("auto"),
});

// A user-defined section. `layout` picks the presentation mode; only the field
// matching that mode is rendered (entries | text | tags). Keyed in section
// order/placement as `custom:<id>`, so multiple instances coexist.
export const customSectionSchema = z.object({
    id: z.string().default(() => createId()),
    hidden: z.boolean().default(false),
    title: z.string().default(""),
    icon: z.string().default("auto"),
    layout: z.enum(["entries", "text", "tags"]).default("entries"),
    text: z.string().default(""),
    tags: z.array(z.string()).default([]),
    entries: z.array(customEntrySchema).default([]),
});
export type CustomEntry = z.infer<typeof customEntrySchema>;
export type CustomSection = z.infer<typeof customSectionSchema>;

// Ordered skill proficiency levels (low -> high). Empty string means "no level".
export const SKILL_LEVELS = ["beginner", "amateur", "competent", "proficient", "expert"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

/** 1-based rank for a level (Beginner=1 .. Expert=5); 0 when unset/invalid. */
export function skillLevelRank(level: string): number {
    const i = SKILL_LEVELS.indexOf(level as SkillLevel);
    return i < 0 ? 0 : i + 1;
}

export const skillSchema = z.object({
    id: z.string().default(() => createId()),
    hidden: z.boolean().default(false),
    name: z.string().default(""),
    description: z.string().default(""),
    // "" | "beginner" | "amateur" | "competent" | "proficient" | "expert"
    level: z.string().default(""),
    icon: z.string().default("auto"),
    display: z.enum(["name", "icon", "both"]).default("both"),
    keywords: z.array(z.string()).default([]),
});

/**
 * Fixed id of the untitled "Non-group": always the first group, cannot be
 * deleted or renamed. Named groups follow it in user-defined order.
 */
export const UNGROUPED_SKILL_GROUP_ID = "ungrouped";

export const skillGroupSchema = z.object({
    id: z.string().default(() => createId()),
    name: z.string().default(""),
    hidden: z.boolean().default(false),
    skills: z.array(skillSchema).default([]),
});

export function createUngroupedSkillGroup(skills: Skill[] = []): SkillGroup {
    return { id: UNGROUPED_SKILL_GROUP_ID, name: "", hidden: false, skills };
}

/** Flat view over every skill in every group, in render order. */
export function allSkills(groups: SkillGroup[]): Skill[] {
    return groups.flatMap((group) => group.skills);
}

/**
 * Restores the skill-group invariant: exactly one Non-group, pinned first.
 * Merges duplicates and creates the Non-group when missing.
 */
export function normalizeSkillGroups(groups: SkillGroup[]): SkillGroup[] {
    const ungroupedSkills: Skill[] = [];
    const named: SkillGroup[] = [];
    for (const group of groups) {
        if (group.id === UNGROUPED_SKILL_GROUP_ID) {
            ungroupedSkills.push(...group.skills);
        } else {
            named.push(group);
        }
    }
    return [createUngroupedSkillGroup(ungroupedSkills), ...named];
}

export function isNativeLanguageFluency(fluency: string): boolean {
    const normalized = fluency.trim().toLowerCase();
    return normalized === "native" || normalized.includes("native or bilingual");
}

const cefrLevelField = z.string().default("");

export const cefrSkillLevelsSchema = z.object({
    listening: cefrLevelField,
    reading: cefrLevelField,
    spokenInteraction: cefrLevelField,
    spokenProduction: cefrLevelField,
    writing: cefrLevelField,
});

export const languageSchema = z.object({
    id: z.string().default(() => createId()),
    hidden: z.boolean().default(false),
    language: z.string().default(""),
    // Overall level. In detailed mode it is kept equal to the grid's derived level.
    fluency: z.string().default(""),
    // Detailed mode: the CEFR self-assessment grid (see src/lib/cefr.ts).
    cefrDetailed: z.boolean().default(false),
    cefr: cefrSkillLevelsSchema.default({ listening: "", reading: "", spokenInteraction: "", spokenProduction: "", writing: "" }),
    assessmentType: z.enum(["none", "self", "issuer"]).default("none"),
    issuer: z.string().default(""),
    assessmentId: z.string().default(""),
    assessmentUrl: externalLinkSchema,
    description: z.string().default(""),
}).transform((language) => (
    isNativeLanguageFluency(language.fluency)
        ? {
            ...language,
            // A mother tongue is not self-assessed skill by skill.
            cefrDetailed: false,
            assessmentType: "none" as const,
            issuer: "",
            assessmentId: "",
            assessmentUrl: "",
        }
        : language
));

export const interestSchema = z.object({
    id: z.string().default(() => createId()),
    hidden: z.boolean().default(false),
    name: z.string().default(""),
    description: z.string().default(""),
});

const variantSchema = z.object({
    id: z.string().default(() => createId()),
    name: z.string().default(""),
    theme: z.string().default("modern"),
});

export const aiMessageSchema = z.object({
    id: z.string().default(() => createId()),
    role: z.enum(["user", "ai"]).default("user"),
    content: z.string().default(""),
    createdAt: z.number().default(() => Date.now()),
});

const aiCheckpointSchema = z.object({
    id: z.string().default(() => createId()),
    messageId: z.string().default(""),
    createdAt: z.number().default(() => Date.now()),
    resumeJson: z.string().default(""),
});

export const aiHistorySchema = z.object({
    messages: z.array(aiMessageSchema).default([]),
    checkpoints: z.array(aiCheckpointSchema).default([]),
}).default({
    messages: [],
    checkpoints: [],
});

export const jdKeywordSchema = z.object({
    term: z.string().default(""),
    weight: z.number().default(0),
    category: z.enum(["skill", "tool", "responsibility", "soft", "other"]).default("other"),
});

export const jobContextSchema = z.object({
    company: z.string().default(""),
    role: z.string().default(""),
    location: z.string().default(""),
    url: externalLinkSchema,
    jdText: z.string().default(""),
    analysis: z.object({
        keywords: z.array(jdKeywordSchema).default([]),
        extractedAt: z.number().default(0),
    }).default({ keywords: [], extractedAt: 0 }),
}).nullable().default(null);

export const coverLetterSchema = z.object({
    id: z.string().default(() => createId()),
    createdAt: z.number().default(() => Date.now()),
    body: z.string().default(""),
    tone: z.string().default("professional"),
    length: z.string().default("medium"),
    jobContextSnapshot: jobContextSchema,
});

const defaultBoxBorder = {
    style: "solid" as const,
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

const boxBorderSchema = z.object({
    style: z.enum(["solid", "dotted", "dashed"]).default("solid"),
    width: z.number().default(0),
    color: z.string().default(""),
    radius: z.number().default(0),
    top: z.boolean().default(false),
    bottom: z.boolean().default(false),
    left: z.boolean().default(false),
    right: z.boolean().default(false),
    dashLength: z.number().default(6),
    dashGap: z.number().default(4),
}).default(defaultBoxBorder);

const defaultPhotoFilter = {
    preset: "natural",
    brightness: 100,
    contrast: 100,
    saturate: 100,
    grayscale: 0,
    sepia: 0,
    hueRotate: 0,
    blur: 0,
};

const photoFilterSchema = z.object({
    preset: z.string().default("natural"),
    brightness: z.number().default(100),
    contrast: z.number().default(100),
    saturate: z.number().default(100),
    grayscale: z.number().default(0),
    sepia: z.number().default(0),
    hueRotate: z.number().default(0),
    blur: z.number().default(0),
}).default(defaultPhotoFilter);

const defaultPhotoFrameBorder = {
    ...defaultBoxBorder,
    width: 1,
    radius: 18,
    top: true,
    bottom: true,
    left: true,
    right: true,
};

const defaultPersonalDetailsBorder = {
    ...defaultBoxBorder,
};

const defaultPersonalPhotoSettings = {
    width: 96,
    height: 96,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    border: defaultPhotoFrameBorder,
    filter: defaultPhotoFilter,
};

const designBorderSchema = z.object({
    style: z.enum(["solid", "dotted", "dashed"]).default("solid"),
    width: z.number().default(0),
    color: z.string().default(""),
    radius: z.number().default(0),
    top: z.boolean().default(false),
    bottom: z.boolean().default(false),
    left: z.boolean().default(false),
    right: z.boolean().default(false),
    dashLength: z.number().default(6),
    dashGap: z.number().default(4),
}).default(DEFAULT_DESIGN_BORDER);

const designElementStyleSchema = z.object({
    opacity: z.number().default(100),
    color: z.string().default("#111827"),
    backgroundColor: z.string().default(""),
    fillMode: z.enum(["solid", "gradient"]).default("solid"),
    gradientFrom: z.string().default("#ffaa8d"),
    gradientTo: z.string().default("#fff8f6"),
    gradientAngle: z.number().default(135),
    fontFamily: z.string().default(""),
    fontSize: z.number().default(18),
    fontWeight: z.enum(DESIGN_FONT_WEIGHTS).default("700"),
    fontStyle: z.enum(["normal", "italic"]).default("normal"),
    textDecoration: z.enum(["none", "underline", "line-through"]).default("none"),
    textTransform: z.enum(["none", "uppercase", "capitalize", "lowercase"]).default("none"),
    lineHeight: z.number().default(1.2),
    letterSpacing: z.number().default(0),
    textAlign: z.enum(["left", "center", "right"]).default("left"),
    objectFit: z.enum(["cover", "contain", "fill"]).default("cover"),
    paddingTop: z.number().default(0),
    paddingBottom: z.number().default(0),
    paddingLeft: z.number().default(0),
    paddingRight: z.number().default(0),
    marginTop: z.number().default(0),
    marginBottom: z.number().default(0),
    marginLeft: z.number().default(0),
    marginRight: z.number().default(0),
    border: designBorderSchema.default(DEFAULT_DESIGN_BORDER),
}).default(DEFAULT_DESIGN_STYLE);

const designElementSchema = z.object({
    id: z.string().default(() => createId()),
    type: z.enum(["text", "shape", "image", "block", "gradient"]).default("text"),
    placement: z.enum(["overlay"]).default("overlay"),
    pageIndex: z.number().int().default(0),
    x: z.number().default(48),
    y: z.number().default(48),
    width: z.number().default(220),
    height: z.number().default(120),
    zIndex: z.number().int().default(1),
    text: z.string().default(""),
    imageSrc: z.string().default(""),
    shape: z.enum(["rectangle", "ellipse"]).default("rectangle"),
    style: designElementStyleSchema.default(DEFAULT_DESIGN_STYLE),
});

const designSettingsSchema = z.object({
    elements: z.array(designElementSchema).default([]),
}).default(DEFAULT_DESIGN_SETTINGS);

export const settingsSchema = z.object({
    theme: z.string().default("modern"),
    language: z.string().default("en"),
    dateFormat: z.string().default("DD/MM/YYYY"),
    measurementSystem: z.enum(["metric", "imperial"]).default("metric"),
    nationalityDisplay: z.enum(["hide", "flag", "code", "name", "flagCode", "both"]).default("both"),
    nationalityNameStyle: z.enum(["country", "nationality"]).default("country"),
    licenseDisplay: z.enum(["hide", "flag", "code", "name", "flagCode", "both"]).default("both"),
    passportDisplay: z.enum(["hide", "flag", "code", "name", "flagCode", "both"]).default("both"),
    nationalIdDisplay: z.enum(["hide", "flag", "code", "name", "flagCode", "both"]).default("both"),
    phoneDisplay: z.enum(["hide", "flag", "code", "name", "flagCode", "both"]).default("both"),
    visaDisplay: z.enum(["hide", "flag", "code", "name", "flagCode", "both"]).default("both"),
    militaryServiceDisplay: z.enum(["hide", "flag", "code", "name", "flagCode", "both"]).default("both"),
    contentSections: z.array(z.string()).default([]),
    // Content-section keys (same vocabulary as contentSections) hidden from the
    // preview and visual exports; the data itself stays intact.
    hiddenSections: z.array(z.string()).default([]),
    sectionDisplay: z.record(z.string(), z.object({
        title: z.string().optional(),
        icon: z.string().optional(),
        showIcon: z.boolean().optional(),
        languageLayout: z.enum(["list", "table", "cefr"]).optional(),
    })).default({}),

    // Layout
    layout: z.object({
        columns: z.enum(["one", "two", "mix"]).default("one"),
        headerPosition: z.enum(["top", "left", "right"]).default("top"),
        leftColumnWidth: z.number().default(50),
        sectionPlacement: z.record(z.string(), z.enum(["left", "right", "full"])).default({}),
        sectionOrder: z.array(z.string()).default([
            "experience", "education", "certificates", "projects", "skills", "languages"
        ]),
    }).default({
        columns: "one",
        headerPosition: "top",
        leftColumnWidth: 50,
        sectionPlacement: {},
        sectionOrder: ["experience", "education", "certificates", "projects", "skills", "languages"]
    }),

    // Typography
    typography: z.object({
        fontFamily: z.string().default("Inter"),
        fontUrl: z.string().optional(),
        fontSize: z.number().default(10), // in pt
        lineHeight: z.number().default(1.35),
        // Global font roles (act like --font-* CSS variables). secondary is the
        // body font (mirrors fontFamily); primary/mono fall back to it when empty.
        fonts: z.object({
            primary: z.string().default(""),
            secondary: z.string().default(""),
            mono: z.string().default(""),
        }).default({ primary: "", secondary: "", mono: "" }),
    }).default({ fontFamily: "Inter", fontSize: 10, lineHeight: 1.35, fonts: { primary: "", secondary: "", mono: "" } }),

    // Spacing
    spacing: z.object({
        marginH: z.number().default(20), // mm
        marginV: z.number().default(18), // mm
        itemSpacing: z.number().default(10), // space between entries
    }).default({ marginH: 20, marginV: 18, itemSpacing: 10 }),

    // Colors
    colors: z.object({
        variant: z.enum(['basic', 'advanced', 'border']).default('basic'),
        accent: z.string().default("#ffaa8d"),
        text: z.string().default("#111827"),
        background: z.string().default("#fff8f6"),
        applyTo: z.array(z.string()).default([
            "headingsLine", "dotsBarsBubbles"
        ]),
        // How tech/brand skill logos are coloured: "mono" inherits the resume
        // accent, "brand" uses each icon's brand/preferred colour, and
        // "custom" uses the user-selected colour below.
        skillIconColor: z.enum(["mono", "brand", "custom"]).default("mono"),
        skillIconCustomColor: z.string().default("#ffaa8d"),
    }).default({
        variant: "basic",
        accent: "#ffaa8d",
        text: "#111827",
        background: "#fff8f6",
        applyTo: ["headingsLine", "dotsBarsBubbles"],
        skillIconColor: "mono",
        skillIconCustomColor: "#ffaa8d",
    }),

    // Shared font weight values
    // Supports numeric weights + legacy named weights for backward compatibility.
    // UI can use numeric values while old resumes still parse safely.
    // Note: keep as enum for strict JSON validation.

    // Section Headings
    headings: z.object({
        fontFamily: z.string().default(""),
        fontUrl: z.string().optional(),
        fontSize: z.number().default(14),
        fontWeight: z.enum(DESIGN_FONT_WEIGHTS).default("700"),
        fontStyle: z.enum(["normal", "italic"]).default("normal"),
        textDecoration: z.enum(["none", "underline", "line-through"]).default("none"),
        style: z.string().default("baseline"),
        capitalization: z.enum(["capitalize", "uppercase"]).default("uppercase"),
        textAlign: z.enum(["left", "center", "right"]).default("left"),
        letterSpacing: z.number().default(0),
        lineHeight: z.number().default(1.15),
        paddingTop: z.number().default(0),
        paddingBottom: z.number().default(6),
        paddingLeft: z.number().default(0),
        paddingRight: z.number().default(0),
        marginTop: z.number().default(0),
        marginBottom: z.number().default(16),
        marginLeft: z.number().default(0),
        marginRight: z.number().default(0),
        border: boxBorderSchema.default({
            ...defaultBoxBorder,
            width: 2,
            bottom: true,
        }),
        backgroundColor: z.string().default(""),
        borderColor: z.string().default(""),
        preset: z.string().default("baseline"),
    }).default({
        fontFamily: "",
        fontSize: 14,
        fontWeight: "700",
        fontStyle: "normal",
        textDecoration: "none",
        style: "baseline",
        capitalization: "uppercase",
        textAlign: "left",
        letterSpacing: 0,
        lineHeight: 1.15,
        paddingTop: 0,
        paddingBottom: 6,
        paddingLeft: 0,
        paddingRight: 0,
        marginTop: 0,
        marginBottom: 16,
        marginLeft: 0,
        marginRight: 0,
        border: {
            style: "solid",
            width: 2,
            color: "",
            radius: 0,
            top: false,
            bottom: true,
            left: false,
            right: false,
            dashLength: 6,
            dashGap: 4,
        },
        backgroundColor: "",
        borderColor: "",
        preset: "baseline",
    }),

    // Section Content
    contentStyle: z.object({
        paddingTop: z.number().default(0),
        paddingBottom: z.number().default(0),
        paddingLeft: z.number().default(0),
        paddingRight: z.number().default(0),
        marginTop: z.number().default(0),
        marginBottom: z.number().default(0),
        marginLeft: z.number().default(0),
        marginRight: z.number().default(0),
        border: boxBorderSchema,
        backgroundColor: z.string().default(""),
        preset: z.string().default("plain"),
    }).default({
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
        border: defaultBoxBorder,
        backgroundColor: "",
        preset: "plain",
    }),

    // Header (name / title) typography
    header: z.object({
        fontFamily: z.string().default(""),       // empty = inherit from main typography
        fontSize: z.number().default(36),          // stored in px; UI exposes pt
        fontWeight: z.enum(DESIGN_FONT_WEIGHTS).default("700"),
        fontStyle: z.enum(["normal", "italic"]).default("normal"),
        textDecoration: z.enum(["none", "underline", "line-through"]).default("none"),
        textTransform: z.enum(["none", "uppercase", "capitalize", "lowercase"]).default("none"),
    }).default({
        fontFamily: "",
        fontSize: 36,
        fontWeight: "700",
        fontStyle: "normal",
        textDecoration: "none",
        textTransform: "none",
    }),

    // Shared custom fonts pool (imported Google Fonts available to all sections)
    customFonts: z.array(z.object({
        name: z.string(),
        url: z.string(),
    })).default([]),

    // Link icon indicator (next to clickable entry subtitles). Defaults to after
    // the name, so the name reads first and the marker isn't clutter.
    linkIcon: z.object({
        side: z.enum(["left", "right"]).default("right"),
        size: z.number().default(0.85),  // em units relative to text
        align: z.enum(["top", "center", "bottom", "baseline"]).default("baseline"),
    }).default({ side: "right", size: 0.85, align: "baseline" }),

    // Header contact icons (email, phone, etc.)
    headerIcon: z.object({
        // "hidden": the contact type icon already shows the item; the extra link marker is opt-in.
        side: z.enum(["left", "right", "hidden"]).default("hidden"),
        size: z.number().default(0.85),  // em units relative to text
        align: z.enum(["top", "center", "bottom", "baseline"]).default("baseline"),
    }).default({ side: "hidden", size: 0.85, align: "baseline" }),

    // Personal Details
    personalDetails: z.object({
        alignment: z.enum(["left", "center", "right"]).default("left"),
        layout: z.enum(["imageLeft", "imageTop", "imageRight"]).default("imageRight"),
        detailsLayout: z.enum(["rows", "wrap", "twoColumns"]).default("wrap"),
        paddingTop: z.number().default(0),
        paddingBottom: z.number().default(0),
        paddingLeft: z.number().default(0),
        paddingRight: z.number().default(0),
        marginTop: z.number().default(0),
        marginBottom: z.number().default(0),
        marginLeft: z.number().default(0),
        marginRight: z.number().default(0),
        border: boxBorderSchema.default(defaultPersonalDetailsBorder),
        photo: z.object({
            width: z.number().default(96),
            height: z.number().default(96),
            paddingTop: z.number().default(0),
            paddingBottom: z.number().default(0),
            paddingLeft: z.number().default(0),
            paddingRight: z.number().default(0),
            marginTop: z.number().default(0),
            marginBottom: z.number().default(0),
            marginLeft: z.number().default(0),
            marginRight: z.number().default(0),
            border: boxBorderSchema.default(defaultPhotoFrameBorder),
            filter: photoFilterSchema,
        }).default(defaultPersonalPhotoSettings),
    }).default({
        alignment: "left",
        layout: "imageRight",
        detailsLayout: "wrap",
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
        border: defaultPersonalDetailsBorder,
        photo: defaultPersonalPhotoSettings,
    }),

    // Entry Layout
    entryLayout: z.object({
        layout: z.enum(["contentRight", "contentLeft", "threeCol", "singleCol"]).default("contentRight"),
        leftWidth: z.number().default(25),
        middleWidth: z.number().default(55),
        rightWidth: z.number().default(20),
        titleFontSize: z.number().default(11),
        subtitleFontSize: z.number().default(10),
        subtitleFontWeight: z.string().default("600"),
        subtitleFontStyle: z.enum(["normal", "italic"]).default("normal"),
        subtitleTextDecoration: z.enum(["none", "underline", "line-through"]).default("none"),
        subtitlePlacement: z.enum(["sameLine", "nextLine"]).default("nextLine"),
        indentBody: z.boolean().default(false),
        listStyle: z.enum(["bullet", "hyphen"]).default("bullet"),
        // Show each entry's "skills used" as badges (in addition to the Skills
        // section, not exclusive). Placement is relative to the entry body.
        showEntrySkills: z.boolean().default(false),
        entrySkillsPlacement: z.enum(["belowBody", "underSubtitle"]).default("belowBody"),
    }).default({
        layout: "contentRight",
        leftWidth: 25,
        middleWidth: 55,
        rightWidth: 20,
        titleFontSize: 11,
        subtitleFontSize: 10,
        subtitleFontWeight: "600",
        subtitleFontStyle: "normal",
        subtitleTextDecoration: "none",
        subtitlePlacement: "nextLine",
        indentBody: false,
        listStyle: "bullet",
        showEntrySkills: false,
        entrySkillsPlacement: "belowBody",
    }),

    // Languages Section (layout, spacing and sizing of the languages content section)
    languagesSection: z.object({
        // List layout: number of columns entries flow into (1 = single column list)
        columns: z.number().default(1),
        // Horizontal gap between columns in px (list layout with columns > 1)
        columnGap: z.number().default(16),
        // Vertical gap between entries in px; null inherits global spacing.itemSpacing
        itemSpacing: z.number().nullable().default(null),
        // How the fluency level renders next to the language name
        fluencyDisplay: z.enum(["badge", "text", "hidden"]).default("badge"),
        // Fluency label size in em relative to the entry text
        fluencySize: z.number().default(0.85),
        // List layout: fluency below the name or inline on the same line
        fluencyPlacement: z.enum(["nextLine", "sameLine"]).default("nextLine"),
        // Inline placement: which of name/fluency comes first
        fluencyOrder: z.enum(["languageFirst", "fluencyFirst"]).default("languageFirst"),
        // Text alignment for both list entries and table cells
        textAlign: z.enum(["left", "center", "right"]).default("left"),
        // Table layout: cell padding in px
        tableCellPaddingX: z.number().default(8),
        tableCellPaddingY: z.number().default(6),
    }).default({
        columns: 1,
        columnGap: 16,
        itemSpacing: null,
        fluencyDisplay: "badge",
        fluencySize: 0.85,
        fluencyPlacement: "nextLine",
        fluencyOrder: "languageFirst",
        textAlign: "left",
        tableCellPaddingX: 8,
        tableCellPaddingY: 6,
    }),

    // Repo Badge (per-project repository chips)
    repoBadge: z.object({
        fontFamily: z.string().default(""),
        fontSize: z.number().default(9),
        fontWeight: z.enum(DESIGN_FONT_WEIGHTS).default("600"),
        fontStyle: z.enum(["normal", "italic"]).default("normal"),
        textTransform: z.enum(["none", "uppercase", "capitalize", "lowercase"]).default("none"),
        letterSpacing: z.number().default(0),
        paddingX: z.number().default(8),
        paddingY: z.number().default(2),
        gap: z.number().default(6),
        marginTop: z.number().default(4),
        marginBottom: z.number().default(4),
        iconSize: z.number().default(0.85),
        colorMode: z.enum(["platform", "custom", "accent", "monochrome"]).default("platform"),
        textColor: z.string().default(""),
        backgroundColor: z.string().default(""),
        backgroundOpacity: z.number().default(0.1),
        borderColor: z.string().default(""),
        borderOpacity: z.number().default(0.33),
        border: boxBorderSchema.default({
            ...defaultBoxBorder,
            width: 1,
            radius: 999,
            top: true,
            bottom: true,
            left: true,
            right: true,
        }),
        showIcon: z.boolean().default(true),
        showPlatformName: z.boolean().default(false),
        showVisibility: z.boolean().default(false),
    }).default({
        fontFamily: "",
        fontSize: 9,
        fontWeight: "600",
        fontStyle: "normal",
        textTransform: "none",
        letterSpacing: 0,
        paddingX: 8,
        paddingY: 2,
        gap: 6,
        marginTop: 4,
        marginBottom: 4,
        iconSize: 0.85,
        colorMode: "platform",
        textColor: "",
        backgroundColor: "",
        backgroundOpacity: 0.1,
        borderColor: "",
        borderOpacity: 0.33,
        border: {
            style: "solid",
            width: 1,
            color: "",
            radius: 999,
            top: true,
            bottom: true,
            left: true,
            right: true,
            dashLength: 6,
            dashGap: 4,
        },
        showIcon: true,
        showPlatformName: false,
        showVisibility: false,
    }),

    // Footer
    footer: z.object({
        show: z.boolean().default(false),
        showName: z.boolean().default(false),
        showPhone: z.boolean().default(false),
        showEmail: z.boolean().default(false),
        showPageNumbers: z.boolean().default(false),
        left: z.string().default(""),
        middle: z.string().default(""),
        right: z.string().default(""),
        heightLines: z.number().default(1),
    }).default({
        show: false,
        showName: false,
        showPhone: false,
        showEmail: false,
        showPageNumbers: false,
        left: "",
        middle: "",
        right: "",
        heightLines: 1,
    }),

    design: designSettingsSchema,

    // AI Chat preferences (persisted per resume)
    ai: z.object({
        mode: z.enum(["auto", "plan", "content", "customization"]).default("auto"),
        provider: z.enum(["local", "chrome-ai", "ollama", "openrouter", "openai", "groq", "gemini", "anthropic"]).default("local"),
        localModel: z.string().default("Xenova/TinyLlama-1.1B-Chat-v1.0"),
        model: z.string().default(""),
    }).default({
        mode: "auto",
        provider: "local",
        localModel: "Xenova/TinyLlama-1.1B-Chat-v1.0",
        model: "",
    })
});

export type ResumeSettings = z.infer<typeof settingsSchema>;

export type DeepPartial<T> = T extends readonly unknown[]
    ? T
    : T extends object
        ? { [K in keyof T]?: DeepPartial<T[K]> }
        : T;

export const SECTION_STYLE_KEYS = [
    "headings",
    "contentStyle",
    "entryLayout",
    "repoBadge",
    "languagesSection",
    "linkIcon",
] as const;

export type SectionStyleKey = (typeof SECTION_STYLE_KEYS)[number];
export type SectionStyleOverride = {
    [K in SectionStyleKey]?: DeepPartial<ResumeSettings[K]>;
};

function isSectionStyleOverride(value: unknown): value is SectionStyleOverride {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Object.keys(value).every((key) =>
        (SECTION_STYLE_KEYS as readonly string[]).includes(key)
    );
}

export const customizationSchema = z.object({
    version: z.literal(2).default(2),
    sectionOverrides: z.record(
        z.string(),
        z.custom<SectionStyleOverride>(isSectionStyleOverride),
    ).default({}),
}).default({
    version: 2,
    sectionOverrides: {},
});

/**
 * Pre-parse migration for documents saved before skill groups existed:
 * a flat `skills` array (optionally carrying the short-lived per-skill
 * `group` label) becomes the equivalent `skillGroups` structure.
 */
function migrateLegacySkills(data: unknown): unknown {
    if (!data || typeof data !== "object" || Array.isArray(data)) return data;
    const record = data as Record<string, unknown>;
    if (!Array.isArray(record.skills) || record.skillGroups !== undefined) return data;

    const { skills, ...rest } = record;
    const ungrouped: unknown[] = [];
    const named: { id: string; name: string; hidden: boolean; skills: unknown[] }[] = [];
    const byKey = new Map<string, { skills: unknown[] }>();

    for (const entry of skills) {
        const label =
            entry && typeof entry === "object" && typeof (entry as { group?: unknown }).group === "string"
                ? ((entry as { group: string }).group).trim()
                : "";
        if (!label) {
            ungrouped.push(entry);
            continue;
        }
        const key = label.toLowerCase();
        let group = byKey.get(key);
        if (!group) {
            group = { skills: [] };
            byKey.set(key, group);
            named.push({ id: createId(), name: label, hidden: false, skills: group.skills });
        }
        group.skills.push(entry);
    }

    return {
        ...rest,
        skillGroups: [
            { id: UNGROUPED_SKILL_GROUP_ID, name: "", hidden: false, skills: ungrouped },
            ...named,
        ],
    };
}

function migrateLegacyEmails(data: unknown): unknown {
    if (!data || typeof data !== "object" || Array.isArray(data)) return data;
    const record = data as Record<string, unknown>;
    if (!record.basics || typeof record.basics !== "object" || Array.isArray(record.basics)) {
        return data;
    }

    const basics = record.basics as Record<string, unknown>;
    const legacyEmail = typeof basics.email === "string" ? basics.email : "";
    if (Array.isArray(basics.emails)) {
        const firstStructuredEmail = basics.emails.find((entry) =>
            entry
            && typeof entry === "object"
            && typeof (entry as { email?: unknown }).email === "string"
            && Boolean((entry as { email: string }).email.trim())
        ) as { email?: string } | undefined;
        const structuredEmailIsValid = firstStructuredEmail?.email
            ? emailEntrySchema.shape.email.safeParse(firstStructuredEmail.email).success
            : false;

        const emails = !firstStructuredEmail && legacyEmail.trim()
            ? basics.emails.length > 0
                ? basics.emails.map((entry, index) => index === 0 && entry && typeof entry === "object"
                    ? { ...entry, email: legacyEmail }
                    : entry)
                : [{ id: createId(), email: legacyEmail, label: "" }]
            : basics.emails;

        return {
            ...record,
            basics: {
                ...basics,
                email: structuredEmailIsValid ? firstStructuredEmail?.email : legacyEmail,
                emails,
            },
        };
    }

    return {
        ...record,
        basics: {
            ...basics,
            emails: legacyEmail.trim()
                ? [{ id: createId(), email: legacyEmail, label: "" }]
                : [],
        },
    };
}

export const resumeObjectSchema = z.object({
    id: z.string().optional(), // Used in DB
    version: z.number().default(1),
    basics: basicsSchema.default({
        name: "",
        headline: "",
        photo: "",
        photoEdit: null,
        email: "",
        emails: [],
        phone: "",
        location: "",
        locationParts: { address: "", postalCode: "", city: "", region: "", countryCode: "" },
        website: "",
        drivingLicense: "",
        linkedin: "",
        github: "",
        summary: "",
        dateOfBirth: "",
        nationality: "",
        passportOrId: "",
        passport: "",
        nationalId: "",
        maritalStatus: "",
        militaryService: "",
        genderPronoun: "",
        disability: "",
        visa: "",
        height: "",
        detailsOrder: [],
        customLinks: [],
    }),
    meta: metaSchema.default({
        title: "",
        description: "",
        tags: [],
    }),
    skillGroups: z
        .array(skillGroupSchema)
        .default(() => [createUngroupedSkillGroup()])
        .transform(normalizeSkillGroups),
    experience: z.array(experienceSchema).default([]),
    education: z.array(educationSchema).default([]),
    courses: z.array(courseSchema).default([]),
    projects: z.array(projectSchema).default([]),
    organisations: z.array(organisationSchema).default([]),
    certificates: z.array(certificateSchema).default([]),
    awards: z.array(awardSchema).default([]),
    publications: z.array(publicationSchema).default([]),
    references: z.array(referenceSchema).default([]),
    declaration: z.array(declarationSchema).default([]),
    languages: z.array(languageSchema).default([]),
    interests: z.array(interestSchema).default([]),
    customSections: z.array(customSectionSchema).default([]),
    variants: z.array(variantSchema).default([]),
    aiHistory: aiHistorySchema,
    jobContext: jobContextSchema,
    coverLetters: z.array(coverLetterSchema).default([]),
    customization: customizationSchema,
    settings: settingsSchema.default({
        theme: "modern",
        language: "en",
        dateFormat: "DD/MM/YYYY",
        measurementSystem: "metric",
        nationalityDisplay: "both",
        nationalityNameStyle: "country",
        licenseDisplay: "both",
        passportDisplay: "both",
        nationalIdDisplay: "both",
        phoneDisplay: "both",
        visaDisplay: "both",
        militaryServiceDisplay: "both",
        contentSections: [],
        hiddenSections: [],
        sectionDisplay: {},
        layout: {
            columns: "one",
            headerPosition: "top",
            leftColumnWidth: 50,
            sectionPlacement: {},
            sectionOrder: ["experience", "education", "certificates", "projects", "skills", "languages"]
        },
        typography: { fontFamily: "Inter", fontSize: 10, lineHeight: 1.35, fonts: { primary: "", secondary: "", mono: "" } },
        spacing: { marginH: 20, marginV: 18, itemSpacing: 10 },
        colors: {
            variant: "basic",
            accent: "#ffaa8d",
            text: "#111827",
            background: "#fff8f6",
            applyTo: ["headingsLine", "dotsBarsBubbles"],
            skillIconColor: "mono",
            skillIconCustomColor: "#ffaa8d",
        },
        headings: {
            fontFamily: "",
            fontSize: 14,
            fontWeight: "700",
            fontStyle: "normal",
            textDecoration: "none",
            style: "baseline",
            capitalization: "uppercase",
            textAlign: "left",
            letterSpacing: 0,
            lineHeight: 1.15,
            paddingTop: 0,
            paddingBottom: 6,
            paddingLeft: 0,
            paddingRight: 0,
            marginTop: 0,
            marginBottom: 16,
            marginLeft: 0,
            marginRight: 0,
            border: {
                style: "solid",
                width: 2,
                color: "",
                radius: 0,
                top: false,
                bottom: true,
                left: false,
                right: false,
                dashLength: 6,
                dashGap: 4,
            },
            backgroundColor: "",
            borderColor: "",
            preset: "baseline",
        },
        contentStyle: {
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            border: defaultBoxBorder,
            backgroundColor: "",
            preset: "plain",
        },
        header: {
            fontFamily: "",
            fontSize: 36,
            fontWeight: "700",
            fontStyle: "normal",
            textDecoration: "none",
            textTransform: "none",
        },
        customFonts: [],
        linkIcon: { side: "right", size: 0.85, align: "baseline" },
        headerIcon: { side: "hidden", size: 0.85, align: "baseline" },
        personalDetails: {
            alignment: "left",
            layout: "imageRight",
            detailsLayout: "wrap",
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            border: defaultPersonalDetailsBorder,
            photo: defaultPersonalPhotoSettings,
        },
        entryLayout: {
            layout: "contentRight",
            leftWidth: 25,
            middleWidth: 55,
            rightWidth: 20,
            titleFontSize: 11,
            subtitleFontSize: 10,
            subtitleFontWeight: "600",
            subtitleFontStyle: "normal",
            subtitleTextDecoration: "none",
            subtitlePlacement: "nextLine",
            indentBody: false,
            listStyle: "bullet",
            showEntrySkills: false,
            entrySkillsPlacement: "belowBody",
        },
        languagesSection: {
            columns: 1,
            columnGap: 16,
            itemSpacing: null,
            fluencyDisplay: "badge",
            fluencySize: 0.85,
            fluencyPlacement: "nextLine",
            fluencyOrder: "languageFirst",
            textAlign: "left",
            tableCellPaddingX: 8,
            tableCellPaddingY: 6,
        },
        repoBadge: {
            fontFamily: "",
            fontSize: 9,
            fontWeight: "600",
            fontStyle: "normal",
            textTransform: "none",
            letterSpacing: 0,
            paddingX: 8,
            paddingY: 2,
            gap: 6,
            marginTop: 4,
            marginBottom: 4,
            iconSize: 0.85,
            colorMode: "platform",
            textColor: "",
            backgroundColor: "",
            backgroundOpacity: 0.1,
            borderColor: "",
            borderOpacity: 0.33,
            border: {
                style: "solid",
                width: 1,
                color: "",
                radius: 999,
                top: true,
                bottom: true,
                left: true,
                right: true,
                dashLength: 6,
                dashGap: 4,
            },
            showIcon: true,
            showPlatformName: false,
            showVisibility: false,
        },
        footer: {
            show: false,
            showName: false,
            showPhone: false,
            showEmail: false,
            showPageNumbers: false,
            left: "",
            middle: "",
            right: "",
            heightLines: 1,
        },
        design: DEFAULT_DESIGN_SETTINGS,
        ai: {
            mode: "auto",
            provider: "local",
            localModel: "Xenova/TinyLlama-1.1B-Chat-v1.0",
            model: "",
        }
    }),
    createdAt: z.number().default(() => Date.now()),
    updatedAt: z.number().default(() => Date.now()),
});

export const resumeSchema = z.preprocess(
    (data) => migrateLegacySkills(migrateLegacyEmails(data)),
    resumeObjectSchema,
);

export type Resume = z.infer<typeof resumeSchema>;
export type ResumeCustomization = z.infer<typeof customizationSchema>;
export type DesignSettings = z.infer<typeof designSettingsSchema>;
export type DesignElement = z.infer<typeof designElementSchema>;
export type DesignElementStyle = z.infer<typeof designElementStyleSchema>;
export type Basics = z.infer<typeof basicsSchema>;
export type EmailEntry = z.infer<typeof emailEntrySchema>;
export type Meta = z.infer<typeof metaSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Course = z.infer<typeof courseSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectRepo = z.infer<typeof projectRepoSchema>;
export type Organisation = z.infer<typeof organisationSchema>;
export type Certificate = z.infer<typeof certificateSchema>;
export type Award = z.infer<typeof awardSchema>;
export type Publication = z.infer<typeof publicationSchema>;
export type Reference = z.infer<typeof referenceSchema>;
export type Declaration = z.infer<typeof declarationSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
export type Language = z.infer<typeof languageSchema>;
export type Interest = z.infer<typeof interestSchema>;
export type Variant = z.infer<typeof variantSchema>;
export type AIMessage = z.infer<typeof aiMessageSchema>;
export type AICheckpoint = z.infer<typeof aiCheckpointSchema>;
export type JDKeyword = z.infer<typeof jdKeywordSchema>;
export type JobContext = NonNullable<z.infer<typeof jobContextSchema>>;
export type CoverLetter = z.infer<typeof coverLetterSchema>;

// Utility to create an empty default resume
export const createEmptyResume = (): Resume => {
    return resumeSchema.parse({});
};

// ---------------------------------------------------------------------------
// Clamp imported numeric settings to safe UI ranges
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

type ClampRule = [min: number, max: number];

const BORDER_BOUNDS: Record<string, ClampRule> = {
    width: [0, 6],
    radius: [0, 16],
    dashLength: [1, 24],
    dashGap: [1, 20],
};

function clampBorder(
    border: Record<string, unknown> | undefined,
    clamped: string[],
    path: string,
) {
    if (!border || typeof border !== "object") return;
    for (const [key, [min, max]] of Object.entries(BORDER_BOUNDS)) {
        const v = border[key];
        if (typeof v === "number") {
            const c = clamp(v, min, max);
            if (c !== v) {
                clamped.push(`${path}.${key}: ${v} → ${c}`);
                (border as Record<string, number>)[key] = c;
            }
        }
    }
}

function clampNum(
    obj: Record<string, unknown>,
    key: string,
    min: number,
    max: number,
    clamped: string[],
    path: string,
) {
    const v = obj[key];
    if (typeof v === "number") {
        const c = clamp(v, min, max);
        if (c !== v) {
            clamped.push(`${path}.${key}: ${v} → ${c}`);
            (obj as Record<string, number>)[key] = c;
        }
    }
}

function clampPaddingMargin(
    obj: Record<string, unknown>,
    max: number,
    clamped: string[],
    path: string,
) {
    for (const key of ["paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "marginTop", "marginBottom", "marginLeft", "marginRight"]) {
        clampNum(obj, key, 0, max, clamped, path);
    }
}

export function clampResumeSettings(resume: Resume): string[] {
    const clamped: string[] = [];
    const s = resume.settings;
    if (!s) return clamped;

    // Typography
    if (s.typography) {
        const t = s.typography as Record<string, unknown>;
        clampNum(t, "fontSize", 8, 16, clamped, "typography");
        clampNum(t, "lineHeight", 1, 2, clamped, "typography");
    }

    // Spacing
    if (s.spacing) {
        const sp = s.spacing as Record<string, unknown>;
        clampNum(sp, "marginH", 0, 50, clamped, "spacing");
        clampNum(sp, "marginV", 0, 50, clamped, "spacing");
        clampNum(sp, "itemSpacing", 0, 48, clamped, "spacing");
    }

    // Header
    if (s.header) {
        clampNum(s.header as Record<string, unknown>, "fontSize", 12, 54, clamped, "header");
    }

    // Headings
    if (s.headings) {
        const h = s.headings as Record<string, unknown>;
        clampNum(h, "fontSize", 8, 24, clamped, "headings");
        clampNum(h, "letterSpacing", 0, 8, clamped, "headings");
        clampNum(h, "lineHeight", 0.8, 2, clamped, "headings");
        clampPaddingMargin(h, 32, clamped, "headings");
        clampBorder(h.border as Record<string, unknown> | undefined, clamped, "headings.border");
    }

    // Content style
    if (s.contentStyle) {
        const cs = s.contentStyle as Record<string, unknown>;
        clampPaddingMargin(cs, 24, clamped, "contentStyle");
        clampBorder(cs.border as Record<string, unknown> | undefined, clamped, "contentStyle.border");
    }

    // Personal details
    if (s.personalDetails) {
        const pd = s.personalDetails as Record<string, unknown>;
        clampPaddingMargin(pd, 24, clamped, "personalDetails");
        clampBorder(pd.border as Record<string, unknown> | undefined, clamped, "personalDetails.border");

        // Photo
        const photo = pd.photo as Record<string, unknown> | undefined;
        if (photo && typeof photo === "object") {
            clampNum(photo, "width", 48, 220, clamped, "photo");
            clampNum(photo, "height", 48, 220, clamped, "photo");
            clampPaddingMargin(photo, 24, clamped, "photo");
            clampBorder(photo.border as Record<string, unknown> | undefined, clamped, "photo.border");

            const filter = photo.filter as Record<string, unknown> | undefined;
            if (filter && typeof filter === "object") {
                clampNum(filter, "brightness", 50, 150, clamped, "photo.filter");
                clampNum(filter, "contrast", 50, 160, clamped, "photo.filter");
                clampNum(filter, "saturate", 0, 180, clamped, "photo.filter");
                clampNum(filter, "hueRotate", -180, 180, clamped, "photo.filter");
                clampNum(filter, "grayscale", 0, 100, clamped, "photo.filter");
                clampNum(filter, "sepia", 0, 100, clamped, "photo.filter");
                clampNum(filter, "blur", 0, 4, clamped, "photo.filter");
            }
        }
    }

    // Entry layout
    if (s.entryLayout) {
        const el = s.entryLayout as Record<string, unknown>;
        clampNum(el, "leftWidth", 10, 90, clamped, "entryLayout");
        clampNum(el, "titleFontSize", 8, 16, clamped, "entryLayout");
        clampNum(el, "subtitleFontSize", 8, 16, clamped, "entryLayout");
    }

    // Footer
    if (s.footer) {
        const f = s.footer as Record<string, unknown>;
        clampNum(f, "heightLines", 1, 5, clamped, "footer");
    }

    // Design overlays
    const design = (s as Record<string, unknown>).design as Record<string, unknown> | undefined;
    const designElements = Array.isArray(design?.elements) ? design?.elements : [];
    designElements.forEach((element, index) => {
        if (!element || typeof element !== "object") return;
        const el = element as Record<string, unknown>;
        clampNum(el, "pageIndex", 0, 24, clamped, `design.elements[${index}]`);
        clampNum(el, "x", 0, 1200, clamped, `design.elements[${index}]`);
        clampNum(el, "y", 0, 1600, clamped, `design.elements[${index}]`);
        clampNum(el, "width", 24, 1200, clamped, `design.elements[${index}]`);
        clampNum(el, "height", 24, 1600, clamped, `design.elements[${index}]`);
        clampNum(el, "zIndex", 1, 500, clamped, `design.elements[${index}]`);

        const style = el.style as Record<string, unknown> | undefined;
        if (!style || typeof style !== "object") return;

        clampNum(style, "opacity", 0, 100, clamped, `design.elements[${index}].style`);
        clampNum(style, "gradientAngle", 0, 360, clamped, `design.elements[${index}].style`);
        clampNum(style, "fontSize", 8, 72, clamped, `design.elements[${index}].style`);
        clampNum(style, "lineHeight", 0.8, 3, clamped, `design.elements[${index}].style`);
        clampNum(style, "letterSpacing", -2, 16, clamped, `design.elements[${index}].style`);
        clampPaddingMargin(style, 80, clamped, `design.elements[${index}].style`);
        clampBorder(style.border as Record<string, unknown> | undefined, clamped, `design.elements[${index}].style.border`);
    });

    // Link / header icon size
    if (s.linkIcon) {
        clampNum(s.linkIcon as Record<string, unknown>, "size", 0.5, 1.5, clamped, "linkIcon");
    }
    if (s.headerIcon) {
        clampNum(s.headerIcon as Record<string, unknown>, "size", 0.5, 1.5, clamped, "headerIcon");
    }

    // Layout column width
    if (s.layout) {
        clampNum(s.layout as Record<string, unknown>, "leftColumnWidth", 20, 80, clamped, "layout");
    }

    return clamped;
}
