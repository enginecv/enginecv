import type { Resume } from "@/lib/schema";
import { SENDER_KEYS, type Sender, type SenderKey, type SenderOverrides } from "./schema";

export interface ResolvedSender {
    sender: Sender;
    /** Keys whose value comes from a per-letter override, not from the CV. */
    overridden: SenderKey[];
}

/** The address lines the CV can supply: street, then postal code and city, else the location text. */
function cvAddress(basics: Resume["basics"]): string {
    const parts = basics.locationParts;
    const lines = [parts.address.trim(), [parts.postalCode.trim(), parts.city.trim()].filter(Boolean).join(" ")].filter(Boolean);
    return lines.length > 0 ? lines.join("\n") : basics.location.trim();
}

/** Sender values straight from the CV, before any override. */
export function senderFromCv(cv: Pick<Resume, "basics">): Sender {
    const basics = cv.basics;
    const email = basics.email.trim() || basics.emails.find((entry) => entry.email.trim())?.email.trim() || "";
    return {
        name: basics.name.trim(),
        headline: basics.headline.trim(),
        email,
        phone: basics.phone.trim(),
        address: cvAddress(basics),
        website: basics.website.trim(),
        signatureName: basics.name.trim(),
    };
}

/**
 * Per field: the letter's override if it has one, else the CV's value. The
 * printed signature follows the name unless it was overridden itself. Never
 * touches the CV.
 */
export function resolveSender(cv: Pick<Resume, "basics">, overrides: SenderOverrides = {}): ResolvedSender {
    const fromCv = senderFromCv(cv);
    const sender: Sender = { ...fromCv };
    const overridden: SenderKey[] = [];
    for (const key of SENDER_KEYS) {
        const override = overrides[key];
        if (override !== undefined) {
            sender[key] = override;
            overridden.push(key);
        }
    }
    if (overrides.signatureName === undefined && overrides.name !== undefined) sender.signatureName = overrides.name;
    return { sender, overridden };
}

/** Sender fields a letter should not go out without. */
export const REQUIRED_SENDER_KEYS: readonly SenderKey[] = ["name", "email"];

export function missingSenderKeys(sender: Sender): SenderKey[] {
    return REQUIRED_SENDER_KEYS.filter((key) => !sender[key].trim());
}

/** The sender of a letter that has no CV: what the person typed, and nothing else. The signature follows the name. */
export function resolveStandaloneSender(overrides: SenderOverrides = {}): Sender {
    const sender: Sender = { name: "", headline: "", email: "", phone: "", address: "", website: "", signatureName: "" };
    for (const key of SENDER_KEYS) {
        const value = overrides[key];
        if (value !== undefined) sender[key] = value;
    }
    if (overrides.signatureName === undefined) sender.signatureName = sender.name;
    return sender;
}
