import { createNewResume } from "@/lib/templates/default-design";
import { resumeSchema, type Resume } from "@/lib/schema";
import type { StagedBatch } from "./types";

/** A valid CV with the given content laid over a blank one. */
export function resumeWith(content: Record<string, unknown> = {}): Resume {
    return resumeSchema.parse({ ...createNewResume(), ...content });
}

/** A staged source holding that content. */
export function batchOf(id: string, content: Record<string, unknown>): StagedBatch {
    return { id, sourceId: "test", label: id, resume: resumeWith(content) };
}
