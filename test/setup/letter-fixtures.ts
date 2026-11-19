import { db } from "@/lib/db";
import { createEmptyResume, createUngroupedSkillGroup, skillSchema, type Resume } from "@/lib/schema";
import { letterDocumentSchema, snapshotSchema, type LetterDocument } from "@/lib/letters/schema";

/** A CV with the details letters read: name, contact, skills, design. */
export function makeCv(overrides: { id?: string; name?: string; headline?: string; email?: string; phone?: string; location?: string; website?: string; language?: string; skills?: string[]; accent?: string; fontFamily?: string; title?: string; photo?: string } = {}): Resume {
    const cv = createEmptyResume();
    cv.id = overrides.id ?? "cv-1";
    cv.meta.title = overrides.title ?? "My CV";
    cv.basics.name = overrides.name ?? "Amina Hodzic";
    cv.basics.headline = overrides.headline ?? "Senior Product Designer";
    cv.basics.email = overrides.email ?? "amina@example.com";
    cv.basics.phone = overrides.phone ?? "+49 30 1234567";
    cv.basics.location = overrides.location ?? "Berlin, Germany";
    cv.basics.website = overrides.website ?? "";
    cv.basics.photo = overrides.photo ?? "";
    cv.settings.language = overrides.language ?? "en";
    if (overrides.accent) cv.settings.colors.accent = overrides.accent;
    if (overrides.fontFamily) cv.settings.typography.fontFamily = overrides.fontFamily;
    const skills = overrides.skills ?? ["Figma", "Design systems", "Prototyping", "User research", "Accessibility", "Workshops"];
    cv.skillGroups = [createUngroupedSkillGroup(skills.map((name) => skillSchema.parse({ name })))];
    return cv;
}

/** A draft letter linked to `cvId`. */
export function makeLetter(overrides: Partial<LetterDocument> & { cvId?: string | null } = {}): LetterDocument {
    return letterDocumentSchema.parse({
        id: overrides.id ?? "letter-1",
        cvId: overrides.cvId === undefined ? "cv-1" : overrides.cvId,
        language: "en",
        date: "2026-11-18",
        company: "Acme",
        role: "Designer",
        salutation: "Dear Hiring Team,",
        closing: "Kind regards,",
        paragraphs: [{ id: "p1", markdown: "I am **excited** to apply as {{role}}." }],
        createdAt: 1,
        updatedAt: 1,
        ...overrides,
    });
}

/** A sent letter whose frozen copy holds `senderName` (so tests can see it never changes). */
export function makeSentLetter(overrides: Partial<LetterDocument> & { senderName?: string } = {}): LetterDocument {
    const { senderName = "Amina Hodzic", ...rest } = overrides;
    return makeLetter({
        status: "sent",
        frozen: snapshotSchema.parse({
            at: 2,
            sender: { name: senderName, email: "amina@example.com", phone: "+49 30 1234567", signatureName: senderName },
            design: {},
            tokens: { role: "Senior Product Designer" },
            cvTitle: "My CV",
        }),
        ...rest,
    });
}

/** Empties every table letters touch. */
export async function resetLetterTables(): Promise<void> {
    await db.resumes.clear();
    await db.resumeHistory.clear();
    await db.coverLetters.clear();
    await db.letterParagraphs.clear();
}
