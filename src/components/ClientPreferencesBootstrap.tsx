"use client";

import { useEffect } from "react";
import { useClientPreferencesStore } from "@/lib/preferences/store";

export function ClientPreferencesBootstrap() {
    const hydrated = useClientPreferencesStore((state) => state.hydrated);
    const hydrate = useClientPreferencesStore((state) => state.hydrate);

    useEffect(() => {
        if (!hydrated) hydrate();
    }, [hydrate, hydrated]);

    return null;
}
