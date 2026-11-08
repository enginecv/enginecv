import { z } from "zod";
import { createId } from "../id";
import { settingsSchema, type Resume } from "../schema";

export const TEMPLATE_DOCUMENT_VERSION = 1;

export const templateMetaSchema = z.object({
    name: z.string().default("Untitled template"),
    description: z.string().default(""),
    tags: z.array(z.string()).default([]),
    source: z.enum(["enginecv", "user"]).default("user"),
    basedOnTemplateId: z.string().optional(),
});

export const templatePaperSizeSchema = z.enum(["a4", "letter"]);

export const templateDocumentSchema = z.object({
    kind: z.literal("template").default("template"),
    id: z.string().default(() => createId()),
    version: z.number().int().default(TEMPLATE_DOCUMENT_VERSION),
    meta: templateMetaSchema.default({
        name: "Untitled template",
        description: "",
        tags: [],
        source: "user",
    }),
    settings: settingsSchema,
    paperSize: templatePaperSizeSchema.default("a4"),
    createdAt: z.number().default(() => Date.now()),
    updatedAt: z.number().default(() => Date.now()),
});

export type TemplateMeta = z.infer<typeof templateMetaSchema>;
export type TemplatePaperSize = z.infer<typeof templatePaperSizeSchema>;
export type TemplateDocument = z.infer<typeof templateDocumentSchema>;
export type TemplateSettings = Resume["settings"];

export function createEmptyTemplate(settings: TemplateSettings, paperSize: TemplatePaperSize = "a4"): TemplateDocument {
    const now = Date.now();
    return {
        kind: "template",
        id: createId(),
        version: TEMPLATE_DOCUMENT_VERSION,
        meta: {
            name: "Untitled template",
            description: "",
            tags: [],
            source: "user",
        },
        settings,
        paperSize,
        createdAt: now,
        updatedAt: now,
    };
}
