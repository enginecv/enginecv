"use client";

import type { ReactNode } from "react";
import { es } from "@/lib/i18n/es";
import { registerDictionary } from "@/lib/i18n/dictionaries";

/**
 * Registers the `es` dictionary from a client chunk instead of serializing it
 * into every page's HTML and RSC payload. Registering while rendering, before
 * any child reads it, keeps the first client render equal to the server HTML.
 */
export default function GateES({ children }: { children: ReactNode }) {
    registerDictionary("es", es, { notify: false });
    return <>{children}</>;
}
