"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { isAdPageAllowed } from "@/lib/ads";

export function useAdPageAllowed() {
    const pathname = usePathname() ?? "/";
    const { locale } = useTranslation();
    return isAdPageAllowed(pathname, locale);
}
