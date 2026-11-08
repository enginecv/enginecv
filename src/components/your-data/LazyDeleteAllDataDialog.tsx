"use client";

import dynamic from "next/dynamic";

/** The delete dialog, loaded the first time someone opens it (dashboard, editor palette, Your data page). */
export const LazyDeleteAllDataDialog = dynamic(() => import("./DeleteAllDataDialog"), { ssr: false });
