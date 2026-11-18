"use client";

import { useEffect } from "react";
import { captureLanding, captureSource } from "@/lib/analytics/export-event";

/** Notes, for this tab only, which link or site brought the visitor here and which page they landed on. */
export function AcquisitionSource() {
    useEffect(() => {
        captureSource();
        captureLanding();
    }, []);

    return null;
}
