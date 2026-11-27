import type { JobApplication } from "@/lib/jobs/schema";
import type { LetterDocument } from "@/lib/letters/schema";
import type { Resume } from "@/lib/schema";

/** What a document is called in lists and in file names. */
export const cvTitle = (cv: Resume) => cv.meta.title || cv.basics.name || "CV";
export const letterTitle = (letter: LetterDocument) => letter.title || [letter.company, letter.role].filter(Boolean).join(" - ") || "Letter";
/** A tracked job's file title: the role and the company, the way the tracker names it. */
export const applicationFileTitle = (application: Pick<JobApplication, "role" | "company">) => `${application.company} - ${application.role}`;
