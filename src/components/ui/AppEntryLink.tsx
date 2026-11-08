"use client";

import type { ComponentProps } from "react";
import { IntentPrefetchLink } from "@/components/ui/IntentPrefetchLink";
import { useKeepRouteLocale } from "@/lib/i18n/keep-route-locale";

/** A link from a content page into the app that keeps the page's language. */
export function AppEntryLink({ onClick, ...props }: ComponentProps<typeof IntentPrefetchLink>) {
    const keepRouteLocale = useKeepRouteLocale();

    return (
        <IntentPrefetchLink
            {...props}
            onClick={(event) => {
                keepRouteLocale();
                onClick?.(event);
            }}
        />
    );
}
