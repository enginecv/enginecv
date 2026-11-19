import { z } from "zod";
import { MAX_AUTHORING_TEXT_BYTES, repairJsonText } from "@/lib/agent/authoring/parse-text";
import type { Notice } from "@/lib/agent/authoring/notices";
import { LETTER_FORMAT, checkFormat, parseFormat } from "@/lib/workspace/format-version";
import type { DocReason } from "@/lib/workspace/types";
import {
    LETTER_LAYOUTS,
    PAPER_SIZES,
    designOverridesSchema,
    senderOverridesSchema,
    type LetterDocument,
} from "./schema";

/**
 * The letter as a file (`enginecv.letter/v1`): what an agent or a person can read and write. It is
 * derived from the stored letter, minus what lives only in the app (the frozen snapshot, caches,
 * timestamps, internal paragraph prompts). Omitted fields mean "unchanged" when a file is applied;
 * a present empty string means "cleared". Tokens stay as `{{token}}` text.
 */

export const LETTER_SCHEMA_URL = "https://enginecv.app/schema/letter/v1.json";

export const letterFileSchema = z.object({
    $schema: z.string().optional(),
    format: z.string().optional(),
    id: z.string().optional(),
    status: z.enum(["draft", "sent"]).optional(),
    cv: z.object({ id: z.string(), title: z.string().optional() }).nullable().optional(),
    standalone: z.boolean().optional(),
    title: z.string().optional(),
    language: z.string().optional(),
    layout: z.enum(LETTER_LAYOUTS).optional(),
    paper: z.enum(PAPER_SIZES).optional(),
    date: z.string().optional(),
    recipient: z.object({ name: z.string().optional(), address: z.string().optional() }).optional(),
    company: z.string().optional(),
    role: z.string().optional(),
    subject: z.string().optional(),
    salutation: z.string().optional(),
    paragraphs: z.array(z.string()).optional(),
    closing: z.string().optional(),
    sender: senderOverridesSchema.optional(),
    design: designOverridesSchema.optional(),
});

export type LetterFileContent = z.infer<typeof letterFileSchema>;

const KNOWN_KEYS = new Set(Object.keys(letterFileSchema.shape));

export interface LetterFileOptions {
    hideContact: boolean;
    /** Title of the linked CV, written beside its id as a hint for humans. */
    cvTitle?: string;
}

/** The file content for a letter, in the stable key order of `data-model.md`. */
export function toLetterFile(letter: LetterDocument, options: LetterFileOptions): LetterFileContent {
    const file: LetterFileContent = {
        $schema: LETTER_SCHEMA_URL,
        format: LETTER_FORMAT,
        id: letter.id,
        status: letter.status === "draft" ? "draft" : "sent",
        ...(letter.cvId ? { cv: { id: letter.cvId, ...(options.cvTitle ? { title: options.cvTitle } : {}) } } : {}),
        standalone: letter.standalone,
        ...(letter.title ? { title: letter.title } : {}),
        language: letter.language,
        layout: letter.layout,
        paper: letter.paperSize,
        date: letter.date,
        recipient: { name: letter.recipient.name, address: letter.recipient.address },
        company: letter.company,
        role: letter.role,
        subject: letter.subject,
        salutation: letter.salutation,
        paragraphs: letter.paragraphs.map((paragraph) => paragraph.markdown),
        closing: letter.closing,
    };
    const sender = Object.fromEntries(Object.entries(letter.senderOverrides).filter(([, value]) => value !== undefined));
    // Sender overrides are contact details: left out when the workspace keeps contact details out of its files.
    if (!options.hideContact && Object.keys(sender).length > 0) file.sender = sender;
    const design = Object.fromEntries(Object.entries(letter.designOverrides).filter(([, value]) => value !== undefined));
    if (Object.keys(design).length > 0) file.design = design;
    return file;
}

export function letterFileText(letter: LetterDocument, options: LetterFileOptions): string {
    return `${JSON.stringify(toLetterFile(letter, options), null, 2)}\n`;
}

export type LetterParseResult =
    | { ok: true; content: LetterFileContent; id: string | null; notices: Notice[] }
    | { ok: false; reason: DocReason };

/** Validates letter file text. Never throws; a bad file is `{ ok: false }` and changes nothing. */
export function parseLetterText(text: string): LetterParseResult {
    const repaired = repairJsonText(text, { maxBytes: MAX_AUTHORING_TEXT_BYTES });
    if (repaired.status === "blocked") {
        return { ok: false, reason: { code: repaired.error.code, line: repaired.error.line, column: repaired.error.column } };
    }
    const value = repaired.value;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, reason: { code: "no-document" } };
    const document = value as Record<string, unknown>;

    const format = checkFormat(document.format, parseFormat(LETTER_FORMAT)!);
    if (!format.ok) return { ok: false, reason: format.reason };
    if (Object.keys(document).filter((key) => key !== "format" && key !== "$schema").length === 0) return { ok: false, reason: { code: "no-document" } };

    const result = letterFileSchema.safeParse(document);
    if (!result.success) {
        const issue = result.error.issues[0];
        return { ok: false, reason: { code: "invalid-field", detail: issue.path.join(".") || "(document)" } };
    }

    const notices: Notice[] = [...repaired.notices];
    for (const key of Object.keys(document)) {
        if (!KNOWN_KEYS.has(key)) notices.push({ kind: "skipped", code: "unknown-field-skipped", path: key, params: { key } });
    }
    return { ok: true, content: result.data, id: result.data.id ?? null, notices };
}

/** The JSON Schema agents and editors read for letter files, served at /schema/letter/v1.json. */
export function buildLetterJsonSchema(): Record<string, unknown> {
    const generated = z.toJSONSchema(letterFileSchema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
    const { $schema, ...rest } = generated;
    return {
        $schema,
        $id: LETTER_SCHEMA_URL,
        title: "EngineCV letter format v1",
        description:
            "A cover letter as content only. Leave out any field you do not want to change; an empty string clears a field. "
            + "\"id\" and \"status\" belong to EngineCV and are never changed from the file. Keep {{tokens}} such as {{company}} as they are.",
        ...rest,
    };
}
