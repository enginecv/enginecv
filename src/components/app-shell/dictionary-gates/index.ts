import type { ComponentType, ReactNode } from "react";
import type { Locale } from "@/lib/i18n/locales";
import GateBs from "./BS";
import GateDe from "./DE";
import GateEs from "./ES";
import GateFr from "./FR";

/**
 * One client module per locale, so a page only loads its own dictionary chunk.
 * English is bundled everywhere and needs no gate.
 */
export const DICTIONARY_GATES: Record<Exclude<Locale, "en">, ComponentType<{ children: ReactNode }>> = {
    bs: GateBs,
    de: GateDe,
    es: GateEs,
    fr: GateFr,
};
