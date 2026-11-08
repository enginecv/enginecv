"use client";

import { useEffect } from "react";
import { purgeLegacyTracking } from "@/lib/consent";

/** Clears tracking cookies and the old consent value left behind by earlier versions. */
export function LegacyTrackingPurge() {
    useEffect(() => {
        purgeLegacyTracking();
    }, []);

    return null;
}
