"use client";

import { useEffect } from "react";
import { captureSource } from "@/lib/analytics/export-event";

/** Notes, for this tab only, which link or site brought the visitor here. */
export function AcquisitionSource() {
    useEffect(() => {
        captureSource();
    }, []);

    return null;
}
