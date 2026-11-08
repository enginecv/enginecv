import type { EmailEntry } from "./schema";

type EmailFields = {
    email?: string;
    emails?: readonly Partial<EmailEntry>[];
};

export function getResumeEmails(basics: EmailFields): EmailEntry[] {
    const structured = (basics.emails ?? [])
        .filter((entry): entry is Partial<EmailEntry> & { email: string } =>
            typeof entry.email === "string" && Boolean(entry.email.trim())
        )
        .map((entry, index) => ({
            id: entry.id || `email-${index}`,
            email: entry.email.trim(),
            label: typeof entry.label === "string" ? entry.label.trim() : "",
        }));

    if (structured.length > 0) return structured;

    const legacyEmail = basics.email?.trim() ?? "";
    return legacyEmail
        ? [{ id: "legacy-email", email: legacyEmail, label: "" }]
        : [];
}

export function getPrimaryResumeEmail(basics: EmailFields): string {
    return getResumeEmails(basics)[0]?.email ?? "";
}
