import type { Resume } from "@/lib/schema";

export const PHOTO_TOKEN = "enginecv:photo";

export function serializeForEditing(resume: Resume): { text: string; photo: string } {
    const photo = resume.basics.photo;
    const value = { ...resume, basics: { ...resume.basics, photo: photo.startsWith("data:") ? PHOTO_TOKEN : photo } };
    return { text: JSON.stringify(value, null, 2), photo };
}
