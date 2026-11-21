import { createQaFullResume } from "@/lib/qa/sample-resumes";
import type { Resume } from "@/lib/schema";
import { createCvCodec } from "@/lib/workspace/codecs/cv";

/** Fixtures for the workspace folder tests: documents as a person or an agent would leave them in a file. */

const codec = createCvCodec();

export function makeWorkspaceCv(overrides: { id?: string; title?: string; name?: string; updatedAt?: number } = {}): Resume {
    const base = createQaFullResume();
    return {
        ...base,
        id: overrides.id ?? "cv-1",
        updatedAt: overrides.updatedAt ?? 1,
        meta: { ...base.meta, title: overrides.title ?? base.meta.title },
        basics: { ...base.basics, name: overrides.name ?? "Amina Hodzic", email: "amina@example.com", phone: "+49 30 1234567" },
    };
}

/** The text the app writes for a CV. */
export function cvFileText(resume: Resume, options: { hideContact?: boolean } = {}): string {
    return codec.serialize(resume, { hideContact: options.hideContact ?? false });
}

/** A file edited the way an agent would: change the parsed text and write it back pretty-printed. */
export function editFile(text: string, change: (document: Record<string, unknown>) => void): string {
    const document = JSON.parse(text) as Record<string, unknown>;
    change(document);
    return `${JSON.stringify(document, null, 2)}\n`;
}

/** The file cut off after `fraction` of its length, as a half-finished write looks. */
export function cutOff(text: string, fraction: number): string {
    return text.slice(0, Math.max(1, Math.floor(text.length * fraction)));
}

/** The file with a whole top-level section removed. */
export function withoutSection(text: string, section: string): string {
    return editFile(text, (document) => {
        delete document[section];
    });
}

/** The harmless slips an agent or editor introduces. */
export const MANGLES: Record<string, (text: string) => string> = {
    bom: (text) => `﻿${text}`,
    crlf: (text) => text.replace(/\n/g, "\r\n"),
    fenced: (text) => `\`\`\`json\n${text}\n\`\`\``,
    chat: (text) => `Here is your CV:\n${text}\nLet me know!`,
    trailingComma: (text) => text.replace(/\n}\s*$/, ",\n}"),
};
