import { z } from "zod";
import { EXPORT_FORMAT_IDS } from "../export-formats";

export const CLIENT_PREFERENCES_KIND = "enginecv.preferences" as const;
export const CLIENT_PREFERENCES_VERSION = 1 as const;

export const themePreferenceSchema = z.enum(["light", "dark", "system"]);
export const localePreferenceSchema = z.enum(["en", "bs", "de", "fr", "es"]);
export const dashboardTabSchema = z.enum(["resumes", "letters", "templates"]);
export const dashboardDensitySchema = z.enum(["large", "normal", "compact"]);
export const dashboardSortSchema = z.enum(["updated", "created", "name-asc", "name-desc"]);
export const dashboardPageSizeSchema = z.enum(["12", "24", "48", "all"]);
export const commandPaletteWidthSchema = z.enum(["compact", "standard", "wide"]);
export const commandPaletteHeightSchema = z.enum(["compact", "standard", "tall"]);
export const resumeExportFormatSchema = z.enum(EXPORT_FORMAT_IDS);

const uniqueStrings = z.array(z.string()).transform((values) => [...new Set(values)]);
const editorPreferencesSchema = z.object({
    jsonEditor: z.object({
        vim: z.boolean().default(false),
        hideInternal: z.boolean().default(true),
        // "live" pushes every valid edit to the CV; "save" waits for Apply / Ctrl+S / :w.
        applyMode: z.enum(["save", "live"]).default("save"),
    }).prefault({}),
    autoSave: z.boolean().default(true),
    rightPanelVisible: z.boolean().default(false),
    // Accepted only to migrate preferences saved before AI chat was removed.
    rightPanelTab: z.enum(["ai", "history"]).default("history"),
}).transform(({ rightPanelTab, ...preferences }) => ({
    ...preferences,
    rightPanelVisible: rightPanelTab === "ai" ? false : preferences.rightPanelVisible,
}));

export const clientPreferencesSchema = z.object({
    appearance: z.object({
        theme: themePreferenceSchema.default("system"),
        locale: localePreferenceSchema.default("en"),
    }).default({ theme: "system", locale: "en" }),
    dashboard: z.object({
        activeTab: dashboardTabSchema.default("resumes"),
        density: dashboardDensitySchema.default("normal"),
        resumeSort: dashboardSortSchema.catch("updated"),
        templateSort: dashboardSortSchema.catch("updated"),
        pageSize: dashboardPageSizeSchema.catch("24"),
    }).default({ activeTab: "resumes", density: "normal", resumeSort: "updated", templateSort: "updated", pageSize: "24" }),
    editor: editorPreferencesSchema.prefault({
        autoSave: true,
        rightPanelVisible: false,
        rightPanelTab: "history",
    }),
    preview: z.object({
        zoom: z.number().min(0.5).max(3).default(1),
    }).default({ zoom: 1 }),
    commandPalette: z.object({
        width: commandPaletteWidthSchema.default("standard"),
        height: commandPaletteHeightSchema.default("standard"),
        pinnedCommandIds: uniqueStrings.default([]),
        recentCommandIds: uniqueStrings.default([]),
    }).default({
        width: "standard",
        height: "standard",
        pinnedCommandIds: [],
        recentCommandIds: [],
    }),
    export: z.object({
        // Unknown ids (a format removed or renamed later) fall back instead of
        // invalidating every other stored preference.
        format: resumeExportFormatSchema.catch("pdf"),
        pdfIncludeSidecar: z.boolean().default(false),
        docxIncludePhoto: z.boolean().default(false),
    }).default({ format: "pdf", pdfIncludeSidecar: false, docxIncludePhoto: false }),
    support: z.object({
        successfulExportCount: z.number().int().min(0).catch(0).default(0),
        exportPromptDismissed: z.boolean().default(false),
    }).default({ successfulExportCount: 0, exportPromptDismissed: false }),
    onboarding: z.object({
        // The export dialog explains the print dialog until the first PDF export.
        printTipSeen: z.boolean().catch(false).default(false),
    }).default({ printTipSeen: false }),
});

export const clientPreferencesEnvelopeSchema = z.object({
    kind: z.literal(CLIENT_PREFERENCES_KIND),
    schemaVersion: z.literal(CLIENT_PREFERENCES_VERSION),
    exportedAt: z.string().datetime().optional(),
    // When this browser last saved them. Missing on preferences saved before 076.
    updatedAt: z.string().datetime().optional(),
    preferences: clientPreferencesSchema,
});

export type ClientPreferences = z.infer<typeof clientPreferencesSchema>;
export type ClientPreferencesEnvelope = z.infer<typeof clientPreferencesEnvelopeSchema>;
export type CommandPaletteWidth = z.infer<typeof commandPaletteWidthSchema>;
export type CommandPaletteHeight = z.infer<typeof commandPaletteHeightSchema>;

export const DEFAULT_CLIENT_PREFERENCES: ClientPreferences = clientPreferencesSchema.parse({});
