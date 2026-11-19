import type { LetterWarning } from "@/lib/letters/resolve";

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** One sentence for a resolver warning, in the interface language. */
export function warningText(t: Translate, warning: LetterWarning): string {
    switch (warning.code) {
        case "missing-sender-field":
            return t("letters.warning.senderMissing", { field: t(`letters.field.${warning.detail ?? "name"}`) });
        case "unresolved-token":
            return t("letters.warning.tokenUnresolved", { token: warning.detail ?? "" });
        case "photo-unavailable":
            return t("letters.warning.photoUnavailable");
        case "cv-missing":
            return t("letters.warning.cvMissing");
    }
}
