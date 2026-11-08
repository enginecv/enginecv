"use client";

import type { ReactNode } from "react";
import { bs } from "@/lib/i18n/bs";
import { registerDictionary } from "@/lib/i18n/dictionaries";

/**
 * Registers the `bs` dictionary from a client chunk instead of serializing it
 * into every page's HTML and RSC payload. Registering while rendering, before
 * any child reads it, keeps the first client render equal to the server HTML.
 */
export default function GateBS({ children }: { children: ReactNode }) {
    registerDictionary("bs", bs, { notify: false });
    return <>{children}</>;
}
