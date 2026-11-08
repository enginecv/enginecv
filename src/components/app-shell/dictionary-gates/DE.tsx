"use client";

import type { ReactNode } from "react";
import { de } from "@/lib/i18n/de";
import { registerDictionary } from "@/lib/i18n/dictionaries";

/**
 * Registers the `de` dictionary from a client chunk instead of serializing it
 * into every page's HTML and RSC payload. Registering while rendering, before
 * any child reads it, keeps the first client render equal to the server HTML.
 */
export default function GateDE({ children }: { children: ReactNode }) {
    registerDictionary("de", de, { notify: false });
    return <>{children}</>;
}
