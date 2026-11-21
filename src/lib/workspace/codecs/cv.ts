import { authoringToResume, parseAuthoringText, resumeToAuthoring, serializeAuthoring } from "@/lib/agent/authoring";
import type { Notice } from "@/lib/agent/authoring/notices";
import { applyContent, countEntries, describeContentChange } from "@/lib/workspace/apply-content";
import type { Resume } from "@/lib/schema";
import type { DocumentCodec, ParseOutcome } from "./types";

/**
 * How a CV is read from and written to a workspace file. Parsing and conversion are the authoring
 * format's own (`parseAuthoringText`, `authoringToResume`), applying is `applyContent` (design, photo
 * and signature stay), and writing is `resumeToAuthoring` plus a document id.
 */

/** Contact and personal fields the "leave contact details out" option keeps out of files. */
export const HIDDEN_BASICS_KEYS = [
    "email",
    "emails",
    "phone",
    "location",
    "locationParts",
    "website",
    "linkedin",
    "github",
    "customLinks",
    "dateOfBirth",
    "passport",
    "passportOrId",
    "nationalId",
    "maritalStatus",
    "militaryService",
    "genderPronoun",
    "disability",
    "visa",
    "height",
] as const;

/** The same fields under the names the authoring format uses in the file. */
const HIDDEN_FILE_KEYS = ["email", "phone", "location", "website", "linkedin", "github", "links", "dateOfBirth", "passport", "nationalId", "maritalStatus", "militaryService", "genderPronoun", "disability", "visa", "height"];

export interface CvCodecOptions {
    /** Write the document id into the file (workspace files do; the old per-CV link does not). */
    includeId?: boolean;
}

type Obj = Record<string, unknown>;

export function createCvCodec(options: CvCodecOptions = {}): DocumentCodec<Resume> {
    const includeId = options.includeId ?? true;
    const canonicalText = (doc: Resume) => codec.serialize(doc, { hideContact: false });

    const codec: DocumentCodec<Resume> = {
        kind: "cv",

        parse(text, { now, hideContact }): ParseOutcome<Resume> {
            const parsed = parseAuthoringText(text);
            if (parsed.status === "blocked") {
                return { ok: false, reason: { code: parsed.error?.code ?? "no-document", line: parsed.error?.line, column: parsed.error?.column } };
            }
            if (parsed.status === "full-export") return { ok: false, reason: { code: "full-export" } };

            const document = parsed.document as Obj;
            const hasContent = Object.keys(document).some((key) => key !== "format" && key !== "design" && key !== "$schema" && key !== "id");
            if (!hasContent) return { ok: false, reason: { code: "no-document" } };

            const converted = authoringToResume(document, { now });
            if (converted.notices.some((notice) => notice.code === "newer-version")) return { ok: false, reason: { code: "newer-version" } };

            const notices: Notice[] = [...converted.notices];
            const basics = document.basics;
            if (hideContact && basics && typeof basics === "object" && HIDDEN_FILE_KEYS.some((key) => key in (basics as Obj))) {
                notices.push({ kind: "skipped", code: "contact-ignored", path: "basics", params: {} });
            }
            return { ok: true, doc: converted.resume, id: typeof document.id === "string" ? document.id : null, notices };
        },

        apply(current, incoming, { hideContact }) {
            const next = applyContent(current, incoming);
            if (!hideContact) return next;
            // The file does not carry contact details, so whatever it holds there is ignored.
            const kept: Obj = {};
            for (const key of HIDDEN_BASICS_KEYS) kept[key] = (current.basics as unknown as Obj)[key];
            return { ...next, basics: { ...next.basics, ...kept } };
        },

        serialize(doc, { hideContact }) {
            const document = { ...resumeToAuthoring(doc, { ids: true, personal: !hideContact }) } as Obj;
            delete document.design;
            if (hideContact && document.basics && typeof document.basics === "object") {
                const basics = { ...(document.basics as Obj) };
                for (const key of HIDDEN_FILE_KEYS) delete basics[key];
                document.basics = basics;
            }
            let out: Obj = document;
            if (includeId && doc.id) {
                out = {};
                let placed = false;
                for (const [key, value] of Object.entries(document)) {
                    out[key] = value;
                    if (key === "format") {
                        out.id = doc.id;
                        placed = true;
                    }
                }
                if (!placed) out = { id: doc.id, ...document };
            }
            return `${serializeAuthoring(out as never, "pretty")}\n`;
        },

        updatedAt: (doc) => doc.updatedAt,
        entryCount: countEntries,
        canApplyExternal: () => ({ ok: true }),
        describeChange: describeContentChange,
        // Same content means the same text in the file: normalisation a round trip causes does not count as a change.
        isSameContent: (a, b) => canonicalText(a) === canonicalText(b),
    };
    return codec;
}
