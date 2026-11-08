"use client";

import type { ReactNode } from "react";
import { fr } from "@/lib/i18n/fr";
import { registerDictionary } from "@/lib/i18n/dictionaries";

/**
 * Registers the `fr` dictionary from a client chunk instead of serializing it
 * into every page's HTML and RSC payload. Registering while rendering, before
 * any child reads it, keeps the first client render equal to the server HTML.
 */
export default function GateFR({ children }: { children: ReactNode }) {
    registerDictionary("fr", fr, { notify: false });
    return <>{children}</>;
}
